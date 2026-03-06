-- ============================================================
-- MIGRATION: Revoke PUBLIC EXECUTE on all application functions
-- Grant only to authenticated or service_role as appropriate
-- ============================================================

-- ============================================================
-- 1. REVOKE PUBLIC EXECUTE on ALL application functions
-- (This removes anon access to every RPC function)
-- ============================================================

-- Regular application functions
REVOKE EXECUTE ON FUNCTION public.accept_platform_admin_invitation(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.add_credits(uuid, integer, text, text, uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.approve_connection_with_onboarding(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.approve_document_request(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assign_supplier_to_branch(uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_manage_company_users(uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_view_company_users(uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_knowledge_entries() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consume_credits(uuid, integer, text, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_bootstrap_super_admin(text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_platform_admin_invitation(text, platform_role[], uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_supplier_to_buyer_connection(text, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_branch_with_validation(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.finalize_onboarding_approval(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_admin_user_stats() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_all_users_detailed() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_branch_suppliers(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_companies_for_knowledge_refresh() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_connected_supplier_ids_for_buyer() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_latest_expiring_documents() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_onboarding_supplier_ids_for_buyer() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_platform_admin_invitations() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_platform_admin_stats() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_platform_admin_users() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_super_admin_stats() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_buyer_ids() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_roles(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_roles_array(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_supplier_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.grant_pg_net_access() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.grant_role(uuid, app_role, timestamptz, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_unified_connection_approval(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_any_role(uuid, app_role[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_company_role(uuid, uuid, text, user_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_platform_role(uuid, platform_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_platform_admin(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_document_activity(uuid, uuid, text, jsonb, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.platform_admin_reset_password(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.platform_admin_update_user_role(uuid, user_role[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reject_document_request(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.remove_company_user(uuid, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.revoke_platform_admin_invitation(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.revoke_role(uuid, app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.search_knowledge_entries(text, uuid, text, double precision, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.search_relevant_documents(text, uuid, text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.search_suppliers_for_discovery(text, text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.send_supplier_connection_request(uuid, uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.super_admin_reset_password(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.supplier_can_view_buyer(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_has_branch_access(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_has_company_access(uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_has_permission(uuid, uuid, text, permission_type) FROM PUBLIC;

-- Trigger functions (should not be callable via RPC at all)
REVOKE EXECUTE ON FUNCTION public.auto_refresh_knowledge_base() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.clear_old_expiry_notifications_on_renewal() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_default_agent_configs() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_company() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_unread_counts() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.initialize_user_credits() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_document_processing() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_document_requested() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_document_uploaded() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_link_created() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.normalize_request_status() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reset_unread_on_read() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_connection_approval_to_onboarding() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_document_upload_status() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_sample_to_pending_requests() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trigger_populate_onboarding_requirements() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_agent_config_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_bulk_upload_progress() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_session_activity() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_thread_last_message() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_user_roles_updated_at() FROM PUBLIC;

-- ============================================================
-- 2. GRANT EXECUTE to authenticated for regular app functions
-- ============================================================

GRANT EXECUTE ON FUNCTION public.accept_platform_admin_invitation(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_connection_with_onboarding(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_document_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_supplier_to_branch(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_company_users(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_company_users(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_platform_admin_invitation(text, platform_role[], uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_supplier_to_buyer_connection(text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_branch_with_validation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_onboarding_approval(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_user_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_users_detailed() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_branch_suppliers(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_connected_supplier_ids_for_buyer() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_latest_expiring_documents() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_onboarding_supplier_ids_for_buyer() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_platform_admin_invitations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_platform_admin_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_platform_admin_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_super_admin_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_buyer_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_roles(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_roles_array(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_supplier_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_role(uuid, app_role, timestamptz, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_unified_connection_approval(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid, app_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_company_role(uuid, uuid, text, user_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_platform_role(uuid, platform_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_document_activity(uuid, uuid, text, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_admin_update_user_role(uuid, user_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_document_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_company_user(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_platform_admin_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_knowledge_entries(text, uuid, text, double precision, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_relevant_documents(text, uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_suppliers_for_discovery(text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_supplier_connection_request(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.supplier_can_view_buyer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_branch_access(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_company_access(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_permission(uuid, uuid, text, permission_type) TO authenticated;

-- ============================================================
-- 3. SENSITIVE FUNCTIONS: Grant ONLY to service_role
-- These should only be callable from edge functions
-- ============================================================

-- add_credits: CRITICAL - no auth check, accepts arbitrary user_id
GRANT EXECUTE ON FUNCTION public.add_credits(uuid, integer, text, text, uuid, text, text) TO service_role;

-- consume_credits: HIGH - accepts arbitrary user_id
GRANT EXECUTE ON FUNCTION public.consume_credits(uuid, integer, text, uuid, text) TO service_role;

-- create_bootstrap_super_admin: should only be used during setup
GRANT EXECUTE ON FUNCTION public.create_bootstrap_super_admin(text, text, text) TO service_role;

-- cleanup_expired_knowledge_entries: system maintenance
GRANT EXECUTE ON FUNCTION public.cleanup_expired_knowledge_entries() TO service_role;

-- get_companies_for_knowledge_refresh: internal system function
GRANT EXECUTE ON FUNCTION public.get_companies_for_knowledge_refresh() TO service_role;

-- grant_pg_net_access: system infrastructure
GRANT EXECUTE ON FUNCTION public.grant_pg_net_access() TO service_role;

-- Password reset functions: sensitive admin operations
GRANT EXECUTE ON FUNCTION public.platform_admin_reset_password(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.super_admin_reset_password(uuid, text) TO service_role;

-- ============================================================
-- 4. Trigger functions: NO grants needed (executed by trigger system)
-- They are already revoked from PUBLIC above, no additional grants.
-- ============================================================