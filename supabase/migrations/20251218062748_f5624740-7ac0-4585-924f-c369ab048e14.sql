-- Update supplier_can_view_buyer() to support team members
CREATE OR REPLACE FUNCTION public.supplier_can_view_buyer(buyer_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_supplier_id uuid;
BEGIN
  -- Get supplier ID for current user (owner OR team member)
  v_supplier_id := get_user_supplier_id();
  
  IF v_supplier_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Suppliers can view buyers if:
  -- 1. They have an approved connection, OR
  -- 2. They have a pending connection that was initiated by the buyer
  RETURN EXISTS (
    SELECT 1 
    FROM buyer_supplier_connections bsc
    WHERE bsc.buyer_id = supplier_can_view_buyer.buyer_id
      AND bsc.supplier_id = v_supplier_id
      AND (
        bsc.status = 'approved' 
        OR (bsc.status = 'pending' AND bsc.initiated_by = 'buyer')
      )
  );
END;
$function$;

-- Update document_requests RLS policies to use get_user_supplier_id()

-- Drop and recreate "Suppliers can view requests sent to them"
DROP POLICY IF EXISTS "Suppliers can view requests sent to them" ON document_requests;
CREATE POLICY "Suppliers can view requests sent to them"
ON document_requests FOR SELECT
USING (supplier_id = get_user_supplier_id());

-- Drop and recreate "Suppliers can update requests sent to them"
DROP POLICY IF EXISTS "Suppliers can update requests sent to them" ON document_requests;
CREATE POLICY "Suppliers can update requests sent to them"
ON document_requests FOR UPDATE
USING (supplier_id = get_user_supplier_id());

-- Drop and recreate "Users can view requests they're involved in"
DROP POLICY IF EXISTS "Users can view requests they're involved in" ON document_requests;
CREATE POLICY "Users can view requests they're involved in"
ON document_requests FOR SELECT
USING (
  requester_id = auth.uid() 
  OR supplier_id = get_user_supplier_id()
);

-- Drop and recreate "Users can update requests they're involved in"
DROP POLICY IF EXISTS "Users can update requests they're involved in" ON document_requests;
CREATE POLICY "Users can update requests they're involved in"
ON document_requests FOR UPDATE
USING (
  requester_id = auth.uid() 
  OR supplier_id = get_user_supplier_id()
);