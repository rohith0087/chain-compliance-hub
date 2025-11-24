-- Migration: Complete Data Reset - Delete All Data, Keep Schema
-- WARNING: This will delete ALL user data while preserving the database structure

-- Disable triggers temporarily to speed up deletion
SET session_replication_role = 'replica';

-- Phase 1: Delete dependent data (child tables)
DELETE FROM chat_messages;
DELETE FROM document_activity_logs;
DELETE FROM document_assignments;
DELETE FROM document_approvals;
DELETE FROM workflow_execution_logs;
DELETE FROM workflow_states;
DELETE FROM workflow_steps;
DELETE FROM approval_workflows;
DELETE FROM branch_supplier_connections;
DELETE FROM branch_compliance_metrics;
DELETE FROM document_shared_links;
DELETE FROM shared_documents;
DELETE FROM document_uploads;
DELETE FROM document_processing_logs;
DELETE FROM document_validation_criteria;
DELETE FROM document_requests;
DELETE FROM buyer_supplier_connections;
DELETE FROM supplier_onboarding_requests;
DELETE FROM onboarding_document_submissions;
DELETE FROM onboarding_form_responses;
DELETE FROM onboarding_branch_selections;
DELETE FROM onboarding_document_requirements;
DELETE FROM onboarding_form_fields;
DELETE FROM bulk_document_uploads;
DELETE FROM custom_document_templates;
DELETE FROM template_submissions;
DELETE FROM document_sets;
DELETE FROM default_document_requirements;
DELETE FROM default_form_fields;
DELETE FROM buyer_document_library;
DELETE FROM supplier_document_library;
DELETE FROM document_libraries;
DELETE FROM supplier_items;
DELETE FROM item_facility_mappings;
DELETE FROM supplier_contacts;
DELETE FROM supplier_performance_metrics;
DELETE FROM supplier_response_metrics;
DELETE FROM chat_sessions;
DELETE FROM agent_activities;
DELETE FROM agent_configurations;
DELETE FROM ai_knowledge_entries;
DELETE FROM ai_generated_documents;
DELETE FROM notifications;
DELETE FROM user_activity_logs;
DELETE FROM delegation_permissions;
DELETE FROM user_permissions;
DELETE FROM temporary_branch_selections;

-- Phase 2: Delete organizational structure
DELETE FROM company_users;
DELETE FROM company_branches;
DELETE FROM buyer_default_onboarding_settings;

-- Phase 3: Delete company records
DELETE FROM suppliers;
DELETE FROM buyers;

-- Phase 4: Delete subscription/credit data
DELETE FROM credit_transactions;
DELETE FROM user_credits;
DELETE FROM subscriptions;
DELETE FROM subscription_plan_configs;

-- Phase 5: Delete platform admin data
DELETE FROM platform_admin_audit_logs;
DELETE FROM platform_admin_invitations;
DELETE FROM platform_administrators;

-- Phase 6: Delete user identity and roles
DELETE FROM user_roles;
DELETE FROM profiles;

-- Phase 7: Delete system data
DELETE FROM system_metrics;
DELETE FROM workflow_templates;

-- Re-enable triggers
SET session_replication_role = 'origin';

COMMENT ON SCHEMA public IS 'Data reset completed - all user data deleted, schema preserved';