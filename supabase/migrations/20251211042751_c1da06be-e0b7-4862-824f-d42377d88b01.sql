-- Create function to get latest expiring documents (one per request)
CREATE OR REPLACE FUNCTION public.get_latest_expiring_documents()
RETURNS TABLE (
  id uuid,
  document_name text,
  file_name text,
  expiration_date date,
  request_id uuid,
  created_at timestamptz,
  document_requests jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH ranked_uploads AS (
    SELECT 
      du.id,
      du.document_name,
      du.file_name,
      du.expiration_date,
      du.request_id,
      du.created_at,
      ROW_NUMBER() OVER (PARTITION BY du.request_id ORDER BY du.created_at DESC) as rn
    FROM document_uploads du
    WHERE du.status = 'approved'
      AND du.expiration_date IS NOT NULL
  )
  SELECT 
    ru.id,
    ru.document_name,
    ru.file_name,
    ru.expiration_date,
    ru.request_id,
    ru.created_at,
    jsonb_build_object(
      'id', dr.id,
      'title', dr.title,
      'document_type', dr.document_type,
      'buyer_id', dr.buyer_id,
      'supplier_id', dr.supplier_id,
      'buyers', jsonb_build_object(
        'id', b.id,
        'company_name', b.company_name,
        'contact_email', b.contact_email
      ),
      'suppliers', jsonb_build_object(
        'id', s.id,
        'company_name', s.company_name,
        'contact_email', s.contact_email
      )
    ) as document_requests
  FROM ranked_uploads ru
  JOIN document_requests dr ON dr.id = ru.request_id
  JOIN buyers b ON b.id = dr.buyer_id
  JOIN suppliers s ON s.id = dr.supplier_id
  WHERE ru.rn = 1;
END;
$$;

-- Create trigger function to clear old expiry notifications when document is renewed
CREATE OR REPLACE FUNCTION public.clear_old_expiry_notifications_on_renewal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When a new approved document is uploaded for the same request,
  -- delete expiry notifications for older versions of the same request
  IF NEW.status = 'approved' AND NEW.request_id IS NOT NULL THEN
    DELETE FROM document_expiry_notifications
    WHERE document_upload_id IN (
      SELECT id FROM document_uploads
      WHERE request_id = NEW.request_id
        AND id != NEW.id
    );
    
    -- Log the renewal activity
    INSERT INTO document_activity_logs (
      document_upload_id,
      document_request_id,
      user_id,
      action_type,
      metadata,
      notes
    ) VALUES (
      NEW.id,
      NEW.request_id,
      NEW.uploader_id,
      'renewed',
      jsonb_build_object('previous_notifications_cleared', true),
      'Document renewed - previous version expiry notifications cleared'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for document renewal notification cleanup
DROP TRIGGER IF EXISTS clear_expiry_notifications_on_renewal ON document_uploads;
CREATE TRIGGER clear_expiry_notifications_on_renewal
  AFTER INSERT ON document_uploads
  FOR EACH ROW
  EXECUTE FUNCTION clear_old_expiry_notifications_on_renewal();

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP calls if not already enabled  
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule daily document expiry check at 8:00 AM UTC
SELECT cron.schedule(
  'check-document-expiry-daily',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://edwerzutsknhuplidhsj.supabase.co/functions/v1/check-document-expiry',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkd2VyenV0c2tuaHVwbGlkaHNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwOTU3MzYsImV4cCI6MjA2NTY3MTczNn0.zlfoc_V7IyFzmseOgfuew9Mjks_U6hrlO8XwNc_GXbI"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);