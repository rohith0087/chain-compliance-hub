-- Create support tickets table
CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User info (nullable for unauthenticated users)
  user_id UUID REFERENCES public.profiles(id),
  user_email TEXT,
  user_name TEXT,
  
  -- Company info (nullable)
  company_id UUID,
  company_name TEXT,
  user_type TEXT, -- 'buyer' | 'supplier' | 'guest'
  
  -- Ticket content
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  
  -- Auto-captured metadata
  source TEXT NOT NULL CHECK (source IN ('buyer_portal', 'supplier_portal', 'login_page', 'other')),
  page_url TEXT,
  page_route TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  
  -- Admin handling
  assigned_to UUID REFERENCES public.profiles(id),
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can create tickets (including unauthenticated via service role)
CREATE POLICY "Anyone can create tickets" ON public.support_tickets
  FOR INSERT WITH CHECK (true);

-- Policy: Users can view their own tickets
CREATE POLICY "Users can view own tickets" ON public.support_tickets
  FOR SELECT USING (user_id = auth.uid());

-- Policy: Platform admins can view all tickets
CREATE POLICY "Platform admins can view all tickets" ON public.support_tickets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM platform_administrators 
      WHERE auth_user_id = auth.uid() AND is_active = true
    )
  );

-- Policy: Platform admins can update tickets
CREATE POLICY "Platform admins can update tickets" ON public.support_tickets
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM platform_administrators 
      WHERE auth_user_id = auth.uid() AND is_active = true
    )
  );

-- Enable realtime for the table
ALTER TABLE public.support_tickets REPLICA IDENTITY FULL;

-- Create index for better query performance
CREATE INDEX idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX idx_support_tickets_user_id ON public.support_tickets(user_id);
CREATE INDEX idx_support_tickets_created_at ON public.support_tickets(created_at DESC);

-- Add trigger for updated_at
CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();