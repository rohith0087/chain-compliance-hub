
-- Create enum types for better data integrity
CREATE TYPE public.request_status AS ENUM ('pending', 'submitted', 'approved', 'rejected', 'expired');
CREATE TYPE public.request_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE public.user_role AS ENUM ('buyer', 'supplier', 'admin');

-- Create profiles table for user management
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  company_name TEXT,
  roles user_role[] NOT NULL DEFAULT '{supplier}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create suppliers table
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  industry TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create document requests table
CREATE TABLE public.document_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE CASCADE,
  requester_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  document_type TEXT NOT NULL,
  category TEXT NOT NULL,
  priority request_priority DEFAULT 'medium',
  status request_status DEFAULT 'pending',
  due_date DATE,
  template_sections JSONB,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create document uploads table
CREATE TABLE public.document_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES public.document_requests(id) ON DELETE CASCADE,
  uploader_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  version INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending_review',
  reviewer_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL, -- 'request_created', 'document_uploaded', 'status_changed', etc.
  reference_id UUID, -- Can reference request_id or upload_id
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public) VALUES ('compliance-documents', 'compliance-documents', false);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for suppliers
CREATE POLICY "Users can view suppliers" ON public.suppliers
  FOR SELECT USING (true);

CREATE POLICY "Users can manage their supplier profile" ON public.suppliers
  FOR ALL USING (profile_id = auth.uid());

-- RLS Policies for document requests
CREATE POLICY "Users can view requests they're involved in" ON public.document_requests
  FOR SELECT USING (
    requester_id = auth.uid() OR 
    supplier_id IN (SELECT id FROM public.suppliers WHERE profile_id = auth.uid())
  );

CREATE POLICY "Buyers can create requests" ON public.document_requests
  FOR INSERT WITH CHECK (requester_id = auth.uid());

CREATE POLICY "Users can update requests they're involved in" ON public.document_requests
  FOR UPDATE USING (
    requester_id = auth.uid() OR 
    supplier_id IN (SELECT id FROM public.suppliers WHERE profile_id = auth.uid())
  );

-- RLS Policies for document uploads
CREATE POLICY "Users can view uploads for their requests" ON public.document_uploads
  FOR SELECT USING (
    uploader_id = auth.uid() OR
    request_id IN (
      SELECT id FROM public.document_requests 
      WHERE requester_id = auth.uid() OR 
      supplier_id IN (SELECT id FROM public.suppliers WHERE profile_id = auth.uid())
    )
  );

CREATE POLICY "Users can upload documents" ON public.document_uploads
  FOR INSERT WITH CHECK (uploader_id = auth.uid());

CREATE POLICY "Users can update their uploads" ON public.document_uploads
  FOR UPDATE USING (uploader_id = auth.uid());

-- RLS Policies for notifications
CREATE POLICY "Users can view their notifications" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their notifications" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

-- Storage policies for compliance documents
CREATE POLICY "Users can view documents they have access to" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'compliance-documents' AND
    (auth.uid()::text = (storage.foldername(name))[1] OR
     EXISTS (
       SELECT 1 FROM public.document_uploads du
       JOIN public.document_requests dr ON du.request_id = dr.id
       WHERE du.file_path = name AND 
       (dr.requester_id = auth.uid() OR 
        dr.supplier_id IN (SELECT id FROM public.suppliers WHERE profile_id = auth.uid()))
     ))
  );

CREATE POLICY "Users can upload documents" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'compliance-documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Function to automatically create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, roles)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    ARRAY['supplier']::user_role[]
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to create notifications
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT,
  p_reference_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, reference_id)
  VALUES (p_user_id, p_title, p_message, p_type, p_reference_id)
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable realtime for notifications
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.document_requests REPLICA IDENTITY FULL;
ALTER TABLE public.document_uploads REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.document_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.document_uploads;
