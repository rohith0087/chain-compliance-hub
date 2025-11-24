-- Phase 2: Add RLS policies for team member access to document management tables

-- 1. Fix custom_document_templates RLS for team members
DROP POLICY IF EXISTS "Buyers can manage their custom templates" ON custom_document_templates;
CREATE POLICY "Buyers and team members can manage custom templates"
ON custom_document_templates
FOR ALL
USING (
  buyer_id IN (
    SELECT id FROM buyers WHERE profile_id = auth.uid()
  )
  OR buyer_id IN (
    SELECT company_id FROM company_users 
    WHERE profile_id = auth.uid() 
    AND company_type = 'buyer' 
    AND status = 'active'
  )
);

-- 2. Fix default_document_requirements RLS for team members
DROP POLICY IF EXISTS "Buyers can manage their default document requirements" ON default_document_requirements;
CREATE POLICY "Buyers and team members can manage default requirements"
ON default_document_requirements
FOR ALL
USING (
  buyer_id IN (
    SELECT id FROM buyers WHERE profile_id = auth.uid()
  )
  OR buyer_id IN (
    SELECT company_id FROM company_users 
    WHERE profile_id = auth.uid() 
    AND company_type = 'buyer' 
    AND status = 'active'
  )
);

-- 3. Fix default_form_fields RLS for team members
DROP POLICY IF EXISTS "Buyers can manage their default form fields" ON default_form_fields;
CREATE POLICY "Buyers and team members can manage default form fields"
ON default_form_fields
FOR ALL
USING (
  buyer_id IN (
    SELECT id FROM buyers WHERE profile_id = auth.uid()
  )
  OR buyer_id IN (
    SELECT company_id FROM company_users 
    WHERE profile_id = auth.uid() 
    AND company_type = 'buyer' 
    AND status = 'active'
  )
);

-- 4. Add explicit team member access to buyer_document_library
DROP POLICY IF EXISTS "Team members can view company corporate documents" ON buyer_document_library;
CREATE POLICY "Team members can view company corporate documents"
ON buyer_document_library
FOR SELECT
USING (
  buyer_id IN (
    SELECT company_id FROM company_users 
    WHERE profile_id = auth.uid() 
    AND company_type = 'buyer' 
    AND status = 'active'
  )
);

-- 5. Add team member management policies for buyer_document_library
DROP POLICY IF EXISTS "Team members can manage company corporate documents" ON buyer_document_library;
CREATE POLICY "Team members can manage company corporate documents"
ON buyer_document_library
FOR INSERT
WITH CHECK (
  buyer_id IN (
    SELECT company_id FROM company_users 
    WHERE profile_id = auth.uid() 
    AND company_type = 'buyer' 
    AND status = 'active'
    AND role IN ('company_admin', 'branch_manager', 'document_manager')
  )
);

DROP POLICY IF EXISTS "Team members can update company corporate documents" ON buyer_document_library;
CREATE POLICY "Team members can update company corporate documents"
ON buyer_document_library
FOR UPDATE
USING (
  buyer_id IN (
    SELECT company_id FROM company_users 
    WHERE profile_id = auth.uid() 
    AND company_type = 'buyer' 
    AND status = 'active'
    AND role IN ('company_admin', 'branch_manager', 'document_manager')
  )
);

DROP POLICY IF EXISTS "Team members can delete company corporate documents" ON buyer_document_library;
CREATE POLICY "Team members can delete company corporate documents"
ON buyer_document_library
FOR DELETE
USING (
  buyer_id IN (
    SELECT company_id FROM company_users 
    WHERE profile_id = auth.uid() 
    AND company_type = 'buyer' 
    AND status = 'active'
    AND role IN ('company_admin', 'branch_manager', 'document_manager')
  )
);