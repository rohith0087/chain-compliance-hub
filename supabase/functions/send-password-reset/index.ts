import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PasswordResetRequest {
  email: string;
  name: string;
  temp_password: string;
  admin_name: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log('Password reset email function called');

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, name, temp_password, admin_name }: PasswordResetRequest = await req.json();

    console.log(`Sending password reset email to ${email}`);

    const emailResponse = await resend.emails.send({
      from: "Compliance Platform <no-reply@tracer2c.com>",
      to: [email],
      subject: "Your temporary password has been reset",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Password Reset</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.6;
              color: #333;
              background-color: #f8fafc;
              margin: 0;
              padding: 0;
            }
            .container {
              max-width: 600px;
              margin: 40px auto;
              background: white;
              border-radius: 12px;
              box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.1);
              overflow: hidden;
            }
            .header {
              background: linear-gradient(135deg, #3b82f6, #8b5cf6);
              color: white;
              padding: 40px 30px;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
              font-weight: 700;
            }
            .content {
              padding: 40px 30px;
            }
            .temp-password {
              background: #f1f5f9;
              border: 2px solid #e2e8f0;
              border-radius: 8px;
              padding: 20px;
              margin: 24px 0;
              text-align: center;
              font-family: 'Monaco', 'Consolas', monospace;
            }
            .temp-password-label {
              font-size: 14px;
              color: #64748b;
              margin-bottom: 8px;
              text-transform: uppercase;
              font-weight: 600;
              letter-spacing: 0.5px;
            }
            .temp-password-value {
              font-size: 24px;
              font-weight: bold;
              color: #1e293b;
              letter-spacing: 2px;
            }
            .warning {
              background: #fef3c7;
              border-left: 4px solid #f59e0b;
              padding: 16px;
              margin: 24px 0;
              border-radius: 4px;
            }
            .warning-title {
              font-weight: 600;
              color: #92400e;
              margin-bottom: 8px;
            }
            .instructions {
              background: #f0f9ff;
              border-left: 4px solid #0ea5e9;
              padding: 16px;
              margin: 24px 0;
              border-radius: 4px;
            }
            .instructions-title {
              font-weight: 600;
              color: #0c4a6e;
              margin-bottom: 8px;
            }
            .footer {
              background: #f8fafc;
              padding: 24px 30px;
              text-align: center;
              color: #64748b;
              font-size: 14px;
            }
            .button {
              display: inline-block;
              background: linear-gradient(135deg, #3b82f6, #8b5cf6);
              color: white;
              text-decoration: none;
              padding: 12px 24px;
              border-radius: 8px;
              font-weight: 600;
              margin: 16px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Password Reset</h1>
              <p>A platform administrator has reset your password</p>
            </div>
            
            <div class="content">
              <p>Hello <strong>${name}</strong>,</p>
              
              <p>Your password has been reset by platform administrator <strong>${admin_name}</strong>. Please use the temporary password below to log in:</p>
              
              <div class="temp-password">
                <div class="temp-password-label">Temporary Password</div>
                <div class="temp-password-value">${temp_password}</div>
              </div>
              
              <div class="warning">
                <div class="warning-title">⚠️ Important Security Notice</div>
                <ul style="margin: 8px 0; padding-left: 20px;">
                  <li>This temporary password expires in <strong>24 hours</strong></li>
                  <li>You will be required to change your password upon your next login</li>
                  <li>Do not share this password with anyone</li>
                </ul>
              </div>
              
              <div class="instructions">
                <div class="instructions-title">📝 Next Steps</div>
                <ol style="margin: 8px 0; padding-left: 20px;">
                  <li>Log in using your email and the temporary password above</li>
                  <li>You will immediately be prompted to create a new password</li>
                  <li>Choose a strong, unique password for your account</li>
                </ol>
              </div>
              
              <p>If you did not request this password reset or have any security concerns, please contact your platform administrator immediately.</p>
              
              <p>Best regards,<br>
              <strong>Platform Administration Team</strong></p>
            </div>
            
            <div class="footer">
              <p>This email was sent automatically. Please do not reply to this message.</p>
              <p>If you need assistance, contact your platform administrator.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Password reset email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Password reset email sent successfully",
      email_id: emailResponse.data?.id 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error sending password reset email:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || "Failed to send password reset email"
      }),
      {
        status: 500,
        headers: { 
          "Content-Type": "application/json", 
          ...corsHeaders 
        },
      }
    );
  }
};

serve(handler);