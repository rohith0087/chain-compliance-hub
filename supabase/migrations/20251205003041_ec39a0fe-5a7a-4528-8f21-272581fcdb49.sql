-- Drop the old constraint
ALTER TABLE supplier_onboarding_requests 
DROP CONSTRAINT IF EXISTS supplier_onboarding_requests_status_check;

-- Add new constraint with 'invited' status
ALTER TABLE supplier_onboarding_requests 
ADD CONSTRAINT supplier_onboarding_requests_status_check 
CHECK (status = ANY (ARRAY[
  'invited'::text,
  'requested'::text,
  'pending'::text,
  'onboarding_initiated'::text,
  'under_review'::text,
  'approved'::text,
  'rejected'::text,
  'expired'::text,
  'cancelled'::text
]));