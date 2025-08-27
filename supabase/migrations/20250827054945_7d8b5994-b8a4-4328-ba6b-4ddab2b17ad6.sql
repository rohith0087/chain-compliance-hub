-- Create supplier document library table
CREATE TABLE public.supplier_document_library (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID NOT NULL,
  document_name TEXT NOT NULL,
  document_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  category TEXT,
  tags TEXT[],
  description TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  is_current_version BOOLEAN NOT NULL DEFAULT true,
  original_document_id UUID, -- For versioning
  extraction_status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  content_extracted TEXT,
  content_summary TEXT,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
  FOREIGN KEY (original_document_id) REFERENCES supplier_document_library(id)
);

-- Enable RLS
ALTER TABLE public.supplier_document_library ENABLE ROW LEVEL SECURITY;

-- Create policies for supplier document library
CREATE POLICY "Suppliers can manage their document library" 
ON public.supplier_document_library 
FOR ALL 
USING (supplier_id IN (
  SELECT id FROM suppliers WHERE profile_id = auth.uid()
));

-- Create indexes for better performance
CREATE INDEX idx_supplier_document_library_supplier_id ON public.supplier_document_library(supplier_id);
CREATE INDEX idx_supplier_document_library_category ON public.supplier_document_library(category);
CREATE INDEX idx_supplier_document_library_current_version ON public.supplier_document_library(is_current_version) WHERE is_current_version = true;

-- Create document processing log table
CREATE TABLE public.document_processing_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL,
  processing_step TEXT NOT NULL, -- upload, extraction, embedding, completed
  status TEXT NOT NULL, -- pending, processing, completed, failed
  error_message TEXT,
  processing_time_ms INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  FOREIGN KEY (document_id) REFERENCES supplier_document_library(id) ON DELETE CASCADE
);

-- Enable RLS for processing logs
ALTER TABLE public.document_processing_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for processing logs
CREATE POLICY "Users can view processing logs for their documents" 
ON public.document_processing_logs 
FOR SELECT 
USING (document_id IN (
  SELECT sdl.id FROM supplier_document_library sdl
  JOIN suppliers s ON s.id = sdl.supplier_id
  WHERE s.profile_id = auth.uid()
));

-- Create trigger for updating updated_at
CREATE TRIGGER update_supplier_document_library_updated_at
BEFORE UPDATE ON public.supplier_document_library
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger to log document changes
CREATE OR REPLACE FUNCTION public.log_document_processing()
RETURNS TRIGGER AS $$
BEGIN
  -- Log when document extraction status changes
  IF OLD.extraction_status IS DISTINCT FROM NEW.extraction_status THEN
    INSERT INTO document_processing_logs (document_id, processing_step, status)
    VALUES (NEW.id, 'extraction', NEW.extraction_status);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_log_document_processing
AFTER UPDATE ON public.supplier_document_library
FOR EACH ROW
EXECUTE FUNCTION public.log_document_processing();