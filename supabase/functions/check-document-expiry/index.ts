import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

interface NotificationSettings {
  buyer_id: string;
  expiring_soon_days: number;
  urgent_days: number;
  overdue_threshold_days: number;
  max_notifications_per_document: number;
  expires_soon_in_app: boolean;
  expires_soon_email: boolean;
  urgent_in_app: boolean;
  urgent_email: boolean;
  overdue_in_app: boolean;
  overdue_email: boolean;
  enabled: boolean;
}

interface ExpiringDocument {
  id: string;
  document_name: string;
  expiration_date: string;
  file_name: string;
  request_id: string;
  buyer_id: string;
  supplier_id: string;
  supplier_email: string;
  supplier_company: string;
  buyer_company: string;
  buyer_email: string;
}

const defaultSettings: Omit<NotificationSettings, 'buyer_id'> = {
  expiring_soon_days: 30,
  urgent_days: 14,
  overdue_threshold_days: 0,
  max_notifications_per_document: 3,
  expires_soon_in_app: true,
  expires_soon_email: false,
  urgent_in_app: true,
  urgent_email: true,
  overdue_in_app: true,
  overdue_email: true,
  enabled: true,
};

function determineTier(daysUntilExpiry: number, settings: NotificationSettings): 'expires_soon' | 'urgent' | 'overdue' | null {
  if (daysUntilExpiry <= settings.overdue_threshold_days) {
    return 'overdue';
  } else if (daysUntilExpiry <= settings.urgent_days) {
    return 'urgent';
  } else if (daysUntilExpiry <= settings.expiring_soon_days) {
    return 'expires_soon';
  }
  return null;
}

