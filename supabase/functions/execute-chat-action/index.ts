import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { Resend } from "npm:resend@2.0.0";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/corsHeaders.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimiter.ts";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const supabase = createClient(
  SUPABASE_URL,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface ActionRequest {
  action_type: string;
  parameters: Record<string, any>;
  session_id: string;
  context: Record<string, any>;
}

interface ActionResult {
  success: boolean;
  message: string;
  data?: any;
  emails_sent?: number;
  notifications_sent?: number;
}

// Same implementation as send-user-invitation; no shared helper exists in _shared.
function escapeHtml(value: string): string {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character] ?? character);
}

// Strip CR/LF so user input cannot inject extra email headers via the subject line.
function sanitizeEmailSubject(value: string): string {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').slice(0, 200);
}

type DbClient = ReturnType<typeof createClient>;

// Same buyer resolution used by audit-assistant.
async function resolveBuyerId(sb: DbClient, userId: string): Promise<string | null> {
  const { data: tm } = await sb
    .from("company_users")
    .select("company_id")
    .eq("profile_id", userId)
    .eq("company_type", "buyer")
    .eq("status", "active")
    .maybeSingle();
  if (tm?.company_id) return tm.company_id as string;
  const { data: owner } = await sb.from("buyers").select("id").eq("profile_id", userId).maybeSingle();
  return (owner?.id as string) ?? null;
}

async function hasApprovedConnection(sb: DbClient, buyerId: string, supplierId: string): Promise<boolean> {
  const { data } = await sb
    .from('buyer_supplier_connections')
    .select('id')
    .eq('buyer_id', buyerId)
    .eq('supplier_id', supplierId)
    .eq('status', 'approved')
    .maybeSingle();
  return !!data;
}

