import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Users } from 'lucide-react';
import { BranchSupplierManagement } from '@/components/supplier/BranchSupplierManagement';
import { useCompanyBranches } from '@/hooks/useCompanyBranches';
import { useCompanyUserRole } from '@/hooks/useCompanyUserRole';

interface BranchSupplierDashboardProps {
  buyerId: string;
  currentUserRole?: string;
}

export const BranchSupplierDashboard: React.FC<BranchSupplierDashboardProps> = ({
  buyerId,
  currentUserRole
}) => {
  const { branches, loading } = useCompanyBranches(buyerId, 'buyer');
  const { role: companyUserRole } = useCompanyUserRole(buyerId, 'buyer');

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Branches</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{branches.length}</div>
            <p className="text-xs text-muted-foreground">
              Active company branches
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Branch Types</CardTitle>
            <Badge variant="secondary">Multi-branch</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {branches.filter(b => b.status === 'active').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Active branches
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Management Role</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold capitalize">
              {companyUserRole || currentUserRole || 'User'}
            </div>
            <p className="text-xs text-muted-foreground">
              Company role: {companyUserRole || 'None assigned'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Branch Supplier Management */}
      <BranchSupplierManagement 
        buyerId={buyerId}
        currentUserRole={currentUserRole}
        companyUserRole={companyUserRole || undefined}
      />
    </div>
  );
};