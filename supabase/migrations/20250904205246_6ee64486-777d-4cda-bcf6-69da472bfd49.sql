-- Create branch_supplier_connections table for managing which suppliers are connected to which branches
CREATE TABLE public.branch_supplier_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID NOT NULL,
  supplier_id UUID NOT NULL,
  buyer_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(branch_id, supplier_id)
);

-- Enable RLS
ALTER TABLE public.branch_supplier_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policies for branch_supplier_connections
CREATE POLICY "Company admins can manage branch supplier connections"
ON public.branch_supplier_connections
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM company_users cu
    JOIN company_branches cb ON cb.company_id = cu.company_id AND cb.company_type = cu.company_type
    WHERE cu.profile_id = auth.uid()
      AND cb.id = branch_supplier_connections.branch_id
      AND cu.role = 'company_admin'
      AND cu.status = 'active'
  )
);

CREATE POLICY "Branch users can view their branch supplier connections"
ON public.branch_supplier_connections
FOR SELECT
USING (
  user_has_branch_access(auth.uid(), branch_id)
);

-- Add branch_id to existing buyer_supplier_connections for backward compatibility
ALTER TABLE public.buyer_supplier_connections 
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.company_branches(id);

-- Create index for performance
CREATE INDEX idx_branch_supplier_connections_branch_id ON public.branch_supplier_connections(branch_id);
CREATE INDEX idx_branch_supplier_connections_supplier_id ON public.branch_supplier_connections(supplier_id);
CREATE INDEX idx_buyer_supplier_connections_branch_id ON public.buyer_supplier_connections(branch_id);

-- Update triggers for updated_at
CREATE TRIGGER update_branch_supplier_connections_updated_at
BEFORE UPDATE ON public.branch_supplier_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to get suppliers for a specific branch
CREATE OR REPLACE FUNCTION public.get_branch_suppliers(p_branch_id UUID)
RETURNS TABLE(
  supplier_id UUID,
  company_name TEXT,
  contact_email TEXT,
  industry TEXT,
  phone TEXT,
  address TEXT,
  connection_status TEXT,
  assigned_at TIMESTAMP WITH TIME ZONE,
  notes TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id as supplier_id,
    s.company_name,
    s.contact_email,
    s.industry,
    s.phone,
    s.address,
    bsc.status as connection_status,
    bsc.assigned_at,
    bsc.notes
  FROM suppliers s
  JOIN branch_supplier_connections bsc ON s.id = bsc.supplier_id
  WHERE bsc.branch_id = p_branch_id
    AND bsc.status = 'active'
  ORDER BY s.company_name;
END;
$$;

-- Function to assign supplier to branch
CREATE OR REPLACE FUNCTION public.assign_supplier_to_branch(
  p_branch_id UUID,
  p_supplier_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buyer_id UUID;
  v_connection_id UUID;
BEGIN
  -- Get buyer_id from branch
  SELECT cb.company_id INTO v_buyer_id
  FROM company_branches cb
  WHERE cb.id = p_branch_id AND cb.company_type = 'buyer';
  
  IF v_buyer_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Branch not found or not a buyer branch'
    );
  END IF;
  
  -- Check if assignment already exists
  SELECT id INTO v_connection_id
  FROM branch_supplier_connections
  WHERE branch_id = p_branch_id AND supplier_id = p_supplier_id;
  
  IF v_connection_id IS NOT NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Supplier already assigned to this branch'
    );
  END IF;
  
  -- Create the assignment
  INSERT INTO branch_supplier_connections (
    branch_id,
    supplier_id,
    buyer_id,
    assigned_by,
    notes
  ) VALUES (
    p_branch_id,
    p_supplier_id,
    v_buyer_id,
    auth.uid(),
    p_notes
  ) RETURNING id INTO v_connection_id;
  
  RETURN json_build_object(
    'success', true,
    'connection_id', v_connection_id,
    'message', 'Supplier successfully assigned to branch'
  );
END;
$$;