-- Phase 1 & 2: Supplier Items, Contacts, and Document Enhancements
-- Create contact_role enum for role-based contact management
CREATE TYPE contact_role AS ENUM ('recall', 'sales', 'quality', 'compliance', 'general');

-- Create supplier_items table for ingredient-level tracking
CREATE TABLE supplier_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE NOT NULL,
  item_name TEXT NOT NULL,
  item_category TEXT NOT NULL, -- seafood, dairy, meat, produce, etc.
  branch_id UUID REFERENCES company_branches(id) ON DELETE SET NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create index for supplier_items
CREATE INDEX idx_supplier_items_supplier_id ON supplier_items(supplier_id);
CREATE INDEX idx_supplier_items_category ON supplier_items(item_category);
CREATE INDEX idx_supplier_items_branch_id ON supplier_items(branch_id);

-- Enable RLS on supplier_items
ALTER TABLE supplier_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for supplier_items
CREATE POLICY "Suppliers can manage their own items"
ON supplier_items
FOR ALL
USING (
  supplier_id IN (
    SELECT id FROM suppliers WHERE profile_id = auth.uid()
  )
);

CREATE POLICY "Buyers can view items from connected suppliers"
ON supplier_items
FOR SELECT
USING (
  supplier_id IN (
    SELECT bsc.supplier_id 
    FROM buyer_supplier_connections bsc
    JOIN buyers b ON b.id = bsc.buyer_id
    WHERE b.profile_id = auth.uid() AND bsc.status = 'approved'
  )
);

-- Create supplier_contacts table for role-based contact management
CREATE TABLE supplier_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  roles contact_role[] NOT NULL DEFAULT ARRAY['general']::contact_role[],
  is_primary BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create index for supplier_contacts
CREATE INDEX idx_supplier_contacts_supplier_id ON supplier_contacts(supplier_id);
CREATE INDEX idx_supplier_contacts_roles ON supplier_contacts USING GIN(roles);

-- Enable RLS on supplier_contacts
ALTER TABLE supplier_contacts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for supplier_contacts
CREATE POLICY "Suppliers can manage their own contacts"
ON supplier_contacts
FOR ALL
USING (
  supplier_id IN (
    SELECT id FROM suppliers WHERE profile_id = auth.uid()
  )
);

CREATE POLICY "Buyers can view contacts from connected suppliers"
ON supplier_contacts
FOR SELECT
USING (
  supplier_id IN (
    SELECT bsc.supplier_id 
    FROM buyer_supplier_connections bsc
    JOIN buyers b ON b.id = bsc.buyer_id
    WHERE b.profile_id = auth.uid() AND bsc.status = 'approved'
  )
);

-- Add new columns to document_uploads for item/facility linking
ALTER TABLE document_uploads 
ADD COLUMN linked_item_ids UUID[],
ADD COLUMN linked_facility_ids UUID[];

-- Add new column to document_requests for targeted contact roles
ALTER TABLE document_requests 
ADD COLUMN target_contact_roles contact_role[];

-- Create indexes for new columns
CREATE INDEX idx_document_uploads_linked_items ON document_uploads USING GIN(linked_item_ids);
CREATE INDEX idx_document_uploads_linked_facilities ON document_uploads USING GIN(linked_facility_ids);
CREATE INDEX idx_document_requests_target_roles ON document_requests USING GIN(target_contact_roles);

-- Create trigger to update updated_at on supplier_items
CREATE TRIGGER update_supplier_items_updated_at
BEFORE UPDATE ON supplier_items
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create trigger to update updated_at on supplier_contacts
CREATE TRIGGER update_supplier_contacts_updated_at
BEFORE UPDATE ON supplier_contacts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();