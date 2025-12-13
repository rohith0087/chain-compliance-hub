-- Add RLS policy to allow suppliers to view buyers with pending outgoing connection requests
CREATE POLICY "Suppliers can view buyers with pending outgoing connection requests"
ON public.buyers
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT DISTINCT bsc.buyer_id 
    FROM buyer_supplier_connections bsc
    JOIN suppliers s ON s.id = bsc.supplier_id
    WHERE s.profile_id = auth.uid()
      AND bsc.status = 'pending'
      AND bsc.initiated_by = 'supplier'
  )
);