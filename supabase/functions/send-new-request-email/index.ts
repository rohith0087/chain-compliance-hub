import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  requestId: string;
  supplierId: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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
    const resend = new Resend(resendApiKey);

    const { requestId, supplierId }: EmailRequest = await req.json();

    console.log("Processing new request email notification for SUPPLIER:", { requestId, supplierId });

    // Step 1: Check if supplier has email notifications enabled
    const { data: notificationSettings } = await supabase
      .from("supplier_notification_settings")
      .select("new_request_email_enabled")
      .eq("supplier_id", supplierId)
      .maybeSingle();

    if (!notificationSettings?.new_request_email_enabled) {
      console.log("Email notifications disabled for supplier:", supplierId);
      return new Response(
        JSON.stringify({ success: true, message: "Email notifications disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Get the document request details with buyer info
    const { data: request, error: requestError } = await supabase
      .from("document_requests")
      .select(`
        id,
        title,
        description,
        document_type,
        category,
        priority,
        due_date,
        branch_id,
        supplier_branch_id,
        buyer_id,
        buyers (
          company_name
        )
      `)
      .eq("id", requestId)
      .single();

    if (requestError || !request) {
      console.error("Error fetching request:", requestError);
      return new Response(
        JSON.stringify({ error: "Request not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: Get supplier company details
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

    // Step 4: Collect all SUPPLIER recipient emails
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
      .select(`
        profile_id,
        profiles (
          email,
          full_name
        )
      `)
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

    // Get supplier branch users if request targets a specific supplier branch
    if (request.supplier_branch_id) {
      const { data: branchUsers } = await supabase
        .from("company_users")
        .select(`
          profile_id,
          profiles (
            email,
            full_name
          )
        `)
        .eq("company_id", supplierId)
        .eq("company_type", "supplier")
        .eq("branch_id", request.supplier_branch_id)
        .eq("status", "active");

      if (branchUsers) {
        for (const branchUser of branchUsers) {
          const profile = branchUser.profiles as any;
          if (profile?.email) {
            recipientEmails.add(profile.email);
            recipientNames.set(profile.email, profile.full_name || "Team Member");
          }
        }
      }

      // Get branch name for email content
      const { data: branch } = await supabase
        .from("company_branches")
        .select("branch_name")
        .eq("id", request.supplier_branch_id)
        .single();

      if (branch) {
        (request as any).target_branch_name = branch.branch_name;
      }
    }

    if (recipientEmails.size === 0) {
      console.log("No recipients found for notification");
      return new Response(
        JSON.stringify({ success: true, message: "No recipients to notify" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Sending email to ${recipientEmails.size} supplier recipients:`, Array.from(recipientEmails));

    // Step 5: Send emails
    const buyerName = (request.buyers as any)?.company_name || "A Buyer";
    const priorityColors: Record<string, string> = {
      urgent: "#dc2626",
      high: "#ea580c",
      medium: "#ca8a04",
      low: "#16a34a"
    };
    const priorityColor = priorityColors[request.priority || "medium"] || "#ca8a04";

    const emailPromises = Array.from(recipientEmails).map(async (email) => {
      const recipientName = recipientNames.get(email) || "Team Member";

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">📄 New Document Request</h1>
          </div>
          
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="font-size: 16px; margin-bottom: 20px;">Hi ${recipientName},</p>
            
            <p style="font-size: 16px; margin-bottom: 20px;"><strong>${buyerName}</strong> has requested a document from you:</p>
            
            <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; width: 120px;">📄 Request:</td>
                  <td style="padding: 8px 0; font-weight: 600;">${request.title}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">🏢 From:</td>
                  <td style="padding: 8px 0;">${buyerName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">📁 Category:</td>
                  <td style="padding: 8px 0;">${request.category || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">⚡ Priority:</td>
                  <td style="padding: 8px 0;">
                    <span style="background: ${priorityColor}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; text-transform: uppercase;">
                      ${request.priority || 'Medium'}
                    </span>
                  </td>
                </tr>
                ${request.due_date ? `
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">📅 Due Date:</td>
                  <td style="padding: 8px 0;">${new Date(request.due_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td>
                </tr>
                ` : ''}
                ${(request as any).target_branch_name ? `
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">🏢 Your Branch:</td>
                  <td style="padding: 8px 0;">${(request as any).target_branch_name}</td>
                </tr>
                ` : ''}
              </table>
            </div>

            ${request.description ? `
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
              <p style="margin: 0; font-size: 14px; color: #92400e;"><strong>Description:</strong> ${request.description}</p>
            </div>
            ` : ''}
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://compliance.tracer2c.com/dashboard" 
                 style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
                View & Respond
              </a>
            </div>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
            
            <p style="font-size: 14px; color: #6b7280; margin: 0;">
              Best regards,<br>
              <strong>Compliance Compass</strong>
            </p>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
            <p>This is an automated notification from Compliance Compass.</p>
            <p>You can manage your notification preferences in Settings.</p>
          </div>
        </body>
        </html>
      `;

      try {
        const result = await resend.emails.send({
          from: "Compliance Compass <notifications@tracer2c.com>",
          to: [email],
          subject: `New Document Request from ${buyerName}: ${request.title}`,
          html: emailHtml,
        });
        console.log(`Email sent to ${email}:`, result);
        return { email, success: true, result };
      } catch (emailError) {
        console.error(`Failed to send email to ${email}:`, emailError);
        return { email, success: false, error: emailError };
      }
    });

    const results = await Promise.all(emailPromises);
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log(`Email notification complete: ${successCount} sent, ${failureCount} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sent ${successCount} emails to supplier`,
        details: { sent: successCount, failed: failureCount }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in send-new-request-email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
