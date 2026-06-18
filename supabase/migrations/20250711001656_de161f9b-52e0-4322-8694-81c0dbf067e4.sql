
-- Create a security definer function to check if a supplier has an approved connection with a buyer
CREATE OR REPLACE FUNCTION public.supplier_can_view_buyer(buyer_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- Check if the current user is a supplier with an approved connection to this buyer
  RETURN EXISTS (
    SELECT 1 
    FROM public.buyer_supplier_connections bsc
    JOIN public.suppliers s ON s.id = bsc.supplier_id
    WHERE bsc.buyer_id = supplier_can_view_buyer.buyer_id
      AND s.profile_id = auth.uid()
      AND bsc.status = 'approved'
  );
END;
$$;

-- Add new RLS policy to allow suppliers to view connected buyers
CREATE POLICY "Suppliers can view connected buyers" 
  ON public.buyers 
  FOR SELECT 
  USING (public.supplier_can_view_buyer(id));
