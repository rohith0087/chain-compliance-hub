import React, { useState, useEffect } from 'react';
import { Building2, Users, Shield, MapPin, Plus, ArrowRight, UserPlus, Mail, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCompanyBranches, CompanyBranch } from '@/hooks/useCompanyBranches';
import { useCompanyPermissions } from '@/hooks/useCompanyPermissions';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { BranchSelector } from './BranchSelector';
import { BranchManagement } from './BranchManagement';
import { CompanyUserManagement } from './CompanyUserManagement';
import { PermissionManagementInterface } from './PermissionManagementInterface';
import UnauthorizedAccess from '@/components/auth/UnauthorizedAccess';
import { formatDistanceToNow } from 'date-fns';

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
    deleteBranch,
    removeUser,
    inviteUserToBranch,
    resendInvitation,
    switchBranch,
    refetch
  } = useCompanyBranches(companyId, companyType);

  const { canViewCompanyManagement, role, isOwner } = useCompanyPermissions(companyId, companyType);
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  
  // State for "other" company info (for dual-role user invitations)
  const [otherCompanyInfo, setOtherCompanyInfo] = useState<{
    id: string;
    name: string;
    branches: CompanyBranch[];
  } | null>(null);

  // Fetch "other" company info if user owns both buyer and supplier companies
  useEffect(() => {
    const fetchOtherCompany = async () => {
      if (!user) return;
      
      const otherType = companyType === 'buyer' ? 'supplier' : 'buyer';
      const otherTable = companyType === 'buyer' ? 'suppliers' : 'buyers';
      
      // Query the other company owned by this user
      const { data: otherCompany } = await supabase
        .from(otherTable)
        .select('id, company_name')
        .eq('profile_id', user.id)
        .maybeSingle();
      
      if (otherCompany) {
        // Fetch branches for the other company
        const { data: otherBranches } = await supabase
          .from('company_branches')
          .select('*')
          .eq('company_id', otherCompany.id)
          .eq('company_type', otherType)
          .eq('status', 'active');
        
        setOtherCompanyInfo({
          id: otherCompany.id,
          name: otherCompany.company_name,
          branches: (otherBranches || []) as CompanyBranch[]
        });
      } else {
        setOtherCompanyInfo(null);
      }
    };
    
    fetchOtherCompany();
  }, [user, companyType]);

  // Check permission - only company owner can access
  if (!loading && !canViewCompanyManagement()) {
    return <UnauthorizedAccess requiredRoles={['company_owner']} currentRole={isOwner ? 'company_owner' : role} />;
  }

  const stats = {
    totalBranches: branches.length,
    totalUsers: companyUsers.filter(u => u.status === 'active').length,
    pendingInvitations: companyUsers.filter(u => u.status === 'pending').length,
    activeBranches: branches.filter(b => b.status === 'active').length
  };

  // Get activity items with proper context
  const getActivityItems = () => {
    return companyUsers.slice(0, 4).map((companyUser) => {
      const isAllBranches = !companyUser.branch_id && companyUser.role === 'company_admin';
      const branchName = isAllBranches
        ? 'All Branches'
        : branches.find(b => b.id === companyUser.branch_id)?.branch_name || 'Unknown Branch';
      
      const isPending = companyUser.status === 'pending';
      const timeAgo = companyUser.created_at 
        ? formatDistanceToNow(new Date(companyUser.created_at), { addSuffix: true })
        : 'Recently';
      
      return {
        id: companyUser.id,
        type: isPending ? 'invitation' : 'join',
        email: companyUser.profile?.email || 'Unknown user',
        branchName,
        isAllBranches,
        timeAgo,
        isPending
      };
    });
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

  const activityItems = getActivityItems();

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

      {/* Actionable Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Branches Card - Clickable */}
        <Card 
          className="cursor-pointer hover:shadow-md transition-all hover:border-primary/50 group"
          onClick={() => setActiveTab('branches')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Branches</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="pb-2">
            <div className="text-2xl font-bold">{stats.totalBranches}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeBranches} active
            </p>
          </CardContent>
          <CardFooter className="pt-0 pb-3">
            <div className="flex items-center gap-3 text-xs">
              <button 
                onClick={(e) => { e.stopPropagation(); setActiveTab('branches'); }}
                className="text-primary hover:underline flex items-center gap-1"
              >
                <Plus className="h-3 w-3" /> Add Branch
              </button>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                View All <ArrowRight className="h-3 w-3" />
              </span>
            </div>
          </CardFooter>
        </Card>

        {/* Team Members Card - Clickable */}
        <Card 
          className="cursor-pointer hover:shadow-md transition-all hover:border-primary/50 group"
          onClick={() => setActiveTab('users')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Members</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-secondary/50 flex items-center justify-center group-hover:bg-secondary transition-colors">
              <Users className="h-4 w-4 text-secondary-foreground" />
            </div>
          </CardHeader>
          <CardContent className="pb-2">
            <div className="text-2xl font-bold flex items-center gap-2">
              {stats.totalUsers}
              {stats.pendingInvitations > 0 && (
                <Badge variant="secondary" className="text-xs font-normal">
                  {stats.pendingInvitations} pending
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.pendingInvitations === 0 ? 'All invitations accepted' : 'Active team members'}
            </p>
          </CardContent>
          <CardFooter className="pt-0 pb-3">
            <button 
              onClick={(e) => { e.stopPropagation(); setActiveTab('users'); }}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <UserPlus className="h-3 w-3" /> Invite Member
            </button>
          </CardFooter>
        </Card>

        {/* Current Branch Card - Smart Empty State */}
        <Card className={!currentBranch ? 'border-dashed border-warning/50 bg-warning/5' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Branch</CardTitle>
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
              currentBranch ? 'bg-accent/50' : 'bg-warning/20'
            }`}>
              <MapPin className={`h-4 w-4 ${currentBranch ? 'text-accent-foreground' : 'text-warning'}`} />
            </div>
          </CardHeader>
          <CardContent className="pb-2">
            {currentBranch ? (
              <>
                <div className="text-2xl font-bold truncate">{currentBranch.branch_name}</div>
                <p className="text-xs text-muted-foreground truncate">
                  {currentBranch.location || 'No location set'}
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-warning">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">No branch selected</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Select a branch to manage users & documents
                </p>
              </>
            )}
          </CardContent>
          <CardFooter className="pt-0 pb-3">
            {currentBranch ? (
              <button 
                onClick={() => {}}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                Switch Branch <ArrowRight className="h-3 w-3" />
              </button>
            ) : branches.length > 0 ? (
              <BranchSelector
                branches={branches}
                currentBranch={currentBranch}
                onBranchChange={switchBranch}
                loading={loading}
                compact
              />
            ) : (
              <button 
                onClick={() => setActiveTab('branches')}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <Plus className="h-3 w-3" /> Create First Branch
              </button>
            )}
          </CardFooter>
        </Card>

        {/* Access Level Card - Informational */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Your Access</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
              <Shield className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="pb-2">
            <div className="text-2xl font-bold flex items-center gap-2">
              Admin
              <CheckCircle2 className="h-5 w-5 text-success" />
            </div>
            <p className="text-xs text-muted-foreground">
              Full company access
            </p>
          </CardContent>
          <CardFooter className="pt-0 pb-3">
            <button 
              onClick={() => setActiveTab('permissions')}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              View Permissions <ArrowRight className="h-3 w-3" />
            </button>
          </CardFooter>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="branches">Branches</TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              Users
              {stats.pendingInvitations > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                  {stats.pendingInvitations}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="permissions">Permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Recommended Action - Primary CTA */}
            <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                    <UserPlus className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Invite Team Members</CardTitle>
                    <CardDescription className="text-xs">Grow your team by inviting colleagues</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 pb-4">
                <Button 
                  onClick={() => setActiveTab('users')}
                  className="w-full"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Now
                  <ArrowRight className="h-4 w-4 ml-auto" />
                </Button>
              </CardContent>
              <CardFooter className="pt-0 border-t border-border/50">
                <div className="grid grid-cols-2 gap-2 w-full pt-4">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setActiveTab('branches')}
                    className="justify-start"
                  >
                    <Building2 className="h-4 w-4 mr-2" />
                    Manage Branches
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setActiveTab('permissions')}
                    className="justify-start"
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Permissions
                  </Button>
                </div>
              </CardFooter>
            </Card>

            {/* Recent Activity - Enhanced */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Recent Activity
                </CardTitle>
                <CardDescription className="text-xs">Latest updates in your company</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {activityItems.length > 0 ? (
                    activityItems.map((item) => (
                      <div key={item.id} className="flex items-start gap-3 text-sm">
                        <div className={`mt-0.5 h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                          item.isPending ? 'bg-warning/20' : 'bg-success/20'
                        }`}>
                          {item.isPending ? (
                            <Mail className="h-3 w-3 text-warning" />
                          ) : (
                            <CheckCircle2 className="h-3 w-3 text-success" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-foreground truncate">
                            {item.isPending ? (
                              <>Invitation sent to <span className="font-medium">{item.email}</span></>
                            ) : (
                              <><span className="font-medium">{item.email}</span> joined</>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <span className={item.isAllBranches ? 'text-primary' : ''}>{item.branchName}</span>
                            <span>•</span>
                            <span>{item.timeAgo}</span>
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6">
                      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                        <Users className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">No activity yet</p>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setActiveTab('users')}
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Invite your first team member
                      </Button>
                    </div>
                  )}
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
            onDeleteBranch={deleteBranch}
            loading={loading}
          />
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <CompanyUserManagement
            branches={branches}
            companyUsers={companyUsers}
            companyType={companyType}
            otherCompanyId={otherCompanyInfo?.id}
            otherCompanyName={otherCompanyInfo?.name}
            otherCompanyBranches={otherCompanyInfo?.branches}
            onInviteUser={inviteUserToBranch}
            onResendInvitation={resendInvitation}
            onRemoveUser={removeUser}
            loading={loading}
          />
        </TabsContent>

        <TabsContent value="permissions" className="space-y-4">
          <PermissionManagementInterface
            companyId={companyId}
            companyType={companyType}
            companyUsers={companyUsers}
            onPermissionUpdate={refetch}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};