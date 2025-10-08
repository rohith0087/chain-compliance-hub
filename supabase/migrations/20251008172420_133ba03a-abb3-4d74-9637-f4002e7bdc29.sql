-- Create document_sets table for buyers to save reusable document collections
CREATE TABLE document_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
  set_name TEXT NOT NULL CHECK (char_length(set_name) >= 3),
  description TEXT,
  document_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_default BOOLEAN DEFAULT false,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  usage_count INTEGER DEFAULT 0 CHECK (usage_count >= 0),
  
  CONSTRAINT valid_document_ids CHECK (jsonb_typeof(document_ids) = 'array')
);

-- Indexes for performance
CREATE INDEX idx_document_sets_buyer_id ON document_sets(buyer_id);
CREATE INDEX idx_document_sets_name ON document_sets(set_name);
CREATE INDEX idx_document_sets_default ON document_sets(is_default) WHERE is_default = true;

-- Enable RLS
ALTER TABLE document_sets ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Buyers can view their document sets"
  ON document_sets FOR SELECT
  USING (buyer_id IN (
    SELECT id FROM buyers WHERE profile_id = auth.uid()
  ));

CREATE POLICY "Buyers can create document sets"
  ON document_sets FOR INSERT
  WITH CHECK (
    buyer_id IN (SELECT id FROM buyers WHERE profile_id = auth.uid())
    AND created_by = auth.uid()
  );

CREATE POLICY "Buyers can update their document sets"
  ON document_sets FOR UPDATE
  USING (buyer_id IN (
    SELECT id FROM buyers WHERE profile_id = auth.uid()
  ));

CREATE POLICY "Buyers can delete their document sets"
  ON document_sets FOR DELETE
  USING (buyer_id IN (
    SELECT id FROM buyers WHERE profile_id = auth.uid()
  ));

-- Trigger for updated_at
CREATE TRIGGER update_document_sets_updated_at
  BEFORE UPDATE ON document_sets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment
COMMENT ON TABLE document_sets IS 'Stores reusable document collections that buyers can apply when creating requests';