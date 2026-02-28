import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { Resend } from "npm:resend@2.0.0";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/corsHeaders.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimiter.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface NotificationRequest {
  action: 'ticket_created' | 'ticket_resolved';
  ticketId: string;
  ticketSubject: string;
  ticketDescription?: string;
  ticketPriority: string;
  ticketSource: string;
  resolutionNotes?: string;
  userEmail?: string;
  userName?: string;
  companyId?: string;
  companyName?: string;
  companyType?: string;
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  try {
    // Authenticate user via JWT
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

    // Rate limit: 5 ticket notifications per minute per user
    const { allowed, retryAfterMs } = checkRateLimit(`ticket:${userId}`, 5, 60_000);
    if (!allowed) {
      return rateLimitResponse(corsHeaders, retryAfterMs);
    }

    // Use service role for admin queries
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const request: NotificationRequest = await req.json();

    if (request.action === 'ticket_created') {
      const { data: admins, error: adminError } = await supabase
        .from('platform_administrators')
        .select('id, auth_user_id, email, full_name')
        .eq('is_active', true);

      if (adminError) throw adminError;

      const emailPromises = (admins || []).map(async (admin) => {
        if (!admin.email) return null;

        const priorityColor = {
          low: '#22c55e',
          medium: '#3b82f6',
          high: '#f59e0b',
          urgent: '#ef4444'
        }[request.ticketPriority] || '#6b7280';

        const isUrgent = request.ticketPriority === 'urgent' || request.ticketPriority === 'high';
        const companyTypeDisplay = request.companyType === 'buyer' ? 'Buyer' : request.companyType === 'supplier' ? 'Supplier' : 'User';
        const ticketRef = request.ticketId.slice(0, 8).toUpperCase();
        const submittedAt = new Date().toLocaleString('en-US', { 
          weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', 
          hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
        });

        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px; border-radius: 12px 12px 0 0;">
              <h1 style="color: #22d3ee; margin: 0; font-size: 24px;">🎫 New Support Ticket</h1>
              ${isUrgent ? `<div style="background: #ef4444; color: white; padding: 8px 16px; border-radius: 6px; margin-top: 16px; font-weight: bold; display: inline-block;">⚠️ REQUIRES IMMEDIATE ATTENTION</div>` : ''}
            </div>
            <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0;">
              <div style="margin-bottom: 16px;">
                <span style="background: ${priorityColor}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; text-transform: uppercase;">${request.ticketPriority} Priority</span>
                <span style="background: #6366f1; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; margin-left: 8px;">${request.ticketSource.replace('_', ' ')}</span>
              </div>
              <p style="color: #64748b; margin: 0 0 8px 0; font-size: 13px;">Ticket ID: <strong style="color: #1e293b;">#${ticketRef}</strong></p>
              <h2 style="color: #1e293b; margin: 0 0 20px 0; font-size: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 16px;">${request.ticketSubject}</h2>
              ${request.ticketDescription ? `<div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 20px;"><h4 style="color: #64748b; margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase;">Description</h4><p style="color: #475569; margin: 0; white-space: pre-wrap; line-height: 1.6;">${request.ticketDescription}</p></div>` : ''}
              <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                <h3 style="color: #64748b; margin: 0 0 12px 0; font-size: 12px; text-transform: uppercase;">Submitted By</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr><td style="color: #64748b; padding: 4px 0; width: 80px; font-size: 13px;">Name:</td><td style="color: #1e293b; padding: 4px 0; font-weight: 500; font-size: 13px;">${request.userName || 'Guest User'}</td></tr>
                  <tr><td style="color: #64748b; padding: 4px 0; font-size: 13px;">Email:</td><td style="color: #1e293b; padding: 4px 0; font-size: 13px;">${request.userEmail || 'No email provided'}</td></tr>
                  <tr><td style="color: #64748b; padding: 4px 0; font-size: 13px;">Type:</td><td style="padding: 4px 0;"><span style="background: ${request.companyType === 'buyer' ? '#3b82f6' : '#10b981'}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500;">${companyTypeDisplay}</span></td></tr>
                  ${request.companyName ? `<tr><td style="color: #64748b; padding: 4px 0; font-size: 13px;">Company:</td><td style="color: #1e293b; padding: 4px 0; font-weight: 500; font-size: 13px;">${request.companyName}</td></tr>` : ''}
                </table>
              </div>
              <p style="color: #94a3b8; font-size: 12px; margin: 0 0 20px 0;">📅 Submitted: ${submittedAt}</p>
              <div style="text-align: center;"><a href="https://compliance.tracer2c.com/platform-admin/dashboard" style="display: inline-block; background: linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%); color: #1a1a2e; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">Review & Respond →</a></div>
            </div>
            <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 20px;">This is an automated notification from Tracer2C Support System</p>
          </div>
        `;

        try {
          const urgentPrefix = isUrgent ? '🚨 ' : '';
          return await resend.emails.send({
            from: "Support <support@tracer2c.com>",
            to: [admin.email],
            subject: `${urgentPrefix}New Ticket #${ticketRef}: ${request.ticketSubject} [${request.ticketPriority.toUpperCase()}]`,
            html: emailHtml,
          });
        } catch (emailError) {
          console.error(`Failed to send email to admin:`, emailError);
          return null;
        }
      });

      await Promise.all(emailPromises);

    } else if (request.action === 'ticket_resolved') {
      const emailsToSend: string[] = [];
      const usersForInAppNotification: { profile_id: string; email: string }[] = [];

      if (request.userEmail) {
        emailsToSend.push(request.userEmail);
      }

      if (request.companyId && request.companyType) {
        const { data: companyUsers } = await supabase
          .from('company_users')
          .select('profile_id')
          .eq('company_id', request.companyId)
          .eq('company_type', request.companyType)
          .eq('status', 'active');

        if (companyUsers && companyUsers.length > 0) {
          const profileIds = companyUsers.map(u => u.profile_id);
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, email')
            .in('id', profileIds);

          if (profiles) {
            for (const profile of profiles) {
              if (profile.email && !emailsToSend.includes(profile.email)) {
                emailsToSend.push(profile.email);
              }
              usersForInAppNotification.push({ profile_id: profile.id, email: profile.email });
            }
          }
        }
      }

      const emailPromises = emailsToSend.map(async (email) => {
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 30px; border-radius: 12px 12px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 24px;">✅ Ticket Resolved</h1>
            </div>
            <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0;">
              <h2 style="color: #1e293b; margin: 0 0 20px 0; font-size: 20px;">${request.ticketSubject}</h2>
              ${request.resolutionNotes ? `<div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 16px; margin-bottom: 20px;"><h3 style="color: #047857; margin: 0 0 8px 0; font-size: 14px;">Resolution Notes</h3><p style="color: #065f46; margin: 0; white-space: pre-wrap;">${request.resolutionNotes}</p></div>` : `<div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 16px; margin-bottom: 20px;"><p style="color: #065f46; margin: 0;">Your support ticket has been resolved by our team.</p></div>`}
              <p style="color: #64748b; margin: 20px 0;">If you have any further questions or if the issue persists, please don't hesitate to submit a new ticket.</p>
              <div style="text-align: center; margin-top: 24px;"><a href="https://compliance.tracer2c.com" style="display: inline-block; background: #10b981; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Return to Application →</a></div>
            </div>
            <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 20px;">Thank you for using Tracer2C Support</p>
          </div>
        `;

        try {
          return await resend.emails.send({
            from: "Support <support@tracer2c.com>",
            to: [email],
            subject: `✅ Your Support Ticket Has Been Resolved: ${request.ticketSubject}`,
            html: emailHtml,
          });
        } catch (emailError) {
          console.error(`Failed to send resolution email:`, emailError);
          return null;
        }
      });

      await Promise.all(emailPromises);

      if (usersForInAppNotification.length > 0) {
        const notificationPromises = usersForInAppNotification.map(async (user) => {
          try {
            await supabase.from('notifications').insert({
              user_id: user.profile_id,
              type: 'ticket_resolved',
              title: 'Support Ticket Resolved',
              message: `Your ticket "${request.ticketSubject}" has been resolved.${request.resolutionNotes ? ` Notes: ${request.resolutionNotes.substring(0, 100)}...` : ''}`,
              reference_id: request.ticketId,
              reference_type: 'support_ticket',
            });
          } catch (err) {
            console.error(`Error creating notification:`, err);
          }
        });
        await Promise.all(notificationPromises);
      }
    }

    return new Response(
      JSON.stringify({ success: true, action: request.action }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in send-ticket-notification:", error.message);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
