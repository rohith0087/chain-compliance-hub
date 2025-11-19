import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, Users, ArrowLeft, ListTree } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { BranchSupplierManagement } from '@/components/supplier/BranchSupplierManagement';
import { useCompanyBranches } from '@/hooks/useCompanyBranches';
import { useCompanyUserRole } from '@/hooks/useCompanyUserRole';

interface BranchSupplierDashboardProps {
  buyerId: string;
  currentUserRole?: string;
  onBack?: () => void;
}

export const BranchSupplierDashboard: React.FC<BranchSupplierDashboardProps> = ({
  buyerId,
  currentUserRole,
  onBack
}) => {
  const { branches, loading } = useCompanyBranches(buyerId, 'buyer');
  const { role: companyUserRole } = useCompanyUserRole(buyerId, 'buyer');

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-4 bg-muted rounded w-1/4 mb-4"></div>
          <div className="h-32 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Back Navigation */}
        {onBack && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onBack}
                aria-label="Back to suppliers page"
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Back to Suppliers</TooltipContent>
          </Tooltip>
        )}

        {/* Page Header */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Branch Supplier Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage supplier assignments across your company branches
          </p>
        </div>

        {/* Color-coded Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-l-4 border-l-blue-500 bg-blue-500/5 hover:shadow-md transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Branches</CardTitle>
              <Building2 className="h-5 w-5 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-500">{branches.length}</div>
              <p className="text-xs text-muted-foreground/80">
                Active company branches
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500 bg-purple-500/5 hover:shadow-md transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Branch Types</CardTitle>
              <ListTree className="h-5 w-5 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-500">
                {branches.filter(b => b.status === 'active').length}
              </div>
              <p className="text-xs text-muted-foreground/80">
                Active branches
              </p>
              <Badge variant="secondary" className="mt-2 bg-purple-500/10 text-purple-700 border-purple-200">
                Multi-branch
              </Badge>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500 bg-green-500/5 hover:shadow-md transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Management Role</CardTitle>
              <Users className="h-5 w-5 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-green-500 capitalize">
                {companyUserRole || currentUserRole || 'User'}
              </div>
              <p className="text-xs text-muted-foreground/80">
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
    </TooltipProvider>
  );
};