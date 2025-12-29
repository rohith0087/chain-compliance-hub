import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// In-memory draft storage (for short-lived drafts - expires after 30 min)
const emailDrafts = new Map<string, { 
  draft: any; 
  userId: string; 
  createdAt: number;
  senderName: string;
  senderCompany: string;
}>();

// Clean up expired drafts (older than 30 minutes)
function cleanupExpiredDrafts() {
  const now = Date.now();
  const thirtyMinutes = 30 * 60 * 1000;
  for (const [id, data] of emailDrafts.entries()) {
    if (now - data.createdAt > thirtyMinutes) {
      emailDrafts.delete(id);
    }
  }
}

interface GenericEmailRequest {
  mode?: 'draft' | 'send';
  draft_id?: string;
  to_email?: string;
  to_name?: string;
  subject?: string;
  body?: string;
  sender_name?: string;
  sender_company?: string;
  sender_context?: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("[send-generic-email] Function invoked");
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get("authorization");
    console.log("[send-generic-email] Auth header present:", !!authHeader);
    
    if (!authHeader) {
      console.error("[send-generic-email] No authorization header");
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Verify the JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    console.log("[send-generic-email] User verified:", user?.id);
    
    if (authError || !user) {
      console.error("[send-generic-email] Auth error:", authError);
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const requestBody: GenericEmailRequest = await req.json();
    console.log("[send-generic-email] Request body:", JSON.stringify(requestBody, null, 2));
    
    const mode = requestBody.mode || 'send'; // Default to 'send' for backward compatibility
    
    // Clean up old drafts periodically
    cleanupExpiredDrafts();

    // ============= DRAFT MODE =============
    if (mode === 'draft') {
      const { to_email, to_name, subject, body, sender_context } = requestBody;
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!to_email || !emailRegex.test(to_email)) {
        console.error("[send-generic-email] Invalid email address:", to_email);
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Invalid email address format" 
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!subject || !body) {
        console.error("[send-generic-email] Missing subject or body for draft");
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Subject and body are required for draft" 
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get sender info from profile
      let senderName = requestBody.sender_name;
      let senderCompany = requestBody.sender_company;
      
      if (!senderName || !senderCompany) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single();
        
        if (!senderName) {
          senderName = profile?.full_name || "Compliance Team";
        }
        
        if (!senderCompany) {
          const { data: buyer } = await supabase
            .from("buyers")
            .select("company_name")
            .eq("profile_id", user.id)
            .maybeSingle();
          
          if (buyer?.company_name) {
            senderCompany = buyer.company_name;
          } else {
            const { data: supplier } = await supabase
              .from("suppliers")
              .select("company_name")
              .eq("profile_id", user.id)
              .maybeSingle();
            
            senderCompany = supplier?.company_name || "Tracer2C";
          }
        }
      }

      // Generate draft ID and store
      const draftId = crypto.randomUUID();
      emailDrafts.set(draftId, {
        draft: {
          to_email,
          to_name: to_name || 'there',
          subject,
          body,
          sender_context: sender_context || 'Sent via Compliance Compass'
        },
        userId: user.id,
        createdAt: Date.now(),
        senderName: senderName!,
        senderCompany: senderCompany!
      });

      console.log(`[send-generic-email] Draft created: ${draftId}`);

      return new Response(
        JSON.stringify({
          success: true,
          draft_id: draftId,
          sender_name: senderName,
          sender_company: senderCompany,
          message: "Draft created successfully. User must confirm to send."
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ============= SEND MODE =============
    if (mode === 'send' && requestBody.draft_id) {
      const draftData = emailDrafts.get(requestBody.draft_id);
      
      if (!draftData) {
        console.error("[send-generic-email] Draft not found:", requestBody.draft_id);
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Draft not found or expired. Please create a new draft." 
        }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify user owns this draft
      if (draftData.userId !== user.id) {
        console.error("[send-generic-email] User doesn't own this draft");
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Unauthorized to send this draft" 
        }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { draft, senderName, senderCompany } = draftData;
      const { to_email, to_name, subject, body, sender_context } = draft;

      // Check if RESEND_API_KEY is set
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (!resendApiKey) {
        console.error("[send-generic-email] RESEND_API_KEY not configured");
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Email service not configured. Please add RESEND_API_KEY." 
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Build email HTML
      const formattedBody = body
        .replace(/\n/g, "<br/>")
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>");

      const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 20px; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 20px;">${senderCompany}</h1>
  </div>
  
  <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
    <div style="background: white; padding: 20px; border-radius: 6px; border: 1px solid #e2e8f0;">
      <p style="margin-top: 0;">Dear ${to_name},</p>
      
      <div style="white-space: pre-wrap; line-height: 1.6;">
        ${formattedBody}
      </div>
    </div>
    
    <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
      <p style="margin: 0 0 4px 0; font-weight: 600;">Best regards,</p>
      <p style="margin: 0 0 4px 0; font-weight: 600;">${senderName}</p>
      <p style="margin: 0; color: #64748b; font-size: 14px;">${senderCompany}</p>
    </div>
  </div>
  
  <div style="text-align: center; margin-top: 16px; color: #94a3b8; font-size: 12px;">
    <p>${sender_context}</p>
  </div>
</body>
</html>
      `;

      // Send email via Resend
      console.log(`[send-generic-email] Sending email to: ${to_email}`);
      
      const emailResponse = await resend.emails.send({
        from: `${senderCompany} <compliance@tracer2c.com>`,
        to: [to_email],
        subject: subject,
        html: emailHtml,
      });

      console.log(`[send-generic-email] ✓ Email sent:`, JSON.stringify(emailResponse));

      // Log to auth_audit_logs for tracking
      await supabase.from("auth_audit_logs").insert({
        user_id: user.id,
        user_email: user.email,
        action: "generic_email_sent",
        metadata: {
          to_email,
          to_name,
          subject,
          sender_name: senderName,
          sender_company: senderCompany,
          email_id: emailResponse?.data?.id,
          draft_id: requestBody.draft_id
        },
      });

      // Delete the draft after successful send
      emailDrafts.delete(requestBody.draft_id);

      return new Response(
        JSON.stringify({
          success: true,
          message: `Email sent successfully to ${to_email}`,
          email_id: emailResponse?.data?.id,
          to_email,
          to_name,
          subject
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ============= LEGACY DIRECT SEND (backward compatibility) =============
    const { to_email, to_name, subject, body, sender_name, sender_company, sender_context } = requestBody;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!to_email || !emailRegex.test(to_email)) {
      console.error("[send-generic-email] Invalid email address:", to_email);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Invalid email address format" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!subject || !body) {
      console.error("[send-generic-email] Missing subject or body");
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Subject and body are required" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if RESEND_API_KEY is set
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    console.log("[send-generic-email] RESEND_API_KEY configured:", !!resendApiKey);
    
    if (!resendApiKey) {
      console.error("[send-generic-email] RESEND_API_KEY not configured");
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Email service not configured. Please add RESEND_API_KEY." 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get sender info from profile if not provided
    let finalSenderName = sender_name;
    let finalSenderCompany = sender_company;
    
    if (!finalSenderName || !finalSenderCompany) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();
      
      if (!finalSenderName) {
        finalSenderName = profile?.full_name || "Compliance Team";
      }
      
      // Try to get company name from buyer or supplier
      if (!finalSenderCompany) {
        const { data: buyer } = await supabase
          .from("buyers")
          .select("company_name")
          .eq("profile_id", user.id)
          .maybeSingle();
        
        if (buyer?.company_name) {
          finalSenderCompany = buyer.company_name;
        } else {
          const { data: supplier } = await supabase
            .from("suppliers")
            .select("company_name")
            .eq("profile_id", user.id)
            .maybeSingle();
          
          finalSenderCompany = supplier?.company_name || "Tracer2C";
        }
      }
    }

    // Build email HTML
    const recipientName = to_name || "there";
    const formattedBody = body
      .replace(/\n/g, "<br/>")
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>");

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 20px; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 20px;">${finalSenderCompany}</h1>
  </div>
  
  <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
    <div style="background: white; padding: 20px; border-radius: 6px; border: 1px solid #e2e8f0;">
      <p style="margin-top: 0;">Dear ${recipientName},</p>
      
      <div style="white-space: pre-wrap; line-height: 1.6;">
        ${formattedBody}
      </div>
    </div>
    
    <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
      <p style="margin: 0 0 4px 0; font-weight: 600;">Best regards,</p>
      <p style="margin: 0 0 4px 0; font-weight: 600;">${finalSenderName}</p>
      <p style="margin: 0; color: #64748b; font-size: 14px;">${finalSenderCompany}</p>
    </div>
  </div>
  
  <div style="text-align: center; margin-top: 16px; color: #94a3b8; font-size: 12px;">
    <p>${sender_context || 'Sent via Compliance Compass'}</p>
  </div>
</body>
</html>
    `;

    // Send email via Resend
    console.log(`[send-generic-email] Sending email to: ${to_email}`);
    
    const emailResponse = await resend.emails.send({
      from: `${finalSenderCompany} <compliance@tracer2c.com>`,
      to: [to_email],
      subject: subject,
      html: emailHtml,
    });

    console.log(`[send-generic-email] ✓ Email sent:`, JSON.stringify(emailResponse));

    // Log to auth_audit_logs for tracking
    await supabase.from("auth_audit_logs").insert({
      user_id: user.id,
      user_email: user.email,
      action: "generic_email_sent",
      metadata: {
        to_email,
        to_name,
        subject,
        sender_name: finalSenderName,
        sender_company: finalSenderCompany,
        email_id: emailResponse?.data?.id,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Email sent successfully to ${to_email}`,
        email_id: emailResponse?.data?.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[send-generic-email] Unhandled error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message, 
        stack: error.stack 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);