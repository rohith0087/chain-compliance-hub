-- Clear all data for fresh demo build
-- Using CASCADE to handle foreign key constraints automatically

-- Core data tables (in dependency order)
DO $$ 
BEGIN
  -- Activity and logging
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'document_activity_logs') THEN
    TRUNCATE TABLE document_activity_logs CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'document_processing_logs') THEN
    TRUNCATE TABLE document_processing_logs CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'agent_activities') THEN
    TRUNCATE TABLE agent_activities CASCADE;
  END IF;
  
  -- Chat
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'chat_messages') THEN
    TRUNCATE TABLE chat_messages CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'chat_sessions') THEN
    TRUNCATE TABLE chat_sessions CASCADE;
  END IF;
  
  -- Notifications
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notifications') THEN
    TRUNCATE TABLE notifications CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_invitations') THEN
    TRUNCATE TABLE user_invitations CASCADE;
  END IF;
  
  -- Documents
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'document_assignments') THEN
    TRUNCATE TABLE document_assignments CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'document_approvals') THEN
    TRUNCATE TABLE document_approvals CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'document_shared_links') THEN
    TRUNCATE TABLE document_shared_links CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'document_uploads') THEN
    TRUNCATE TABLE document_uploads CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'document_requests') THEN
    TRUNCATE TABLE document_requests CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'bulk_document_uploads') THEN
    TRUNCATE TABLE bulk_document_uploads CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'buyer_document_library') THEN
    TRUNCATE TABLE buyer_document_library CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'supplier_document_library') THEN
    TRUNCATE TABLE supplier_document_library CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'document_libraries') THEN
    TRUNCATE TABLE document_libraries CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'custom_document_templates') THEN
    TRUNCATE TABLE custom_document_templates CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'document_sets') THEN
    TRUNCATE TABLE document_sets CASCADE;
  END IF;
  
  -- Onboarding
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'supplier_onboarding_requests') THEN
    TRUNCATE TABLE supplier_onboarding_requests CASCADE;
  END IF;
  
  -- Settings
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'default_document_requirements') THEN
    TRUNCATE TABLE default_document_requirements CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'default_form_fields') THEN
    TRUNCATE TABLE default_form_fields CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'buyer_default_onboarding_settings') THEN
    TRUNCATE TABLE buyer_default_onboarding_settings CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'document_validation_criteria') THEN
    TRUNCATE TABLE document_validation_criteria CASCADE;
  END IF;
  
  -- Supplier data
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'supplier_contacts') THEN
    TRUNCATE TABLE supplier_contacts CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'item_facility_mappings') THEN
    TRUNCATE TABLE item_facility_mappings CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'supplier_items') THEN
    TRUNCATE TABLE supplier_items CASCADE;
  END IF;
  
  -- Connections
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'branch_supplier_connections') THEN
    TRUNCATE TABLE branch_supplier_connections CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'buyer_supplier_connections') THEN
    TRUNCATE TABLE buyer_supplier_connections CASCADE;
  END IF;
  
  -- Workflows
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'workflow_steps') THEN
    TRUNCATE TABLE workflow_steps CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'approval_workflows') THEN
    TRUNCATE TABLE approval_workflows CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'workflow_states') THEN
    TRUNCATE TABLE workflow_states CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ai_generated_documents') THEN
    TRUNCATE TABLE ai_generated_documents CASCADE;
  END IF;
  
  -- Permissions
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_permissions') THEN
    TRUNCATE TABLE user_permissions CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'delegation_permissions') THEN
    TRUNCATE TABLE delegation_permissions CASCADE;
  END IF;
  
  -- Company data
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'company_users') THEN
    TRUNCATE TABLE company_users CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'branch_compliance_metrics') THEN
    TRUNCATE TABLE branch_compliance_metrics CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'company_branches') THEN
    TRUNCATE TABLE company_branches CASCADE;
  END IF;
  
  -- AI data
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ai_knowledge_entries') THEN
    TRUNCATE TABLE ai_knowledge_entries CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'agent_configurations') THEN
    TRUNCATE TABLE agent_configurations CASCADE;
  END IF;
  
  -- Subscriptions
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'credit_transactions') THEN
    TRUNCATE TABLE credit_transactions CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_subscriptions') THEN
    TRUNCATE TABLE user_subscriptions CASCADE;
  END IF;
  
  -- Companies
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'buyers') THEN
    TRUNCATE TABLE buyers CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'suppliers') THEN
    TRUNCATE TABLE suppliers CASCADE;
  END IF;
  
  -- Roles
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_roles') THEN
    TRUNCATE TABLE user_roles CASCADE;
  END IF;
  
  -- Profiles
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
    TRUNCATE TABLE profiles CASCADE;
  END IF;
END $$;