async function findSupplierIdByEmail(sb: DbClient, email: string): Promise<string | null> {
  const { data } = await sb
    .from('suppliers')
    .select('id')
    .eq('contact_email', email)
    .maybeSingle();
  return (data?.id as string) ?? null;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  try {
    // --- Authentication: require a real end-user JWT (rejects the anon key,
    // which passes the gateway's verify_jwt check but carries no user). ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, message: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const sbUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await sbUser.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ success: false, message: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const rl = checkRateLimit(`execute-chat-action:${user.id}`, 20, 60_000);
    if (!rl.allowed) return rateLimitResponse(corsHeaders, rl.retryAfterMs);

    const body: ActionRequest = await req.json();
    const { action_type, session_id, context } = body;
    let parameters = body.parameters ?? {};

    console.log('Executing action:', action_type);

    // --- Tenant resolution: chat actions are buyer-driven. ---
    const buyerId = await resolveBuyerId(supabase, user.id);
    if (!buyerId) {
      return new Response(JSON.stringify({ success: false, message: "Not a buyer account" }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // --- Per-action authorization. ---
    const forbidden = (message: string) => new Response(
      JSON.stringify({ success: false, message }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

    // Actions that target a supplier must reference a supplier with an
    // approved connection to the caller's buyer org. supplier_id is used when
    // present; otherwise the supplier is resolved from supplier_email.
    const supplierScopedActions = new Set([
      'send_follow_up_email',
      'send_document_expiry_alert',
      'request_additional_documents',
      'send_supplier_notification'
    ]);

    if (supplierScopedActions.has(action_type)) {
      let supplierId: string | null = parameters.supplier_id ? String(parameters.supplier_id) : null;
      if (!supplierId && parameters.supplier_email) {
        supplierId = await findSupplierIdByEmail(supabase, String(parameters.supplier_email));
      }
      if (!supplierId || !(await hasApprovedConnection(supabase, buyerId, supplierId))) {
        return forbidden('Supplier is not connected to your organization');
      }
      parameters = { ...parameters, supplier_id: supplierId };
    }

    if (action_type === 'create_reminder') {
      // Reminders are only ever created for the caller — never for an
      // arbitrary user_id supplied in the request body.
      parameters = { ...parameters, user_id: user.id };
    }

    if (action_type === 'generate_compliance_report') {
      if (parameters.company_id && String(parameters.company_id) !== buyerId) {
        return forbidden('Cannot generate reports for another organization');
      }
      parameters = { ...parameters, company_id: buyerId };
    }

    let result: ActionResult;

    switch (action_type) {
      case 'send_follow_up_email':
        result = await sendFollowUpEmail(parameters);
        break;

      case 'send_document_expiry_alert':
        result = await sendExpiryAlert(parameters);
        break;

      case 'create_reminder':
        result = await createReminder(parameters);
        break;

      case 'request_additional_documents':
        result = await requestAdditionalDocuments(parameters, buyerId, user.id);
        break;

      case 'generate_compliance_report':
        result = await generateComplianceReport(parameters);
        break;

      case 'schedule_meeting':
        result = await scheduleMeeting(parameters);
        break;

      case 'send_supplier_notification':
        result = await sendSupplierNotification(parameters);
        break;

      default:
        result = {
          success: false,
          message: `Unknown action type: ${action_type}`
        };
    }

    // Log the action execution
    await supabase
      .from('agent_activities')
      .insert({
        agent_type: 'buyer',
        action_type: 'execute_action',
        entity_type: 'action',
        entity_id: session_id,
        details: {
          action_type,
          parameters,
          result,
          context,
          buyer_id: buyerId,
          user_id: user.id
        },
        success: result.success
      });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Action execution error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error.message || 'Action execution failed'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function sendFollowUpEmail(params: Record<string, any>): Promise<ActionResult> {
  const { supplier_email, supplier_name, document_type, due_date, message } = params;

  try {
    const emailResponse = await resend.emails.send({
      from: "Compliance System <compliance@tracer2c.com>",
      to: [supplier_email],
      subject: `Follow-up: ${sanitizeEmailSubject(document_type)} Document Request`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3b82f6;">Document Request Follow-up</h2>

          <p>Dear ${escapeHtml(supplier_name)},</p>

          <p>We are following up on the ${escapeHtml(document_type)} document request.</p>

          ${due_date ? `<p><strong>Due Date:</strong> ${new Date(due_date).toLocaleDateString()}</p>` : ''}

          <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p>${escapeHtml(message || 'Please provide the requested document at your earliest convenience.')}</p>
          </div>

          <p>If you have any questions or need assistance, please don't hesitate to contact us.</p>

          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            This is an automated follow-up from your compliance management system.
          </p>
        </div>
      `,
    });

    return {
      success: true,
      message: `Follow-up email sent to ${supplier_name}`,
      emails_sent: 1,
      data: emailResponse
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to send follow-up email: ${error.message}`
    };
  }
}

async function sendExpiryAlert(params: Record<string, any>): Promise<ActionResult> {
  const { supplier_email, document_name, expiration_date, days_until_expiry } = params;

  try {
    const { data, error } = await supabase.functions.invoke('send-expiry-notification', {
      body: {
        supplier_email,
        buyer_email: 'compliance@company.com',
        document_name,
        expiration_date,
        days_until_expiry
      }
    });

    if (error) throw error;

    return {
      success: true,
      message: `Expiry alert sent for ${document_name}`,
      emails_sent: 1,
      data
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to send expiry alert: ${error.message}`
    };
  }
}

async function createReminder(params: Record<string, any>): Promise<ActionResult> {
  const { user_id, title, message, remind_at, type } = params;

  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id,
        title: title || 'Compliance Reminder',
        message: message || 'You have a compliance task that needs attention.',
        type: type || 'reminder'
      });

    if (error) throw error;

    return {
      success: true,
      message: 'Reminder created successfully',
      notifications_sent: 1,
      data
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to create reminder: ${error.message}`
    };
  }
}

async function requestAdditionalDocuments(params: Record<string, any>, buyerId: string, requesterId: string): Promise<ActionResult> {
  const { supplier_id, document_types, due_date, notes } = params;

  try {
    // Get supplier details
    const { data: supplier } = await supabase
      .from('suppliers')
      .select('company_name, contact_email')
      .eq('id', supplier_id)
      .single();

    if (!supplier) {
      throw new Error('Supplier not found');
    }

    // Create document requests (buyer_id/requester_id match the canonical
    // insert shape used by simple-rag-chat's createDocumentRequest).
    const requests = document_types.map((docType: string) => ({
      supplier_id,
      buyer_id: buyerId,
      requester_id: requesterId,
      document_type: docType,
      title: `${docType} Request`,
      description: notes || `Please provide your ${docType} document.`,
      due_date,
      status: 'pending',
      category: 'compliance'
    }));

    const { data, error } = await supabase
      .from('document_requests')
      .insert(requests);

    if (error) throw error;

    // Send notification email
    await resend.emails.send({
      from: "Compliance System <compliance@tracer2c.com>",
      to: [supplier.contact_email],
      subject: `New Document Request from Your Buyer`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3b82f6;">New Document Request</h2>

          <p>Dear ${escapeHtml(supplier.company_name)},</p>

          <p>We have requested the following additional documents:</p>

          <ul>
            ${document_types.map((type: string) => `<li>${escapeHtml(type)}</li>`).join('')}
          </ul>

          ${due_date ? `<p><strong>Due Date:</strong> ${new Date(due_date).toLocaleDateString()}</p>` : ''}
          ${notes ? `<p><strong>Notes:</strong> ${escapeHtml(notes)}</p>` : ''}

          <p>Please log in to your compliance portal to upload the requested documents.</p>
        </div>
      `,
    });

    return {
      success: true,
      message: `Requested ${document_types.length} additional document(s) from ${supplier.company_name}`,
      emails_sent: 1,
      data
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to request additional documents: ${error.message}`
    };
  }
}

async function generateComplianceReport(params: Record<string, any>): Promise<ActionResult> {
  const { company_id, report_type, include_suppliers, date_range } = params;

  try {
    // This is a placeholder for report generation
    // In a real implementation, this would generate and store a compliance report

    return {
      success: true,
      message: `${report_type} compliance report generated successfully`,
      data: {
        report_id: `report_${Date.now()}`,
        type: report_type,
        generated_at: new Date().toISOString(),
        status: 'ready'
      }
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to generate compliance report: ${error.message}`
    };
  }
}

async function scheduleMeeting(params: Record<string, any>): Promise<ActionResult> {
  const { attendee_emails, subject, date, duration } = params;

  try {
    // This is a placeholder for meeting scheduling
    // In a real implementation, this would integrate with a calendar system

    return {
      success: true,
      message: `Meeting "${subject}" scheduled for ${new Date(date).toLocaleDateString()}`,
      data: {
        meeting_id: `meeting_${Date.now()}`,
        subject,
        date,
        attendees: attendee_emails,
        duration
      }
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to schedule meeting: ${error.message}`
    };
  }
}

async function sendSupplierNotification(params: Record<string, any>): Promise<ActionResult> {
  const { supplier_id, notification_type, message, urgent } = params;

  try {
    // Get supplier details
    const { data: supplier } = await supabase
      .from('suppliers')
      .select('company_name, contact_email, profile_id')
      .eq('id', supplier_id)
      .single();

    if (!supplier) {
      throw new Error('Supplier not found');
    }

    // Create in-app notification
    await supabase
      .from('notifications')
      .insert({
        user_id: supplier.profile_id,
        title: `${urgent ? 'URGENT: ' : ''}${notification_type}`,
        message,
        type: notification_type.toLowerCase().replace(/\s+/g, '_')
      });

    // Send email if urgent
    if (urgent) {
      await resend.emails.send({
        from: "Compliance System <compliance@tracer2c.com>",
        to: [supplier.contact_email],
        subject: `URGENT: ${sanitizeEmailSubject(notification_type)}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; margin-bottom: 20px;">
              <h2 style="color: #dc2626; margin-top: 0;">URGENT NOTIFICATION</h2>
            </div>

            <p>Dear ${escapeHtml(supplier.company_name)},</p>

            <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px;">
              <p>${escapeHtml(message)}</p>
            </div>

            <p>Please take immediate action as required.</p>
          </div>
        `,
      });
    }

    return {
      success: true,
      message: `Notification sent to ${supplier.company_name}`,
      notifications_sent: 1,
      emails_sent: urgent ? 1 : 0
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to send supplier notification: ${error.message}`
    };
  }
}
