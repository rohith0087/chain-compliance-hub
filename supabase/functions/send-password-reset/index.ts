import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { Resend } from "npm:resend@2.0.0";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/corsHeaders.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimiter.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface PasswordResetRequest {
  email: string;
  name: string;
  temp_password: string;
  admin_name: string;
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  try {
    // Authenticate caller - must be an authenticated admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const userId = claimsData.claims.sub;

    // Verify caller is a platform admin
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: adminCheck } = await supabase
      .from('platform_administrators')
      .select('id')
      .eq('auth_user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    if (!adminCheck) {
      return new Response(JSON.stringify({ error: 'Forbidden: Platform admin access required' }), { status: 403, headers: corsHeaders });
    }

    // Rate limit: 5 password resets per minute per admin
    const { allowed, retryAfterMs } = checkRateLimit(`pwd-reset:${userId}`, 5, 60_000);
    if (!allowed) {
      return rateLimitResponse(corsHeaders, retryAfterMs);
    }

    const { email, name, temp_password, admin_name }: PasswordResetRequest = await req.json();

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
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background-color: #f8fafc; margin: 0; padding: 0;">
          <div style="max-width: 600px; margin: 40px auto; background: white; border-radius: 12px; box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.1); overflow: hidden;">
            <div style="background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700;">🔐 Password Reset</h1>
              <p>A platform administrator has reset your password</p>
            </div>
            <div style="padding: 40px 30px;">
              <p>Hello <strong>${name}</strong>,</p>
              <p>Your password has been reset by platform administrator <strong>${admin_name}</strong>. Please use the temporary password below to log in:</p>
              <div style="background: #f1f5f9; border: 2px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 24px 0; text-align: center; font-family: 'Monaco', 'Consolas', monospace;">
                <div style="font-size: 14px; color: #64748b; margin-bottom: 8px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Temporary Password</div>
                <div style="font-size: 24px; font-weight: bold; color: #1e293b; letter-spacing: 2px;">${temp_password}</div>
              </div>
              <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <div style="font-weight: 600; color: #92400e; margin-bottom: 8px;">⚠️ Important Security Notice</div>
                <ul style="margin: 8px 0; padding-left: 20px;">
                  <li>This temporary password expires in <strong>24 hours</strong></li>
                  <li>You will be required to change your password upon your next login</li>
                  <li>Do not share this password with anyone</li>
                </ul>
              </div>
              <div style="background: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <div style="font-weight: 600; color: #0c4a6e; margin-bottom: 8px;">📝 Next Steps</div>
                <ol style="margin: 8px 0; padding-left: 20px;">
                  <li>Log in using your email and the temporary password above</li>
                  <li>You will immediately be prompted to create a new password</li>
                  <li>Choose a strong, unique password for your account</li>
                </ol>
              </div>
              <p>If you did not request this password reset or have any security concerns, please contact your platform administrator immediately.</p>
              <p>Best regards,<br><strong>Platform Administration Team</strong></p>
            </div>
            <div style="background: #f8fafc; padding: 24px 30px; text-align: center; color: #64748b; font-size: 14px;">
              <p>This email was sent automatically. Please do not reply to this message.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Password reset email sent successfully",
      email_id: emailResponse.data?.id 
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending password reset email:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Failed to send password reset email" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
