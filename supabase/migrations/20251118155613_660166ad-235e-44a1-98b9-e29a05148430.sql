-- Create buyer_document_library table
CREATE TABLE IF NOT EXISTS buyer_document_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
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
  original_document_id UUID REFERENCES buyer_document_library(id),
  extraction_status TEXT NOT NULL DEFAULT 'pending',
  content_extracted TEXT,
  content_summary TEXT,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expiration_date DATE,
  ai_suggested_tags TEXT[],
  ai_suggested_description TEXT,
  branch_id UUID REFERENCES company_branches(id),
  access_level TEXT DEFAULT 'company'
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_buyer_document_library_buyer_id ON buyer_document_library(buyer_id);
CREATE INDEX IF NOT EXISTS idx_buyer_document_library_document_type ON buyer_document_library(document_type);
CREATE INDEX IF NOT EXISTS idx_buyer_document_library_branch_id ON buyer_document_library(branch_id);
CREATE INDEX IF NOT EXISTS idx_buyer_document_library_created_at ON buyer_document_library(created_at DESC);

-- Enable RLS
ALTER TABLE buyer_document_library ENABLE ROW LEVEL SECURITY;

-- Buyers can view their own corporate documents
CREATE POLICY "Buyers can view their own corporate documents"
  ON buyer_document_library
  FOR SELECT
  USING (
    buyer_id IN (
      SELECT id FROM buyers WHERE profile_id = auth.uid()
    )
  );

-- Buyers can insert their own corporate documents
CREATE POLICY "Buyers can insert their own corporate documents"
  ON buyer_document_library
  FOR INSERT
  WITH CHECK (
    buyer_id IN (
      SELECT id FROM buyers WHERE profile_id = auth.uid()
    )
  );

-- Buyers can update their own corporate documents
CREATE POLICY "Buyers can update their own corporate documents"
  ON buyer_document_library
  FOR UPDATE
  USING (
    buyer_id IN (
      SELECT id FROM buyers WHERE profile_id = auth.uid()
    )
  );

-- Buyers can delete their own corporate documents
CREATE POLICY "Buyers can delete their own corporate documents"
  ON buyer_document_library
  FOR DELETE
  USING (
    buyer_id IN (
      SELECT id FROM buyers WHERE profile_id = auth.uid()
    )
  );

-- Company users can view corporate documents
CREATE POLICY "Company users can view corporate documents"
  ON buyer_document_library
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM company_users cu
      WHERE cu.profile_id = auth.uid()
      AND cu.company_id = buyer_document_library.buyer_id
      AND cu.company_type = 'buyer'
      AND cu.status = 'active'
    )
  );

-- Add trigger for updated_at
CREATE TRIGGER update_buyer_document_library_updated_at
  BEFORE UPDATE ON buyer_document_library
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();