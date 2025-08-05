import React, { useState } from 'react';
import { Building2, Users, Settings, BarChart3, Shield } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCompanyBranches } from '@/hooks/useCompanyBranches';
import { BranchSelector } from './BranchSelector';
import { BranchManagement } from './BranchManagement';
import { CompanyUserManagement } from './CompanyUserManagement';

interface CompanyManagementDashboardProps {
  companyId: string;
  companyType: 'buyer' | 'supplier';
  companyName: string;
}

export const CompanyManagementDashboard: React.FC<CompanyManagementDashboardProps> = ({
  companyId,
  companyType,
  companyName
}) => {
  const {
    branches,
    companyUsers,
    currentBranch,
    loading,
    error,
    createBranch,
    updateBranch,
    inviteUserToBranch,
    switchBranch
  } = useCompanyBranches(companyId, companyType);

  const [activeTab, setActiveTab] = useState('overview');

  const stats = {
    totalBranches: branches.length,
    totalUsers: companyUsers.filter(u => u.status === 'active').length,
    pendingInvitations: companyUsers.filter(u => u.status === 'pending').length,
    activeBranches: branches.filter(b => b.status === 'active').length
  };

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-destructive">
            <p>Error loading company data: {error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{companyName}</h1>
          <p className="text-muted-foreground">
            Manage your company structure, branches, and team members
          </p>
        </div>
        
        {branches.length > 1 && (
          <BranchSelector
            branches={branches}
            currentBranch={currentBranch}
            onBranchChange={switchBranch}
            loading={loading}
          />
        )}
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Branches</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalBranches}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeBranches} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              {stats.pendingInvitations} pending invitations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Branch</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold truncate">
              {currentBranch?.branch_name || 'None'}
            </div>
            <p className="text-xs text-muted-foreground">
              {currentBranch?.location || 'No location set'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Access Level</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Admin</div>
            <p className="text-xs text-muted-foreground">
              Full company access
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="branches">Branches</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest company updates and changes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {companyUsers.slice(0, 3).map((user) => (
                    <div key={user.id} className="flex items-center space-x-3 text-sm">
                      <div className="h-2 w-2 bg-green-500 rounded-full" />
                      <span className="text-muted-foreground">
                        User joined {branches.find(b => b.id === user.branch_id)?.branch_name || 'Unknown Branch'}
                      </span>
                    </div>
                  ))}
                  {companyUsers.length === 0 && (
                    <p className="text-sm text-muted-foreground">No recent activity</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common management tasks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid gap-2">
                  <button 
                    onClick={() => setActiveTab('branches')}
                    className="flex items-center p-2 text-sm hover:bg-muted rounded-md transition-colors"
                  >
                    <Building2 className="h-4 w-4 mr-2" />
                    Manage Branches
                  </button>
                  <button 
                    onClick={() => setActiveTab('users')}
                    className="flex items-center p-2 text-sm hover:bg-muted rounded-md transition-colors"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Invite Team Members
                  </button>
                  <button 
                    onClick={() => setActiveTab('permissions')}
                    className="flex items-center p-2 text-sm hover:bg-muted rounded-md transition-colors"
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Manage Permissions
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="branches" className="space-y-4">
          <BranchManagement
            branches={branches}
            companyUsers={companyUsers}
            companyId={companyId}
            companyType={companyType}
            onCreateBranch={createBranch}
            onUpdateBranch={updateBranch}
            loading={loading}
          />
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <CompanyUserManagement
            branches={branches}
            companyUsers={companyUsers}
            onInviteUser={inviteUserToBranch}
            loading={loading}
          />
        </TabsContent>

        <TabsContent value="permissions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Permission Management</CardTitle>
              <CardDescription>
                Manage user permissions and access levels across branches
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Permission Management</p>
                <p className="text-sm">Advanced permission controls coming soon.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};