function getEmailTemplate(tier: string, doc: ExpiringDocument, daysUntilExpiry: number): { subject: string; html: string } {
  const baseStyles = `
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    max-width: 600px;
    margin: 0 auto;
    padding: 20px;
  `;

  if (tier === 'expires_soon') {
    return {
      subject: `Reminder: "${doc.document_name}" expires in ${daysUntilExpiry} days`,
      html: `
        <div style="${baseStyles}">
          <div style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); padding: 30px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">📄 Document Expiry Reminder</h1>
          </div>
          <div style="background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="color: #334155; font-size: 16px; line-height: 1.6;">
              Hello,
            </p>
            <p style="color: #334155; font-size: 16px; line-height: 1.6;">
              This is a friendly reminder that the following document will expire soon:
            </p>
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <p style="margin: 0 0 10px 0;"><strong>Document:</strong> ${doc.document_name || doc.file_name}</p>
              <p style="margin: 0 0 10px 0;"><strong>Expires:</strong> ${new Date(doc.expiration_date).toLocaleDateString()}</p>
              <p style="margin: 0 0 10px 0;"><strong>Days Remaining:</strong> ${daysUntilExpiry}</p>
              <p style="margin: 0;"><strong>Buyer:</strong> ${doc.buyer_company}</p>
            </div>
            <p style="color: #334155; font-size: 16px; line-height: 1.6;">
              Please ensure you upload an updated document before the expiration date to maintain compliance.
            </p>
            <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
              Best regards,<br>
              ${doc.buyer_company} Compliance Team
            </p>
          </div>
        </div>
      `
    };
  } else if (tier === 'urgent') {
    return {
      subject: `⚠️ ACTION REQUIRED: "${doc.document_name}" expires in ${daysUntilExpiry} days`,
      html: `
        <div style="${baseStyles}">
          <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 30px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">⚠️ Urgent: Document Expiring Soon</h1>
          </div>
          <div style="background: #fffbeb; padding: 30px; border: 2px solid #f59e0b; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="color: #92400e; font-size: 16px; line-height: 1.6; font-weight: 600;">
              Action Required: Your document is expiring soon!
            </p>
            <div style="background: white; border: 2px solid #fbbf24; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <p style="margin: 0 0 10px 0;"><strong>Document:</strong> ${doc.document_name || doc.file_name}</p>
              <p style="margin: 0 0 10px 0; color: #b45309;"><strong>Expires:</strong> ${new Date(doc.expiration_date).toLocaleDateString()}</p>
              <p style="margin: 0 0 10px 0; color: #b45309; font-size: 18px;"><strong>⏰ Only ${daysUntilExpiry} days remaining!</strong></p>
              <p style="margin: 0;"><strong>Buyer:</strong> ${doc.buyer_company}</p>
            </div>
            <p style="color: #92400e; font-size: 16px; line-height: 1.6;">
              Please upload a renewed document immediately to avoid any disruption to your compliance status.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://compliance.tracer2c.com/dashboard" style="background: #f59e0b; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
                Upload Updated Document
              </a>
            </div>
            <p style="color: #78716c; font-size: 14px; margin-top: 30px;">
              Best regards,<br>
              ${doc.buyer_company} Compliance Team
            </p>
          </div>
        </div>
      `
    };
  } else {
    // Overdue
    return {
      subject: `🚨 OVERDUE: "${doc.document_name}" has expired!`,
      html: `
        <div style="${baseStyles}">
          <div style="background: linear-gradient(135deg, #ef4444, #b91c1c); padding: 30px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🚨 Critical: Document Has Expired</h1>
          </div>
          <div style="background: #fef2f2; padding: 30px; border: 2px solid #ef4444; border-top: none; border-radius: 0 0 12px 12px;">
            <div style="background: #fecaca; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
              <p style="color: #991b1b; font-size: 16px; line-height: 1.6; font-weight: 700; margin: 0;">
                ⚠️ IMMEDIATE ACTION REQUIRED: This document has expired and your compliance status may be affected.
              </p>
            </div>
            <div style="background: white; border: 2px solid #ef4444; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <p style="margin: 0 0 10px 0;"><strong>Document:</strong> ${doc.document_name || doc.file_name}</p>
              <p style="margin: 0 0 10px 0; color: #dc2626;"><strong>Expired on:</strong> ${new Date(doc.expiration_date).toLocaleDateString()}</p>
              <p style="margin: 0 0 10px 0; color: #dc2626; font-size: 18px;"><strong>🚨 ${Math.abs(daysUntilExpiry)} days overdue!</strong></p>
              <p style="margin: 0;"><strong>Buyer:</strong> ${doc.buyer_company}</p>
            </div>
            <p style="color: #991b1b; font-size: 16px; line-height: 1.6;">
              This may impact your ability to do business with ${doc.buyer_company}. Please upload an updated document immediately.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://compliance.tracer2c.com/dashboard" style="background: #ef4444; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
                Upload Updated Document Now
              </a>
            </div>
            <p style="color: #78716c; font-size: 14px; margin-top: 30px;">
              If you have any questions, please contact ${doc.buyer_email}.<br><br>
              ${doc.buyer_company} Compliance Team
            </p>
          </div>
        </div>
      `
    };
  }
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.log('RESEND_API_KEY not configured, skipping email');
    return false;
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Compliance System <notifications@tracer2c.com>',
        to: [to],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      console.error('Failed to send email:', error);
      return false;
    }

    console.log(`Email sent to ${to}: ${subject}`);
    return true;
  } catch (error) {
    console.error('Email send error:', error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting document expiry check...');

    // Get only the LATEST approved upload per request (handles document renewals)
    // This uses a window function to rank uploads by created_at within each request
    const { data: latestUploads, error: latestError } = await supabase
      .rpc('get_latest_expiring_documents');

    if (latestError) {
      console.error('Error fetching latest documents via RPC:', latestError);
      // Fallback to direct query if RPC doesn't exist yet
      console.log('Falling back to direct query...');
    }

    // If RPC worked, use that data; otherwise fall back to original query with deduplication
    let documents = latestUploads;
    
    if (!documents || latestError) {
      // Fallback: Get all documents and deduplicate in JS
      const { data: allDocs, error: docsError } = await supabase
        .from('document_uploads')
        .select(`
          id,
          document_name,
          file_name,
          expiration_date,
          request_id,
          created_at,
          document_requests!inner (
            id,
            title,
            document_type,
            buyer_id,
            supplier_id,
            buyers!inner (
              id,
              company_name,
              contact_email
            ),
            suppliers!inner (
              id,
              company_name,
              contact_email
            )
          )
        `)
        .not('expiration_date', 'is', null)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      if (docsError) {
        console.error('Error fetching documents:', docsError);
        throw docsError;
      }

      // Deduplicate: keep only the latest upload per request_id
      const latestByRequest = new Map();
      for (const doc of allDocs || []) {
        if (!latestByRequest.has(doc.request_id)) {
          latestByRequest.set(doc.request_id, doc);
        }
        // Since we ordered by created_at DESC, first occurrence is the latest
      }
      documents = Array.from(latestByRequest.values());
    }

    console.log(`Found ${documents?.length || 0} latest documents with expiration dates (after deduplication)`);

    // Get all buyer notification settings
    const { data: allSettings, error: settingsError } = await supabase
      .from('buyer_notification_settings')
      .select('*');

    if (settingsError) {
      console.error('Error fetching settings:', settingsError);
    }

    const settingsMap = new Map<string, NotificationSettings>();
    allSettings?.forEach(s => settingsMap.set(s.buyer_id, s));

    // Get existing notifications to check limits (only for current/latest uploads)
    const documentIds = documents?.map(d => d.id) || [];
    const { data: existingNotifications } = await supabase
      .from('document_expiry_notifications')
      .select('document_upload_id, notification_tier, channel')
      .in('document_upload_id', documentIds.length > 0 ? documentIds : ['no-match']);

    const notificationSet = new Set(
      existingNotifications?.map(n => `${n.document_upload_id}-${n.notification_tier}-${n.channel}`) || []
    );

    const notificationCounts = new Map<string, number>();
    existingNotifications?.forEach(n => {
      const key = n.document_upload_id;
      notificationCounts.set(key, (notificationCounts.get(key) || 0) + 1);
    });

    let processedCount = 0;
    let notificationsSent = 0;

    for (const doc of documents || []) {
      const request = doc.document_requests;
      if (!request?.buyers || !request?.suppliers) continue;

      const buyerId = request.buyer_id;
      const settings = settingsMap.get(buyerId) || { ...defaultSettings, buyer_id: buyerId };

      if (!settings.enabled) continue;

      const expirationDate = new Date(doc.expiration_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      expirationDate.setHours(0, 0, 0, 0);
      
      const daysUntilExpiry = Math.ceil((expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const tier = determineTier(daysUntilExpiry, settings as NotificationSettings);

      if (!tier) continue;

      const currentCount = notificationCounts.get(doc.id) || 0;
      if (currentCount >= settings.max_notifications_per_document) {
        console.log(`Document ${doc.id} reached max notifications (${currentCount})`);
        continue;
      }

      // Use request title for better notification messages
      const documentTitle = request.title || doc.document_name || doc.file_name;

      const expiringDoc: ExpiringDocument = {
        id: doc.id,
        document_name: documentTitle,
        expiration_date: doc.expiration_date,
        file_name: doc.file_name,
        request_id: doc.request_id,
        buyer_id: buyerId,
        supplier_id: request.supplier_id,
        supplier_email: request.suppliers.contact_email,
        supplier_company: request.suppliers.company_name,
        buyer_company: request.buyers.company_name,
        buyer_email: request.buyers.contact_email,
      };

      // Check and send in-app notification
      const inAppKey = `${doc.id}-${tier}-in_app`;
      const shouldSendInApp = 
        (tier === 'expires_soon' && settings.expires_soon_in_app) ||
        (tier === 'urgent' && settings.urgent_in_app) ||
        (tier === 'overdue' && settings.overdue_in_app);

      if (shouldSendInApp && !notificationSet.has(inAppKey)) {
        // Get supplier profile_id for notification
        const { data: supplier } = await supabase
          .from('suppliers')
          .select('profile_id')
          .eq('id', expiringDoc.supplier_id)
          .single();

        if (supplier?.profile_id) {
          const tierLabels = {
            expires_soon: 'Document Expiring Soon',
            urgent: '⚠️ Urgent: Document Expiring',
            overdue: '🚨 Overdue: Document Expired'
          };

          const { error: notifError } = await supabase
            .from('notifications')
            .insert({
              user_id: supplier.profile_id,
              title: tierLabels[tier],
              message: `"${expiringDoc.document_name}" ${tier === 'overdue' ? 'has expired' : `expires in ${daysUntilExpiry} days`}. Please upload an updated document.`,
              type: `document_expiry_${tier}`,
              reference_id: doc.request_id,
            });

          if (!notifError) {
            await supabase.from('document_expiry_notifications').insert({
              document_upload_id: doc.id,
              buyer_id: buyerId,
              supplier_id: expiringDoc.supplier_id,
              notification_tier: tier,
              channel: 'in_app',
              document_name: expiringDoc.document_name,
              expiration_date: doc.expiration_date,
              days_until_expiry: daysUntilExpiry,
            });
            notificationsSent++;
            console.log(`In-app notification sent for document ${doc.id} (${tier})`);
          }
        }
      }

      // Check and send email notification
      const emailKey = `${doc.id}-${tier}-email`;
      const shouldSendEmail = 
        (tier === 'expires_soon' && settings.expires_soon_email) ||
        (tier === 'urgent' && settings.urgent_email) ||
        (tier === 'overdue' && settings.overdue_email);

      if (shouldSendEmail && !notificationSet.has(emailKey)) {
        const { subject, html } = getEmailTemplate(tier, expiringDoc, daysUntilExpiry);
        const emailSent = await sendEmail(expiringDoc.supplier_email, subject, html);

        if (emailSent) {
          await supabase.from('document_expiry_notifications').insert({
            document_upload_id: doc.id,
            buyer_id: buyerId,
            supplier_id: expiringDoc.supplier_id,
            notification_tier: tier,
            channel: 'email',
            document_name: expiringDoc.document_name,
            expiration_date: doc.expiration_date,
            days_until_expiry: daysUntilExpiry,
          });
          notificationsSent++;
          console.log(`Email notification sent for document ${doc.id} (${tier})`);
        }
      }

      processedCount++;
    }

    console.log(`Processed ${processedCount} documents, sent ${notificationsSent} notifications`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        notificationsSent,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in check-document-expiry:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
