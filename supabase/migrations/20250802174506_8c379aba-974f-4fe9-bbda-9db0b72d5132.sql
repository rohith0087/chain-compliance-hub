-- Add RLS policy to allow buyers to update connection requests sent to them
CREATE POLICY "Buyers can update connection requests sent to them"
ON public.buyer_supplier_connections
FOR UPDATE 
USING (buyer_id IN ( 
  SELECT buyers.id
  FROM buyers
  WHERE (buyers.profile_id = auth.uid())
));