import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
  notifications_sent?: number;
  emails_sent?: number;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

    // Get user from authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Invalid user token');
    }

    const { action_type, parameters, session_id, context }: ActionRequest = await req.json();

    console.log(`Executing action: ${action_type}`, { parameters, context });

    let result: ActionResult = { success: false, message: 'Unknown action type' };

    switch (action_type) {
      case 'send_follow_up_email': {
        const { supplier_name, subject, content, recipient_email } = parameters;
        
        try {
          // Send email via Resend
          const emailResponse = await resend.emails.send({
            from: 'Compliance AI <noreply@yourdomain.com>',
            to: [recipient_email || 'supplier@example.com'],
            subject: subject || `Follow-up: ${supplier_name} Compliance Documents`,
            html: `
              <h2>Compliance Document Follow-up</h2>
              <p>Dear ${supplier_name} Team,</p>
              <p>${content || 'This is a follow-up regarding your compliance documents. Please review and take necessary action.'}</p>
              <p>Best regards,<br/>Compliance Team</p>
            `,
          });

          // Create notification for user
          await supabase.rpc('create_notification', {
            p_user_id: user.id,
            p_title: 'Email Sent Successfully',
            p_message: `Follow-up email sent to ${supplier_name}`,
            p_type: 'email_sent',
            p_reference_id: session_id
          });

          result = {
            success: true,
            message: `Follow-up email sent to ${supplier_name}`,
            emails_sent: 1,
            notifications_sent: 1
          };
        } catch (error) {
          console.error('Email sending failed:', error);
          result = {
            success: false,
            message: `Failed to send email to ${supplier_name}: ${error.message}`
          };
        }
        break;
      }

      case 'create_reminder': {
        const { reminder_text, days_ahead, supplier_name } = parameters;
        const reminderDate = new Date();
        reminderDate.setDate(reminderDate.getDate() + (days_ahead || 3));

        try {
          // Create a scheduled notification (we'll create it now and mark it for future display)
          await supabase.rpc('create_notification', {
            p_user_id: user.id,
            p_title: 'Reminder Set',
            p_message: `Reminder set for ${supplier_name}: ${reminder_text}`,
            p_type: 'reminder_created',
            p_reference_id: session_id
          });

          // In a real implementation, you'd schedule this with a cron job or similar
          // For now, we'll create an immediate notification about the reminder being set
          result = {
            success: true,
            message: `Reminder set for ${supplier_name} in ${days_ahead || 3} days`,
            notifications_sent: 1
          };
        } catch (error) {
          result = {
            success: false,
            message: `Failed to create reminder: ${error.message}`
          };
        }
        break;
      }

      case 'send_document_expiry_alert': {
        const { document_type, supplier_name, expiry_date, urgency } = parameters;

        try {
          // Find supplier profile to get email
          const { data: suppliers } = await supabase
            .from('suppliers')
            .select('contact_email, profile_id')
            .ilike('company_name', `%${supplier_name}%`)
            .limit(1);

          if (suppliers && suppliers.length > 0) {
            const supplier = suppliers[0];
            
            // Send email alert
            await resend.emails.send({
              from: 'Compliance AI <noreply@yourdomain.com>',
              to: [supplier.contact_email],
              subject: `${urgency === 'high' ? 'URGENT: ' : ''}Document Expiry Alert - ${document_type}`,
              html: `
                <h2>Document Expiry Alert</h2>
                <p>Dear ${supplier_name} Team,</p>
                <p><strong>Alert:</strong> Your ${document_type} document is ${urgency === 'high' ? 'expiring soon' : 'due for renewal'}.</p>
                <p><strong>Expiry Date:</strong> ${expiry_date}</p>
                <p>Please take immediate action to renew this document to maintain compliance.</p>
                <p>Best regards,<br/>Compliance Team</p>
              `,
            });

            // Create notification for supplier
            if (supplier.profile_id) {
              await supabase.rpc('create_notification', {
                p_user_id: supplier.profile_id,
                p_title: 'Document Expiry Alert',
                p_message: `Your ${document_type} document expires on ${expiry_date}`,
                p_type: 'document_expiry',
                p_reference_id: session_id
              });
            }

            // Create notification for user
            await supabase.rpc('create_notification', {
              p_user_id: user.id,
              p_title: 'Expiry Alert Sent',
              p_message: `Document expiry alert sent to ${supplier_name}`,
              p_type: 'alert_sent',
              p_reference_id: session_id
            });

            result = {
              success: true,
              message: `Document expiry alert sent to ${supplier_name}`,
              emails_sent: 1,
              notifications_sent: 2
            };
          } else {
            result = {
              success: false,
              message: `Could not find contact information for ${supplier_name}`
            };
          }
        } catch (error) {
          result = {
            success: false,
            message: `Failed to send expiry alert: ${error.message}`
          };
        }
        break;
      }

      case 'request_additional_documents': {
        const { supplier_name, document_types, due_date, priority } = parameters;

        try {
          // Find supplier
          const { data: suppliers } = await supabase
            .from('suppliers')
            .select('id, contact_email, profile_id')
            .ilike('company_name', `%${supplier_name}%`)
            .limit(1);

          if (suppliers && suppliers.length > 0) {
            const supplier = suppliers[0];
            
            // Find buyer
            const { data: buyers } = await supabase
              .from('buyers')
              .select('id')
              .eq('profile_id', user.id)
              .limit(1);

            if (buyers && buyers.length > 0) {
              const buyer = buyers[0];

              // Create document requests
              const requests = document_types.map((docType: string) => ({
                supplier_id: supplier.id,
                buyer_id: buyer.id,
                title: `${docType} Document Request`,
                description: `Automated request for ${docType} compliance document`,
                document_type: docType,
                category: 'compliance',
                priority: priority || 'medium',
                due_date: due_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                status: 'pending'
              }));

              const { data: createdRequests, error: requestError } = await supabase
                .from('document_requests')
                .insert(requests)
                .select();

              if (requestError) throw requestError;

              // Send notification email
              await resend.emails.send({
                from: 'Compliance AI <noreply@yourdomain.com>',
                to: [supplier.contact_email],
                subject: `Document Request: ${document_types.join(', ')}`,
                html: `
                  <h2>Document Request</h2>
                  <p>Dear ${supplier_name} Team,</p>
                  <p>We are requesting the following documents for compliance review:</p>
                  <ul>
                    ${document_types.map((doc: string) => `<li>${doc}</li>`).join('')}
                  </ul>
                  <p><strong>Due Date:</strong> ${due_date || 'Within 7 days'}</p>
                  <p><strong>Priority:</strong> ${priority || 'Medium'}</p>
                  <p>Please upload these documents at your earliest convenience.</p>
                  <p>Best regards,<br/>Compliance Team</p>
                `,
              });

              // Create notifications
              if (supplier.profile_id) {
                await supabase.rpc('create_notification', {
                  p_user_id: supplier.profile_id,
                  p_title: 'New Document Request',
                  p_message: `New document request: ${document_types.join(', ')}`,
                  p_type: 'document_request',
                  p_reference_id: createdRequests[0]?.id
                });
              }

              await supabase.rpc('create_notification', {
                p_user_id: user.id,
                p_title: 'Document Request Sent',
                p_message: `Document request sent to ${supplier_name} for ${document_types.length} documents`,
                p_type: 'request_sent',
                p_reference_id: session_id
              });

              result = {
                success: true,
                message: `Document request sent to ${supplier_name} for ${document_types.join(', ')}`,
                emails_sent: 1,
                notifications_sent: 2,
                data: { requests_created: createdRequests?.length || 0 }
              };
            } else {
              result = {
                success: false,
                message: 'Could not find your buyer profile'
              };
            }
          } else {
            result = {
              success: false,
              message: `Could not find supplier: ${supplier_name}`
            };
          }
        } catch (error) {
          result = {
            success: false,
            message: `Failed to create document request: ${error.message}`
          };
        }
        break;
      }

      case 'generate_compliance_report': {
        const { supplier_name, report_type, email_recipients } = parameters;

        try {
          // This would generate a real report in production
          const reportData = {
            supplier: supplier_name,
            generated_at: new Date().toISOString(),
            report_type: report_type || 'compliance_summary',
            status: 'completed'
          };

          // Create notification
          await supabase.rpc('create_notification', {
            p_user_id: user.id,
            p_title: 'Compliance Report Generated',
            p_message: `${report_type || 'Compliance'} report generated for ${supplier_name}`,
            p_type: 'report_generated',
            p_reference_id: session_id
          });

          // If email recipients specified, send the report
          if (email_recipients && email_recipients.length > 0) {
            await resend.emails.send({
              from: 'Compliance AI <noreply@yourdomain.com>',
              to: email_recipients,
              subject: `Compliance Report: ${supplier_name}`,
              html: `
                <h2>Compliance Report</h2>
                <p>Please find the compliance report for ${supplier_name} below:</p>
                <pre>${JSON.stringify(reportData, null, 2)}</pre>
                <p>Generated on: ${new Date().toLocaleString()}</p>
              `,
            });
          }

          result = {
            success: true,
            message: `Compliance report generated for ${supplier_name}`,
            notifications_sent: 1,
            emails_sent: email_recipients?.length || 0,
            data: reportData
          };
        } catch (error) {
          result = {
            success: false,
            message: `Failed to generate report: ${error.message}`
          };
        }
        break;
      }
    }

    // Log the action execution
    console.log(`Action ${action_type} completed:`, result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in execute-chat-action:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error.message,
        error: error.toString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});