import { useMemo } from 'react';
import { useCompanyUserRole } from './useCompanyUserRole';
import { hasPermission, UserRole } from '@/config/rolePermissions';

export const useCompanyPermissions = (companyId?: string, companyType?: 'buyer' | 'supplier') => {
  const { role, loading } = useCompanyUserRole(companyId, companyType);

  const permissions = useMemo(() => {
    return {
      canAccessRoute: (routeName: string): boolean => {
        return hasPermission(role as UserRole, routeName);
      },
      canViewCompanyManagement: (): boolean => {
        return hasPermission(role as UserRole, 'company');
      },
      canViewSubscription: (): boolean => {
        return hasPermission(role as UserRole, 'subscription');
      },
      canManageUsers: (): boolean => {
        return role === 'company_admin';
      },
      canManageBranches: (): boolean => {
        return role === 'company_admin';
      },
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
        return role === 'company_admin';
      },
    };
  }, [role]);

  return {
    role,
    loading,
    ...permissions,
  };
};
