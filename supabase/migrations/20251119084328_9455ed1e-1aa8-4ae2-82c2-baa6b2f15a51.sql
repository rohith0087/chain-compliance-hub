-- Fix RLS policy to allow suppliers to view buyers with pending connections
-- This allows suppliers to see who sent them onboarding invitations

CREATE OR REPLACE FUNCTION public.supplier_can_view_buyer(buyer_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Suppliers can view buyers if:
  -- 1. They have an approved connection, OR
  -- 2. They have a pending connection that was initiated by the buyer (onboarding invitation)
  RETURN EXISTS (
    SELECT 1 
    FROM buyer_supplier_connections bsc
    JOIN suppliers s ON s.id = bsc.supplier_id
    WHERE bsc.buyer_id = supplier_can_view_buyer.buyer_id
      AND s.profile_id = auth.uid()
      AND (
        bsc.status = 'approved' 
        OR (bsc.status = 'pending' AND bsc.initiated_by = 'buyer')
      )
  );
END;
$function$;