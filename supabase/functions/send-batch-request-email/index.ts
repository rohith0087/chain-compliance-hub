import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { Resend } from "npm:resend@2.0.0";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/corsHeaders.ts";

interface BatchEmailRequest {
  requestIds: string[];
  supplierId: string;
}

interface DocumentRequest {
  id: string;
  title: string;
  description: string | null;
  document_type: string;
  category: string | null;
  priority: string | null;
  due_date: string | null;
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ============================================
    // AUTH: Verify caller is authenticated
    // ============================================
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resend = new Resend(resendApiKey);

    const { requestIds, supplierId }: BatchEmailRequest = await req.json();

    if (!requestIds || requestIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "No request IDs provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Input validation: limit array size to prevent abuse
    if (requestIds.length > 100) {
      return new Response(
        JSON.stringify({ error: "Maximum 100 request IDs allowed per batch" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing batch email for ${requestIds.length} requests`);

    // ============================================
    // AUTHORIZATION: Verify user belongs to the buyer company
    // ============================================
    const { data: requests, error: requestsError } = await supabase
      .from("document_requests")
      .select(`
        id, title, description, document_type, category, priority, due_date, buyer_id,
        buyers ( company_name )
      `)
      .in("id", requestIds);

    if (requestsError || !requests || requests.length === 0) {
      console.error("Error fetching requests:", requestsError);
      return new Response(
        JSON.stringify({ error: "Requests not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // All requests must belong to the same buyer
    const buyerId = requests[0].buyer_id;
    if (!requests.every(r => r.buyer_id === buyerId)) {
      return new Response(
        JSON.stringify({ error: "All requests must belong to the same buyer" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user is owner or team member of the buyer company
    const { data: buyerOwner } = await supabase
      .from("buyers")
      .select("id")
      .eq("id", buyerId)
      .eq("profile_id", user.id)
      .maybeSingle();

    if (!buyerOwner) {
      const { data: companyUser } = await supabase
        .from("company_users")
        .select("id")
        .eq("company_id", buyerId)
        .eq("company_type", "buyer")
        .eq("profile_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (!companyUser) {
        return new Response(
          JSON.stringify({ error: "Unauthorized: You do not belong to this buyer company" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Check if supplier has email notifications enabled
    const { data: notificationSettings } = await supabase
      .from("supplier_notification_settings")
      .select("new_request_email_enabled")
      .eq("supplier_id", supplierId)
      .maybeSingle();

    if (!notificationSettings?.new_request_email_enabled) {
      console.log("Email notifications disabled for supplier");
      return new Response(
        JSON.stringify({ success: true, message: "Email notifications disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get buyer name from first request
    const buyerName = (requests[0].buyers as any)?.company_name || "A Buyer";

    // Get supplier details
    const { data: supplier } = await supabase
      .from("suppliers")
      .select("id, company_name, profile_id")
      .eq("id", supplierId)
      .single();

    if (!supplier) {
      console.error("Supplier not found:", supplierId);
      return new Response(
        JSON.stringify({ error: "Supplier not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Collect recipient emails
    const recipientEmails: Set<string> = new Set();
    const recipientNames: Map<string, string> = new Map();

    // Get supplier owner's email
    if (supplier.profile_id) {
      const { data: ownerProfile } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", supplier.profile_id)
        .single();

      if (ownerProfile?.email) {
        recipientEmails.add(ownerProfile.email);
        recipientNames.set(ownerProfile.email, ownerProfile.full_name || "Company Owner");
      }
    }

    // Get supplier company admins
    const { data: companyAdmins } = await supabase
      .from("company_users")
      .select(`profile_id, profiles ( email, full_name )`)
      .eq("company_id", supplierId)
      .eq("company_type", "supplier")
      .eq("status", "active")
      .eq("role", "company_admin");

    if (companyAdmins) {
      for (const admin of companyAdmins) {
        const profile = admin.profiles as any;
        if (profile?.email) {
          recipientEmails.add(profile.email);
          recipientNames.set(profile.email, profile.full_name || "Company Admin");
        }
      }
    }

    if (recipientEmails.size === 0) {
      console.log("No recipients found for notification");
      return new Response(
        JSON.stringify({ success: true, message: "No recipients to notify" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Sending batch email to ${recipientEmails.size} recipients for ${requests.length} documents`);

    // Sort requests by priority
    const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
    const sortedRequests = [...requests].sort((a, b) => {
      const priorityA = priorityOrder[a.priority || 'medium'] ?? 2;
      const priorityB = priorityOrder[b.priority || 'medium'] ?? 2;
      return priorityA - priorityB;
    });

    // Find earliest due date
    const dueDates = requests
      .filter(r => r.due_date)
      .map(r => new Date(r.due_date!))
      .sort((a, b) => a.getTime() - b.getTime());
    const earliestDueDate = dueDates.length > 0 ? dueDates[0] : null;

    // Priority colors and labels
    const priorityStyles: Record<string, { bg: string; label: string }> = {
      urgent: { bg: "#dc2626", label: "Urgent" },
      high: { bg: "#ea580c", label: "High" },
      medium: { bg: "#ca8a04", label: "Medium" },
      low: { bg: "#16a34a", label: "Low" }
    };

    const buildDocumentRows = (docs: typeof sortedRequests) => {
      return docs.map(doc => {
        const priority = priorityStyles[doc.priority || 'medium'] || priorityStyles.medium;
        return `
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 12px 8px; font-size: 14px;">${doc.title}</td>
            <td style="padding: 12px 8px; font-size: 14px; color: #6b7280;">${doc.category || 'General'}</td>
            <td style="padding: 12px 8px;">
              <span style="background: ${priority.bg}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; text-transform: uppercase; font-weight: 500;">
                ${priority.label}
              </span>
            </td>
          </tr>
        `;
      }).join('');
    };

    const emailPromises = Array.from(recipientEmails).map(async (email) => {
      const recipientName = recipientNames.get(email) || "Team Member";

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 650px; margin: 0 auto; padding: 20px; background-color: #f3f4f6;">
          <div style="background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px; text-align: center;">
              <h1 style="color: white; margin: 0 0 8px 0; font-size: 24px; font-weight: 600;">📄 New Document Requests</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 16px;">from ${buyerName}</p>
            </div>
            <div style="padding: 32px;">
              <p style="font-size: 16px; margin: 0 0 20px 0;">Hi ${recipientName},</p>
              <p style="font-size: 16px; margin: 0 0 24px 0;">
                <strong>${buyerName}</strong> has requested 
                <span style="background: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 4px; font-weight: 600;">${requests.length} document${requests.length > 1 ? 's' : ''}</span> 
                from you.
              </p>
              ${earliestDueDate ? `
              <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; font-size: 14px; color: #92400e;">
                  <strong>📅 Earliest Due Date:</strong> ${earliestDueDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
              ` : ''}
              <div style="background: #f9fafb; border-radius: 8px; overflow: hidden; margin-bottom: 24px;">
                <div style="background: #e5e7eb; padding: 12px 8px;">
                  <span style="font-weight: 600; font-size: 14px; color: #374151;">📋 Requested Documents (${requests.length})</span>
                </div>
                <table style="width: 100%; border-collapse: collapse;">
                  <thead>
                    <tr style="background: #f3f4f6; border-bottom: 2px solid #e5e7eb;">
                      <th style="padding: 10px 8px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase;">Document</th>
                      <th style="padding: 10px 8px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase;">Category</th>
                      <th style="padding: 10px 8px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase;">Priority</th>
                    </tr>
                  </thead>
                  <tbody>${buildDocumentRows(sortedRequests)}</tbody>
                </table>
              </div>
              <div style="text-align: center; margin: 32px 0;">
                <a href="https://compliance.tracer2c.com/dashboard" style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 14px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block; font-size: 16px;">
                  View & Respond to All
                </a>
              </div>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
              <p style="font-size: 14px; color: #6b7280; margin: 0;">Best regards,<br><strong>Compliance Compass</strong></p>
            </div>
          </div>
          <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
            <p style="margin: 0 0 4px 0;">This is an automated notification from Compliance Compass.</p>
            <p style="margin: 0;">You can manage your notification preferences in Settings.</p>
          </div>
        </body>
        </html>
      `;

      try {
        const result = await resend.emails.send({
          from: "Compliance Compass <notifications@tracer2c.com>",
          to: [email],
          subject: `${buyerName} has requested ${requests.length} document${requests.length > 1 ? 's' : ''} from you`,
          html: emailHtml,
        });
        console.log(`Batch email sent successfully`);
        return { email, success: true, result };
      } catch (emailError) {
        console.error(`Failed to send batch email:`, emailError);
        return { email, success: false, error: emailError };
      }
    });

    const results = await Promise.all(emailPromises);
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log(`Batch email complete: ${successCount} sent, ${failureCount} failed for ${requests.length} documents`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sent ${successCount} batch emails for ${requests.length} documents`,
        details: { sent: successCount, failed: failureCount, documents: requests.length }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in send-batch-request-email:", error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
