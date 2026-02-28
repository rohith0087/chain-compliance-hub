import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/corsHeaders.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface EmailRecipient {
  email: string;
  name: string;
  type: "primary" | "owner" | "admin";
}

interface EmailPayload {
  supplier_id: string;
  supplier_name: string;
  recipients: EmailRecipient[];
  subject: string;
  body: string;
  action_type: string;
  document_ids?: string[];
  buyer_id: string;
  sender_user_id: string;
}

interface SendRequest {
  emails: EmailPayload[];
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;
  console.log("[send-compliance-followup] Function invoked");

  try {
    // Validate auth
    const authHeader = req.headers.get("authorization");
    console.log("[send-compliance-followup] Auth header present:", !!authHeader);
    
    if (!authHeader) {
      console.error("[send-compliance-followup] No authorization header");
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Verify the JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    console.log("[send-compliance-followup] User verified");
    
    if (authError || !user) {
      console.error("[send-compliance-followup] Auth error:", authError);
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const requestBody = await req.json();
    console.log("[send-compliance-followup] Request received, email count:", emails?.length || 0);
    
    const { emails }: SendRequest = requestBody;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      console.error("[send-compliance-followup] No emails in request");
      return new Response(JSON.stringify({ error: "No emails to send" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if RESEND_API_KEY is set
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    console.log("[send-compliance-followup] RESEND_API_KEY configured:", !!resendApiKey);
    
    if (!resendApiKey) {
      console.error("[send-compliance-followup] RESEND_API_KEY not configured");
      return new Response(JSON.stringify({ error: "Email service not configured. Please add RESEND_API_KEY." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get sender info for email signature
    const { data: senderProfile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .single();
    
    console.log("[send-compliance-followup] Sender profile found");

    // Get buyer company info
    const { data: buyer } = await supabase
      .from("buyers")
      .select("company_name, id")
      .eq("id", emails[0].buyer_id)
      .single();
    
    console.log("[send-compliance-followup] Buyer:", buyer?.company_name);

    const results: Array<{
      supplier_id: string;
      supplier_name: string;
      success: boolean;
      emails_sent: number;
      errors?: string[];
    }> = [];

    // Send emails for each supplier (individually, NOT CC/BCC)
    for (const emailPayload of emails) {
      console.log(`[send-compliance-followup] Processing supplier: ${emailPayload.supplier_name} with ${emailPayload.recipients.length} recipients`);
      
      const supplierResults = {
        supplier_id: emailPayload.supplier_id,
        supplier_name: emailPayload.supplier_name,
        success: true,
        emails_sent: 0,
        errors: [] as string[],
      };

      for (const recipient of emailPayload.recipients) {
        console.log(`[send-compliance-followup] Sending to recipient`);
        
        try {
          // Build personalized email with signature
          const emailHtml = buildEmailHtml({
            body: emailPayload.body,
            senderName: senderProfile?.full_name || "Compliance Team",
            companyName: buyer?.company_name || "Your Buyer",
            recipientName: recipient.name,
          });

          const emailResponse = await resend.emails.send({
            from: "Compliance <compliance@tracer2c.com>",
            to: [recipient.email],
            subject: emailPayload.subject,
            html: emailHtml,
          });

          console.log(`[send-compliance-followup] ✓ Email sent`);
          supplierResults.emails_sent++;

          // Log to email_audit_logs table
          const { error: auditError } = await supabase.from("email_audit_logs").insert({
            sender_id: user.id,
            sender_email: senderProfile?.email || user.email,
            sender_name: senderProfile?.full_name,
            recipient_email: recipient.email,
            recipient_name: recipient.name,
            subject: emailPayload.subject,
            body_preview: emailPayload.body.substring(0, 500),
            supplier_id: emailPayload.supplier_id,
            buyer_id: emailPayload.buyer_id,
            action_type: emailPayload.action_type,
            status: "sent",
            resend_id: emailResponse?.data?.id || null,
            metadata: {
              recipient_type: recipient.type,
              document_ids: emailPayload.document_ids,
            },
          });
          
          if (auditError) {
            console.warn("[send-compliance-followup] Failed to log to email_audit_logs:", auditError);
          } else {
            console.log("[send-compliance-followup] ✓ Logged to email_audit_logs");
          }

          // Also log to auth_audit_logs for backward compatibility
          await supabase.from("auth_audit_logs").insert({
            user_id: user.id,
            user_email: senderProfile?.email || user.email,
            user_name: senderProfile?.full_name,
            action: "compliance_followup_email_sent",
            metadata: {
              supplier_id: emailPayload.supplier_id,
              supplier_name: emailPayload.supplier_name,
              recipient_email: recipient.email,
              recipient_type: recipient.type,
              action_type: emailPayload.action_type,
              document_ids: emailPayload.document_ids,
              email_id: emailResponse?.data?.id,
            },
          });
        } catch (sendError: any) {
          console.error(`[send-compliance-followup] ✗ Failed to send:`, sendError.message);
          supplierResults.errors.push(`${recipient.email}: ${sendError.message}`);
          
          // Log failed attempt
          await supabase.from("email_audit_logs").insert({
            sender_id: user.id,
            sender_email: senderProfile?.email || user.email,
            sender_name: senderProfile?.full_name,
            recipient_email: recipient.email,
            recipient_name: recipient.name,
            subject: emailPayload.subject,
            body_preview: emailPayload.body.substring(0, 500),
            supplier_id: emailPayload.supplier_id,
            buyer_id: emailPayload.buyer_id,
            action_type: emailPayload.action_type,
            status: "failed",
            error_message: sendError.message,
            metadata: {
              recipient_type: recipient.type,
              document_ids: emailPayload.document_ids,
            },
          });
        }
      }

      if (supplierResults.errors.length > 0 && supplierResults.emails_sent === 0) {
        supplierResults.success = false;
      }

      results.push(supplierResults);
    }

    const totalSent = results.reduce((acc, r) => acc + r.emails_sent, 0);
    const failedSuppliers = results.filter((r) => !r.success);

    console.log(`[send-compliance-followup] Complete. Total sent: ${totalSent}, Failed suppliers: ${failedSuppliers.length}`);

    return new Response(
      JSON.stringify({
        success: failedSuppliers.length === 0,
        total_emails_sent: totalSent,
        total_suppliers: results.length,
        failed_suppliers: failedSuppliers.length,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[send-compliance-followup] Unhandled error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

function buildEmailHtml(params: {
  body: string;
  senderName: string;
  companyName: string;
  recipientName: string;
}): string {
  const { body, senderName, companyName } = params;

  // Convert markdown-style formatting to HTML
  const formattedBody = body
    .replace(/\n/g, "<br/>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/^• (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Compliance Follow-up</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 20px; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 20px;">Compliance Update</h1>
  </div>
  
  <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
    <div style="background: white; padding: 20px; border-radius: 6px; border: 1px solid #e2e8f0;">
      ${formattedBody}
    </div>
    
    <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
      <p style="margin: 0 0 4px 0; font-weight: 600;">${senderName}</p>
      <p style="margin: 0; color: #64748b; font-size: 14px;">${companyName}</p>
    </div>
    
    <div style="margin-top: 24px; text-align: center;">
      <a href="https://compliance.tracer2c.com" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
        View in Portal
      </a>
    </div>
  </div>
  
  <div style="text-align: center; margin-top: 16px; color: #94a3b8; font-size: 12px;">
    <p>This is an automated compliance notification from Tracer2C.</p>
  </div>
</body>
</html>
  `;
}

serve(handler);
