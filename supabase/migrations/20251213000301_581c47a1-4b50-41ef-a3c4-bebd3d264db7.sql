-- Add RLS policy to allow buyers to view suppliers with pending incoming connection requests
CREATE POLICY "Buyers can view suppliers with pending connection requests"
ON public.suppliers
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT DISTINCT supplier_id 
    FROM buyer_supplier_connections 
    WHERE supplier_id IS NOT NULL 
      AND status = 'pending'
      AND initiated_by = 'supplier'
      AND buyer_id IN (SELECT public.get_user_buyer_ids())
  )
);