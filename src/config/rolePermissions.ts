import { Database } from '@/integrations/supabase/types';

export type UserRole = Database['public']['Enums']['user_role'];

export interface NavigationPermissions {
  [key: string]: UserRole[];
}

// Define which roles can access which navigation items
export const navigationPermissions: NavigationPermissions = {
  'dashboard': ['company_admin', 'branch_manager', 'document_manager', 'approver', 'viewer'],
  'suppliers': ['company_admin', 'branch_manager', 'document_manager'],
  'supplier-map': ['company_admin', 'branch_manager', 'document_manager'],
  'supplier-requests': ['company_admin', 'branch_manager', 'document_manager'],
  'pre-populate': ['company_admin', 'branch_manager', 'document_manager'],
  'requests': ['company_admin', 'branch_manager', 'document_manager'],
  'templates': ['company_admin', 'branch_manager', 'document_manager'],
  'document-sets': ['company_admin', 'branch_manager', 'document_manager'],
  'compliance': ['company_admin', 'branch_manager', 'approver', 'viewer'],
  'item-compliance': ['company_admin', 'branch_manager', 'approver', 'viewer'],
  'facility-matrix': ['company_admin', 'branch_manager', 'approver', 'viewer'],
  'documents': ['company_admin', 'branch_manager', 'document_manager', 'viewer'],
  'assignments': ['company_admin', 'approver'],
  'onboarding': ['company_admin', 'branch_manager'],
  'agents': ['company_admin'],
  'company': [], // OWNER-ONLY: Checked via isCompanyOwner, not role-based
  'subscription': [], // OWNER-ONLY: Checked via isCompanyOwner, not role-based
  'chat': ['company_admin', 'branch_manager', 'document_manager', 'approver', 'viewer'],
};

// Helper function to check if a role has permission for a feature
export const hasPermission = (userRole: UserRole | null, feature: string): boolean => {
  if (!userRole) return false;
  const allowedRoles = navigationPermissions[feature];
  return allowedRoles ? allowedRoles.includes(userRole) : false;
};

// Helper to get human-readable role name
export const getRoleDisplayName = (role: UserRole): string => {
  const roleNames: Partial<Record<UserRole, string>> = {
    company_admin: 'Company Admin',
    branch_manager: 'Branch Manager',
    document_manager: 'Document Manager',
    approver: 'Approver',
    viewer: 'Viewer',
  };
  return roleNames[role] || role;
};
