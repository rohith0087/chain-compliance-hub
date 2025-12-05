-- Create buyer notification settings table
CREATE TABLE IF NOT EXISTS buyer_notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
  
  -- Threshold settings (days before expiry)
  expiring_soon_days INTEGER NOT NULL DEFAULT 30,
  urgent_days INTEGER NOT NULL DEFAULT 14,
  overdue_threshold_days INTEGER NOT NULL DEFAULT 0,
  
  -- Notification limits
  max_notifications_per_document INTEGER NOT NULL DEFAULT 3,
  
  -- Channel settings per tier
  expires_soon_in_app BOOLEAN NOT NULL DEFAULT true,
  expires_soon_email BOOLEAN NOT NULL DEFAULT false,
  
  urgent_in_app BOOLEAN NOT NULL DEFAULT true,
  urgent_email BOOLEAN NOT NULL DEFAULT true,
  
  overdue_in_app BOOLEAN NOT NULL DEFAULT true,
  overdue_email BOOLEAN NOT NULL DEFAULT true,
  
  -- Enable/disable entire system
  enabled BOOLEAN NOT NULL DEFAULT true,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(buyer_id)
);

-- Create document expiry notification tracking table
CREATE TABLE IF NOT EXISTS document_expiry_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_upload_id UUID NOT NULL REFERENCES document_uploads(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  
  notification_tier TEXT NOT NULL CHECK (notification_tier IN ('expires_soon', 'urgent', 'overdue')),
  channel TEXT NOT NULL CHECK (channel IN ('in_app', 'email')),
  
  document_name TEXT,
  expiration_date DATE,
  days_until_expiry INTEGER,
  
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Prevent duplicate notifications for same document/tier/channel
  UNIQUE(document_upload_id, notification_tier, channel)
);

-- Enable RLS
ALTER TABLE buyer_notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_expiry_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for buyer_notification_settings
CREATE POLICY "Buyers can manage their notification settings"
ON buyer_notification_settings FOR ALL
USING (buyer_id IN (
  SELECT id FROM buyers WHERE profile_id = auth.uid()
  UNION
  SELECT company_id FROM company_users 
  WHERE profile_id = auth.uid() 
  AND company_type = 'buyer' 
  AND status = 'active'
  AND role IN ('company_admin', 'branch_manager')
));

-- RLS Policies for document_expiry_notifications
CREATE POLICY "Buyers can view expiry notifications"
ON document_expiry_notifications FOR SELECT
USING (buyer_id IN (
  SELECT id FROM buyers WHERE profile_id = auth.uid()
  UNION
  SELECT company_id FROM company_users 
  WHERE profile_id = auth.uid() 
  AND company_type = 'buyer' 
  AND status = 'active'
));

CREATE POLICY "System can insert expiry notifications"
ON document_expiry_notifications FOR INSERT
WITH CHECK (true);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_document_expiry_notifications_buyer ON document_expiry_notifications(buyer_id);
CREATE INDEX IF NOT EXISTS idx_document_expiry_notifications_document ON document_expiry_notifications(document_upload_id);
CREATE INDEX IF NOT EXISTS idx_document_expiry_notifications_tier ON document_expiry_notifications(notification_tier);

-- Trigger for updated_at
CREATE TRIGGER update_buyer_notification_settings_updated_at
BEFORE UPDATE ON buyer_notification_settings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();