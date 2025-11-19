-- Add 'requested' status to supplier_onboarding_requests if needed
-- This allows buyers to send connection requests that appear in the pipeline

-- The status will automatically be valid since we're not using an enum constraint
-- Just documenting the new status value for clarity:
-- 'requested' = Connection request sent, waiting for supplier to accept
-- 'pending' = Supplier accepted, now in onboarding (Invited stage)
-- 'onboarding_initiated' = Supplier started onboarding
-- 'under_review' = Onboarding under review
-- 'approved' = Onboarding approved
-- 'rejected' = Onboarding rejected/declined

-- Create a function to auto-update onboarding request status when connection is approved
CREATE OR REPLACE FUNCTION sync_connection_approval_to_onboarding()
RETURNS TRIGGER AS $$
BEGIN
  -- When connection status changes to 'approved', update linked onboarding request
  IF NEW.status = 'approved' AND OLD.status = 'pending' AND NEW.onboarding_request_id IS NOT NULL THEN
    UPDATE supplier_onboarding_requests
    SET status = 'pending',  -- Move from 'requested' to 'pending' (Invited stage)
        updated_at = now()
    WHERE id = NEW.onboarding_request_id
      AND status = 'requested';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to sync connection approval to onboarding
DROP TRIGGER IF EXISTS trigger_sync_connection_approval ON buyer_supplier_connections;
CREATE TRIGGER trigger_sync_connection_approval
  AFTER UPDATE ON buyer_supplier_connections
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION sync_connection_approval_to_onboarding();