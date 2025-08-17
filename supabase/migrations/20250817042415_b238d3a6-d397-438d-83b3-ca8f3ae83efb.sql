-- Create document shared links table
CREATE TABLE public.document_shared_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_upload_id UUID NOT NULL REFERENCES document_uploads(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  access_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'base64url'),
  permission_level TEXT NOT NULL DEFAULT 'organization' CHECK (permission_level IN ('public', 'organization', 'admin_only')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  view_count INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMP WITH TIME ZONE
);

-- Create document activity logs table  
CREATE TABLE public.document_activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_upload_id UUID NOT NULL REFERENCES document_uploads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  action_type TEXT NOT NULL CHECK (action_type IN ('link_created', 'link_accessed', 'document_viewed', 'document_downloaded', 'document_approved', 'document_declined')),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT
);

-- Enable RLS on both tables
ALTER TABLE public.document_shared_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for document_shared_links
CREATE POLICY "Users can create links for documents they can access" 
ON public.document_shared_links 
FOR INSERT 
WITH CHECK (
  document_upload_id IN (
    SELECT du.id FROM document_uploads du
    JOIN document_requests dr ON du.request_id = dr.id
    WHERE dr.buyer_id IN (
      SELECT b.id FROM buyers b WHERE b.profile_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can view links for documents they can access" 
ON public.document_shared_links 
FOR SELECT 
USING (
  document_upload_id IN (
    SELECT du.id FROM document_uploads du
    JOIN document_requests dr ON du.request_id = dr.id
    WHERE dr.buyer_id IN (
      SELECT b.id FROM buyers b WHERE b.profile_id = auth.uid()
    ) OR dr.supplier_id IN (
      SELECT s.id FROM suppliers s WHERE s.profile_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can update their own links" 
ON public.document_shared_links 
FOR UPDATE 
USING (created_by = auth.uid());

-- RLS policies for document_activity_logs
CREATE POLICY "Users can create activity logs" 
ON public.document_activity_logs 
FOR INSERT 
WITH CHECK (true); -- System can create logs

CREATE POLICY "Users can view logs for documents they can access" 
ON public.document_activity_logs 
FOR SELECT 
USING (
  document_upload_id IN (
    SELECT du.id FROM document_uploads du
    JOIN document_requests dr ON du.request_id = dr.id
    WHERE dr.buyer_id IN (
      SELECT b.id FROM buyers b WHERE b.profile_id = auth.uid()
    ) OR dr.supplier_id IN (
      SELECT s.id FROM suppliers s WHERE s.profile_id = auth.uid()
    )
  )
);

-- Create indexes for performance
CREATE INDEX idx_document_shared_links_document_id ON public.document_shared_links(document_upload_id);
CREATE INDEX idx_document_shared_links_token ON public.document_shared_links(access_token);
CREATE INDEX idx_document_activity_logs_document_id ON public.document_activity_logs(document_upload_id);
CREATE INDEX idx_document_activity_logs_created_at ON public.document_activity_logs(created_at);

-- Function to log document activities
CREATE OR REPLACE FUNCTION public.log_document_activity(
  p_document_upload_id UUID,
  p_user_id UUID,
  p_action_type TEXT,
  p_metadata JSONB DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  activity_id UUID;
BEGIN
  INSERT INTO document_activity_logs (
    document_upload_id,
    user_id,
    action_type,
    metadata,
    notes
  ) VALUES (
    p_document_upload_id,
    p_user_id,
    p_action_type,
    p_metadata,
    p_notes
  ) RETURNING id INTO activity_id;
  
  RETURN activity_id;
END;
$$;