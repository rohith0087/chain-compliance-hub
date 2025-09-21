import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InvitationRequest {
  emails: string[];
  subject: string;
  customMessage?: string;
  buyerData: {
    name: string;
    company: string;
    email: string;
    industry?: string;
    buyerId: string;
  };
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { emails, subject, customMessage, buyerData }: InvitationRequest = await req.json();

    if (!emails || emails.length === 0) {
      throw new Error("No email addresses provided");
    }

    const signupUrl = "https://d13fec6e-29ed-4735-a9d4-57941fe886cc.lovableproject.com";
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Supplier Platform Invitation</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f9fafb; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; }
            .header { background: linear-gradient(135deg, #2563eb, #4f46e5); color: white; padding: 32px 24px; text-align: center; }
            .content { padding: 32px 24px; }
            .buyer-card { background: linear-gradient(to right, #eff6ff, #e0e7ff); border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .buyer-id { background-color: #dbeafe; color: #1e40af; padding: 8px 12px; border-radius: 4px; font-family: monospace; font-weight: bold; display: inline-block; margin: 10px 0; }
            .cta-button { display: inline-block; background: linear-gradient(135deg, #2563eb, #4f46e5); color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
            .steps { background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .step { margin: 10px 0; padding-left: 20px; position: relative; }
            .step::before { content: counter(step-counter); counter-increment: step-counter; position: absolute; left: 0; top: 0; background: #2563eb; color: white; border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; }
            .steps { counter-reset: step-counter; }
            .footer { background-color: #f8fafc; padding: 24px; text-align: center; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>You're Invited to Join Our Supplier Network</h1>
              <p>Connect with ${buyerData.company} and expand your business opportunities</p>
            </div>
            
            <div class="content">
              <h2>Hello!</h2>
              <p><strong>${buyerData.name}</strong> from <strong>${buyerData.company}</strong> would like to connect with you on our supplier platform.</p>
              
              ${customMessage ? `<div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0; border-radius: 4px;">
                <h3 style="margin: 0 0 8px 0; color: #92400e;">Personal Message:</h3>
                <p style="margin: 0; color: #92400e;">${customMessage}</p>
              </div>` : ''}
              
              <div class="buyer-card">
                <h3 style="margin: 0 0 16px 0; color: #1e40af;">Company Details</h3>
                <table style="width: 100%; font-size: 14px;">
                  <tr><td style="padding: 4px 0;"><strong>Company:</strong></td><td style="padding: 4px 0;">${buyerData.company}</td></tr>
                  <tr><td style="padding: 4px 0;"><strong>Contact Person:</strong></td><td style="padding: 4px 0;">${buyerData.name}</td></tr>
                  <tr><td style="padding: 4px 0;"><strong>Email:</strong></td><td style="padding: 4px 0;">${buyerData.email}</td></tr>
                  ${buyerData.industry ? `<tr><td style="padding: 4px 0;"><strong>Industry:</strong></td><td style="padding: 4px 0;">${buyerData.industry}</td></tr>` : ''}
                </table>
                
                <div style="margin-top: 16px;">
                  <strong>Buyer ID for Direct Connection:</strong><br>
                  <span class="buyer-id">${buyerData.buyerId}</span>
                </div>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${signupUrl}" class="cta-button">Join the Platform Now</a>
              </div>
              
              <div class="steps">
                <h3 style="margin: 0 0 16px 0;">How to Get Started:</h3>
                <div class="step">Click the "Join the Platform Now" button above</div>
                <div class="step">Create your supplier account with your company details</div>
                <div class="step">Once registered, use the Buyer ID <strong>${buyerData.buyerId}</strong> to send a connection request</div>
                <div class="step">Start collaborating and manage compliance documents together</div>
              </div>
              
              <p><strong>Benefits of joining:</strong></p>
              <ul style="color: #374151;">
                <li>Streamlined compliance document management</li>
                <li>Direct communication with buyers</li>
                <li>Secure document sharing and tracking</li>
                <li>Professional supplier network access</li>
              </ul>
              
              <p>If you have any questions, feel free to reach out to ${buyerData.name} at <a href="mailto:${buyerData.email}">${buyerData.email}</a>.</p>
            </div>
            
            <div class="footer">
              <p>This invitation was sent by ${buyerData.company} via our supplier compliance platform.</p>
              <p>If you didn't expect this invitation, you can safely ignore this email.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const results = [];
    
    for (const email of emails) {
      try {
        const emailResponse = await resend.emails.send({
          from: "Compliance Platform <no-reply@tracer2c.com>",
          to: [email],
          subject: subject,
          html: htmlContent,
        });

        results.push({ email, success: true, id: emailResponse.data?.id });
        console.log(`Email sent successfully to ${email}:`, emailResponse);
      } catch (error) {
        console.error(`Failed to send email to ${email}:`, error);
        results.push({ email, success: false, error: error.message });
      }
    }

    return new Response(JSON.stringify({ 
      message: "Invitations processed", 
      results,
      totalSent: results.filter(r => r.success).length,
      totalFailed: results.filter(r => !r.success).length
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-supplier-invitation function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);