import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UserInvitationRequest {
  recipientEmail: string;
  companyName: string;
  companyType: string;
  branchName: string;
  role: string;
  inviterName: string;
  inviterEmail: string;
  signupUrl?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      recipientEmail, 
      companyName, 
      companyType,
      branchName,
      role, 
      inviterName, 
      inviterEmail,
      signupUrl = "https://edwerzutsknhuplidhsj.supabase.co/auth"
    }: UserInvitationRequest = await req.json();

    console.log("Sending user invitation to:", recipientEmail);

    const roleDisplayName = role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const companyTypeDisplay = companyType === 'buyer' ? 'Buyer Company' : 'Supplier Company';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Invitation to Join ${companyName}</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
            <h1 style="color: white; margin: 0; font-size: 28px;">You're Invited!</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Join ${companyName} as a team member</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
            <h2 style="color: #333; margin-top: 0;">Invitation Details</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; font-weight: 600; color: #555;">Company:</td>
                <td style="padding: 8px 0;">${companyName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: 600; color: #555;">Type:</td>
                <td style="padding: 8px 0;">${companyTypeDisplay}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: 600; color: #555;">Branch:</td>
                <td style="padding: 8px 0;">${branchName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: 600; color: #555;">Role:</td>
                <td style="padding: 8px 0;">${roleDisplayName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: 600; color: #555;">Invited by:</td>
                <td style="padding: 8px 0;">${inviterName} (${inviterEmail})</td>
              </tr>
            </table>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${signupUrl}" 
               style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
              Accept Invitation & Join
            </a>
          </div>

          <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; border-left: 4px solid #2196f3;">
            <h3 style="color: #1976d2; margin-top: 0;">Next Steps:</h3>
            <ol style="margin: 0; padding-left: 20px;">
              <li>Click the "Accept Invitation" button above</li>
              <li>Create your account or sign in if you already have one</li>
              <li>Complete your profile setup</li>
              <li>Start collaborating with your new team!</li>
            </ol>
          </div>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666;">
            <p><strong>Need help?</strong> Contact your team administrator ${inviterName} at ${inviterEmail}</p>
            <p style="margin-bottom: 0;">This invitation was sent to ${recipientEmail}. If you didn't expect this invitation, you can safely ignore this email.</p>
          </div>
        </body>
      </html>
    `;

    const emailResponse = await resend.emails.send({
      from: "Compliance Platform <no-reply@yourdomain.com>", // Update this to your verified domain
      to: [recipientEmail],
      subject: `Invitation to join ${companyName} - ${branchName}`,
      html: htmlContent,
    });

    console.log("User invitation email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ 
      success: true, 
      messageId: emailResponse.data?.id,
      message: "Invitation email sent successfully" 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error sending user invitation:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || "Failed to send invitation email" 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);