-- Add per-document review columns to onboarding_document_submissions
ALTER TABLE onboarding_document_submissions 
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS previous_submission_id UUID REFERENCES onboarding_document_submissions(id);

-- Add check constraint for status values
ALTER TABLE onboarding_document_submissions 
  DROP CONSTRAINT IF EXISTS onboarding_document_submissions_status_check;

ALTER TABLE onboarding_document_submissions 
  ADD CONSTRAINT onboarding_document_submissions_status_check 
  CHECK (status IN ('pending', 'approved', 'rejected', 'resubmitted'));

-- Update existing submissions to 'pending' status
UPDATE onboarding_document_submissions 
SET status = 'pending' 
WHERE status IS NULL;

-- Add 'partially_approved' and 'requested' to supplier_onboarding_requests status constraint
ALTER TABLE supplier_onboarding_requests 
  DROP CONSTRAINT IF EXISTS supplier_onboarding_requests_status_check;

ALTER TABLE supplier_onboarding_requests 
  ADD CONSTRAINT supplier_onboarding_requests_status_check 
  CHECK (status IN ('invited', 'pending', 'requested', 'onboarding_initiated', 'under_review', 'partially_approved', 'approved', 'rejected', 'cancelled', 'expired'));

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_onboarding_submissions_status 
  ON onboarding_document_submissions(status);

CREATE INDEX IF NOT EXISTS idx_onboarding_submissions_requirement 
  ON onboarding_document_submissions(requirement_id);