import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ============================================
    // Auth validation
    // ============================================
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Invalid authentication:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authenticated user for invitation');

    const { emails, subject, customMessage, buyerData }: InvitationRequest = await req.json();

    if (!emails || emails.length === 0) {
      throw new Error("No email addresses provided");
    }

    // ============================================
    // Validate user has access to the buyer company
    // ============================================
    let hasAccess = false;

    // Check if user is buyer owner
    const { data: buyer } = await supabase
      .from('buyers')
      .select('id')
      .eq('profile_id', user.id)
      .eq('id', buyerData.buyerId)
      .single();
    
    if (buyer) {
      hasAccess = true;
    } else {
      // Check if user is team member
      const { data: companyUser } = await supabase
        .from('company_users')
        .select('id, role')
        .eq('profile_id', user.id)
        .eq('company_id', buyerData.buyerId)
        .eq('company_type', 'buyer')
        .eq('status', 'active')
        .single();

      if (companyUser) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      console.error('User does not have access to buyer:', buyerData.buyerId);
      return new Response(
        JSON.stringify({ error: 'Unauthorized: No access to this buyer company' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Access validated for buyer:', buyerData.buyerId);

    const signupUrl = "https://compliance.tracer2c.com";
    
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
            .content { padding: 32px 24px; color: #1f2937; }
            .buyer-id { background-color: #dbeafe; color: #1e40af; padding: 12px 16px; border-radius: 6px; font-family: monospace; font-weight: bold; font-size: 18px; display: inline-block; margin: 16px 0; letter-spacing: 1px; }
            .cta-button { display: inline-block; background: linear-gradient(135deg, #2563eb, #4f46e5); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; margin: 24px 0; font-weight: bold; font-size: 16px; }
            .instructions { background-color: #f0f9ff; border-left: 4px solid #2563eb; padding: 20px; margin: 24px 0; border-radius: 4px; }
            .footer { background-color: #f8fafc; padding: 24px; text-align: center; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>You're Invited to Join Tracer2c Compliance Platform</h1>
              <p style="margin: 8px 0 0 0; font-size: 18px;">Connect with ${buyerData.company} as a supplier</p>
            </div>
            
            <div class="content">
              <h2>Hello!</h2>
              <p style="font-size: 16px; line-height: 1.6;"><strong>${buyerData.company}</strong> has invited you to join our supplier compliance platform.</p>
              
              <div class="instructions">
                <h3 style="margin: 0 0 16px 0; color: #1e40af;">How to Get Started:</h3>
                <ol style="margin: 0; padding-left: 20px; line-height: 1.8;">
                  <li>Click the "Sign Up Now" button below</li>
                  <li>Create your supplier account with your company details</li>
                  <li>Use this Buyer ID to connect: <strong style="color: #1e40af;">${buyerData.buyerId}</strong></li>
                  <li>Start collaborating on compliance documents</li>
                </ol>
              </div>
              
              <div style="text-align: center; margin: 32px 0;">
                <div style="margin-bottom: 16px;">
                  <strong style="font-size: 14px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px;">Buyer ID</strong><br>
                  <span class="buyer-id">${buyerData.buyerId}</span>
                </div>
                <a href="${signupUrl}" class="cta-button">Sign Up Now</a>
                <p style="font-size: 14px; color: #6b7280; margin-top: 12px;">
                  Can't see the button? Copy and paste this link in your browser:<br>
                  <a href="${signupUrl}" style="color: #2563eb; word-break: break-all;">${signupUrl}</a>
                </p>
              </div>
              
              <div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 20px; margin: 24px 0; border-radius: 4px;">
                <h3 style="margin: 0 0 12px 0; color: #166534;">📹 Watch Our Onboarding Guide</h3>
                <p style="margin: 0 0 12px 0; font-size: 14px; color: #374151; line-height: 1.6;">
                  New to the platform? Watch this quick video to learn how to complete your supplier onboarding:
                </p>
                <a href="https://www.canva.com/design/DAG7Wju59_4/JjRSFhDtJJNMIRcokuQIJQ/watch" style="color: #2563eb; font-weight: bold; word-break: break-all;">
                  https://www.canva.com/design/DAG7Wju59_4/JjRSFhDtJJNMIRcokuQIJQ/watch
                </a>
              </div>
              
              <p style="font-size: 14px; color: #6b7280; line-height: 1.6;">If you have questions, contact ${buyerData.company} at <a href="mailto:${buyerData.email}" style="color: #2563eb;">${buyerData.email}</a>.</p>
            </div>
            
            <div class="footer">
              <p>This invitation was sent by ${buyerData.company}.</p>
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
        console.log(`Email sent successfully`);
      } catch (error) {
        console.error('Failed to send invitation email:', error);
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
