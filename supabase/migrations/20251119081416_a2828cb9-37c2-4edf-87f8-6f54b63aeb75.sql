-- Add new columns for edit/resend functionality
ALTER TABLE supplier_onboarding_requests 
ADD COLUMN IF NOT EXISTS resent_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Update check constraint for status to include expired and cancelled
ALTER TABLE supplier_onboarding_requests 
DROP CONSTRAINT IF EXISTS supplier_onboarding_requests_status_check;

ALTER TABLE supplier_onboarding_requests 
ADD CONSTRAINT supplier_onboarding_requests_status_check 
CHECK (status IN (
  'requested', 
  'pending', 
  'onboarding_initiated', 
  'under_review', 
  'approved', 
  'rejected', 
  'expired', 
  'cancelled'
));