import { useMemo } from 'react';
import { useCompanyUserRole } from './useCompanyUserRole';
import { hasPermission, UserRole } from '@/config/rolePermissions';

export const useCompanyPermissions = (companyId?: string, companyType?: 'buyer' | 'supplier') => {
  const { role, isOwner, loading } = useCompanyUserRole(companyId, companyType);

  const permissions = useMemo(() => {
    return {
      canAccessRoute: (routeName: string): boolean => {
        // Owner-only routes
        if (routeName === 'company' || routeName === 'subscription') {
          return isOwner;
        }
        return hasPermission(role as UserRole, routeName);
      },
      // Owner-only features
      canViewCompanyManagement: (): boolean => isOwner,
      canViewSubscription: (): boolean => isOwner,
      isCompanyOwner: (): boolean => isOwner,
      
      // Admin OR Owner can manage users/branches
      canManageUsers: (): boolean => isOwner || role === 'company_admin',
      canManageBranches: (): boolean => isOwner || role === 'company_admin',
      
      // Role-based permissions
      canManageSuppliers: (): boolean => {
        return hasPermission(role as UserRole, 'suppliers');
      },
      canCreateRequests: (): boolean => {
        return hasPermission(role as UserRole, 'requests');
      },
      canApproveDocuments: (): boolean => {
        return hasPermission(role as UserRole, 'assignments');
      },
      canViewCompliance: (): boolean => {
        return hasPermission(role as UserRole, 'compliance');
      },
      isCompanyAdmin: (): boolean => {
        return isOwner || role === 'company_admin';
      },
    };
  }, [role, isOwner]);

  return {
    role,
    isOwner,
    loading,
    ...permissions,
  };
};
