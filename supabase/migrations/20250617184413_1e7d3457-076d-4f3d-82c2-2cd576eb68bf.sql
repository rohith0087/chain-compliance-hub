
-- Create buyers table
CREATE TABLE IF NOT EXISTS public.buyers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  industry TEXT,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create buyer_supplier_connections table for managing relationships
CREATE TABLE IF NOT EXISTS public.buyer_supplier_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id UUID REFERENCES public.buyers(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  responded_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  UNIQUE(buyer_id, supplier_id)
);

-- Add buyer_id column to document_requests if it doesn't exist
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'document_requests' 
    AND column_name = 'buyer_id'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.document_requests 
    ADD COLUMN buyer_id UUID REFERENCES public.buyers(id);
  END IF;
END $$;

-- Enable RLS on new tables
ALTER TABLE public.buyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_supplier_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies that might conflict and recreate them
DROP POLICY IF EXISTS "Users can view their own buyer profile" ON public.buyers;
DROP POLICY IF EXISTS "Users can create their own buyer profile" ON public.buyers;
DROP POLICY IF EXISTS "Users can update their own buyer profile" ON public.buyers;

-- RLS policies for buyers table
CREATE POLICY "Users can view their own buyer profile" 
  ON public.buyers 
  FOR SELECT 
  USING (profile_id = auth.uid());

CREATE POLICY "Users can create their own buyer profile" 
  ON public.buyers 
  FOR INSERT 
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can update their own buyer profile" 
  ON public.buyers 
  FOR UPDATE 
  USING (profile_id = auth.uid());

-- RLS policies for buyer_supplier_connections
CREATE POLICY "Buyers can view their own connections" 
  ON public.buyer_supplier_connections 
  FOR SELECT 
  USING (
    buyer_id IN (SELECT id FROM public.buyers WHERE profile_id = auth.uid())
  );

CREATE POLICY "Suppliers can view connections to them" 
  ON public.buyer_supplier_connections 
  FOR SELECT 
  USING (
    supplier_id IN (SELECT id FROM public.suppliers WHERE profile_id = auth.uid())
  );

CREATE POLICY "Buyers can create connection requests" 
  ON public.buyer_supplier_connections 
  FOR INSERT 
  WITH CHECK (
    buyer_id IN (SELECT id FROM public.buyers WHERE profile_id = auth.uid())
  );

CREATE POLICY "Suppliers can update connection status" 
  ON public.buyer_supplier_connections 
  FOR UPDATE 
  USING (
    supplier_id IN (SELECT id FROM public.suppliers WHERE profile_id = auth.uid())
  );

-- Drop and recreate document_requests policies
DROP POLICY IF EXISTS "Buyers can view their own requests" ON public.document_requests;
DROP POLICY IF EXISTS "Suppliers can view requests sent to them" ON public.document_requests;
DROP POLICY IF EXISTS "Buyers can create document requests" ON public.document_requests;
DROP POLICY IF EXISTS "Suppliers can update requests sent to them" ON public.document_requests;

CREATE POLICY "Buyers can view their own requests" 
  ON public.document_requests 
  FOR SELECT 
  USING (
    buyer_id IN (SELECT id FROM public.buyers WHERE profile_id = auth.uid())
  );

CREATE POLICY "Suppliers can view requests sent to them" 
  ON public.document_requests 
  FOR SELECT 
  USING (
    supplier_id IN (SELECT id FROM public.suppliers WHERE profile_id = auth.uid())
  );

CREATE POLICY "Buyers can create document requests" 
  ON public.document_requests 
  FOR INSERT 
  WITH CHECK (
    buyer_id IN (SELECT id FROM public.buyers WHERE profile_id = auth.uid())
    AND supplier_id IN (
      SELECT supplier_id 
      FROM public.buyer_supplier_connections 
      WHERE buyer_id IN (SELECT id FROM public.buyers WHERE profile_id = auth.uid())
      AND status = 'approved'
    )
  );

CREATE POLICY "Suppliers can update requests sent to them" 
  ON public.document_requests 
  FOR UPDATE 
  USING (
    supplier_id IN (SELECT id FROM public.suppliers WHERE profile_id = auth.uid())
  );

-- Drop and recreate document_uploads policies
DROP POLICY IF EXISTS "Users can view uploads for their requests" ON public.document_uploads;
DROP POLICY IF EXISTS "Suppliers can create uploads for their requests" ON public.document_uploads;

CREATE POLICY "Users can view uploads for their requests" 
  ON public.document_uploads 
  FOR SELECT 
  USING (
    request_id IN (
      SELECT id FROM public.document_requests 
      WHERE buyer_id IN (SELECT id FROM public.buyers WHERE profile_id = auth.uid())
      OR supplier_id IN (SELECT id FROM public.suppliers WHERE profile_id = auth.uid())
    )
  );

CREATE POLICY "Suppliers can create uploads for their requests" 
  ON public.document_uploads 
  FOR INSERT 
  WITH CHECK (
    request_id IN (
      SELECT id FROM public.document_requests 
      WHERE supplier_id IN (SELECT id FROM public.suppliers WHERE profile_id = auth.uid())
    )
  );

-- Drop and recreate notifications policies
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;

CREATE POLICY "Users can view their own notifications" 
  ON public.notifications 
  FOR SELECT 
  USING (user_id = auth.uid());

CREATE POLICY "System can create notifications" 
  ON public.notifications 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Users can update their own notifications" 
  ON public.notifications 
  FOR UPDATE 
  USING (user_id = auth.uid());
