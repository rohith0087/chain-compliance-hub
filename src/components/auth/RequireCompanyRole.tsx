import React from 'react';
import { useCompanyPermissions } from '@/hooks/useCompanyPermissions';
import { UserRole } from '@/config/rolePermissions';
import UnauthorizedAccess from './UnauthorizedAccess';

interface RequireCompanyRoleProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
  companyId?: string;
  companyType?: 'buyer' | 'supplier';
  fallback?: React.ReactNode;
}

export const RequireCompanyRole: React.FC<RequireCompanyRoleProps> = ({
  children,
  allowedRoles,
  companyId,
  companyType,
  fallback,
}) => {
  const { role, loading } = useCompanyPermissions(companyId, companyType);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const hasRequiredRole = role && allowedRoles.includes(role as UserRole);

  if (!hasRequiredRole) {
    return fallback || <UnauthorizedAccess requiredRoles={allowedRoles} currentRole={role} />;
  }

  return <>{children}</>;
};
