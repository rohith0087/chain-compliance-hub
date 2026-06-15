import React, { useState, useEffect } from 'react';
import { Building2, Users, Shield, MapPin, Plus, ArrowRight, UserPlus, Mail, Clock, CheckCircle2, AlertCircle, Settings, Bell, FileText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
import { DefaultOnboardingSettings } from '@/components/settings/DefaultOnboardingSettings';
import { NotificationSettingsForm } from '@/components/settings/NotificationSettingsForm';
import { LogoUploadWidget } from '@/components/settings/LogoUploadWidget';
import { AddressFields, emptyAddressData, AddressData } from '@/components/shared/AddressFields';
import { SafeSelect, SafeSelectItem } from '@/components/ui/SafeSelect';
import { VALID_INDUSTRIES } from '@/config/industries';
import { toast } from 'sonner';

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
  const [savingCompany, setSavingCompany] = useState(false);
  
  // State for company settings form
  const [companyData, setCompanyData] = useState({
    company_name: '',
    industry: '',
    contact_email: '',
    phone: '',
    company_logo_url: '',
    address: emptyAddressData()
  });
  
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

  // Load company data for settings tab
  useEffect(() => {
    const loadCompanyData = async () => {
      const table = companyType === 'buyer' ? 'buyers' : 'suppliers';
      const { data } = await supabase
        .from(table)
        .select('*')
        .eq('id', companyId)
        .single();
      
      if (data) {
        setCompanyData({
          company_name: data.company_name || '',
          industry: data.industry || '',
          contact_email: data.contact_email || '',
          phone: data.phone || '',
          company_logo_url: data.company_logo_url || '',
          address: {
            address_line1: data.address_line1 || '',
            address_line2: data.address_line2 || '',
            city: data.city || '',
            state: data.state || '',
            postal_code: data.postal_code || '',
            country: data.country || ''
          }
        });
      }
    };
    
    loadCompanyData();
  }, [companyId, companyType]);

  const handleCompanySubmit = async () => {
    setSavingCompany(true);
    try {
      const table = companyType === 'buyer' ? 'buyers' : 'suppliers';
      const { error } = await supabase
        .from(table)
        .update({
          company_name: companyData.company_name,
          industry: companyData.industry,
          contact_email: companyData.contact_email,
          phone: companyData.phone,
          company_logo_url: companyData.company_logo_url,
          address_line1: companyData.address.address_line1,
          address_line2: companyData.address.address_line2,
          city: companyData.address.city,
          state: companyData.address.state,
          postal_code: companyData.address.postal_code,
          country: companyData.address.country
        })
        .eq('id', companyId);
      
      if (error) throw error;
      toast.success('Company settings saved successfully');

      // Reload the page so the workspace profile hook re-fetches the updated
      // industry and applies the correct terminology (e.g. Auditor → Auditee profile).
      setTimeout(() => window.location.reload(), 800);
    } catch (error) {
      console.error('Error saving company settings:', error);
      toast.error('Failed to save company settings');
    } finally {
      setSavingCompany(false);
    }
  };


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

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="inline-flex h-12 items-center gap-1 rounded-full bg-white border border-border/40 p-1.5 justify-start shadow-sm">
            <TabsTrigger 
              value="overview"
              className="rounded-full px-5 py-2 text-sm font-medium transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:bg-transparent data-[state=inactive]:text-muted-foreground data-[state=inactive]:shadow-none hover:text-foreground"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger 
              value="branches"
              className="rounded-full px-5 py-2 text-sm font-medium transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:bg-transparent data-[state=inactive]:text-muted-foreground data-[state=inactive]:shadow-none hover:text-foreground"
            >
              Branches
            </TabsTrigger>
            <TabsTrigger 
              value="users" 
              className="rounded-full px-5 py-2 text-sm font-medium transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:bg-transparent data-[state=inactive]:text-muted-foreground data-[state=inactive]:shadow-none hover:text-foreground flex items-center gap-2"
            >
              Users
              {stats.pendingInvitations > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-xs rounded-full">
                  {stats.pendingInvitations}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="permissions"
              className="rounded-full px-5 py-2 text-sm font-medium transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:bg-transparent data-[state=inactive]:text-muted-foreground data-[state=inactive]:shadow-none hover:text-foreground"
            >
              Permissions
            </TabsTrigger>
            <TabsTrigger 
              value="company" 
              className="rounded-full px-5 py-2 text-sm font-medium transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:bg-transparent data-[state=inactive]:text-muted-foreground data-[state=inactive]:shadow-none hover:text-foreground flex items-center gap-1"
            >
              <Settings className="h-3.5 w-3.5" />
              Company
            </TabsTrigger>
            {companyType === 'buyer' && (
              <>
                <TabsTrigger 
                  value="onboarding" 
                  className="rounded-full px-5 py-2 text-sm font-medium transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:bg-transparent data-[state=inactive]:text-muted-foreground data-[state=inactive]:shadow-none hover:text-foreground flex items-center gap-1"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Onboarding
                </TabsTrigger>
                <TabsTrigger 
                  value="notifications" 
                  className="rounded-full px-5 py-2 text-sm font-medium transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:bg-transparent data-[state=inactive]:text-muted-foreground data-[state=inactive]:shadow-none hover:text-foreground flex items-center gap-1"
                >
                  <Bell className="h-3.5 w-3.5" />
                  Notifications
                </TabsTrigger>
              </>
            )}
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Actionable Stats Overview - Now inside Overview tab only */}
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

          {/* Invite Team + Recent Activity */}
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

        {/* Company Settings Tab */}
        <TabsContent value="company" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Company Profile
              </CardTitle>
              <CardDescription>
                Manage your company information and branding
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Logo Upload */}
              <div className="space-y-2">
                <Label>Company Logo</Label>
                <LogoUploadWidget
                  currentLogoUrl={companyData.company_logo_url}
                  onLogoUpdate={(url) => setCompanyData(prev => ({ ...prev, company_logo_url: url || '' }))}
                  embedded
                />
              </div>

              {/* Company Name & Industry */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company_name">Company Name</Label>
                  <Input
                    id="company_name"
                    value={companyData.company_name}
                    onChange={(e) => setCompanyData(prev => ({ ...prev, company_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="industry">Industry</Label>
                  <SafeSelect
                    value={companyData.industry}
                    onValueChange={(value) => setCompanyData(prev => ({ ...prev, industry: value }))}
                    placeholder="Select industry"
                  >
                    {VALID_INDUSTRIES.map((industry) => (
                      <SafeSelectItem key={industry} value={industry}>
                        {industry}
                      </SafeSelectItem>
                    ))}
                  </SafeSelect>
                </div>
              </div>

              {/* Contact Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contact_email">Contact Email</Label>
                  <Input
                    id="contact_email"
                    type="email"
                    value={companyData.contact_email}
                    onChange={(e) => setCompanyData(prev => ({ ...prev, contact_email: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={companyData.phone}
                    onChange={(e) => setCompanyData(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </div>
              </div>

              {/* Address Fields */}
              <div className="space-y-2">
                <Label>Company Address</Label>
                <AddressFields
                  data={companyData.address}
                  onChange={(field, value) => 
                    setCompanyData(prev => ({
                      ...prev,
                      address: { ...prev.address, [field]: value }
                    }))
                  }
                />
              </div>

              <Button onClick={handleCompanySubmit} disabled={savingCompany}>
                {savingCompany ? 'Saving...' : 'Save Company Settings'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onboarding Settings Tab (Buyer only) */}
        {companyType === 'buyer' && (
          <TabsContent value="onboarding" className="space-y-4">
            <DefaultOnboardingSettings />
          </TabsContent>
        )}

        {/* Notification Settings Tab (Buyer only) */}
        {companyType === 'buyer' && (
          <TabsContent value="notifications" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notification Settings
                </CardTitle>
                <CardDescription>
                  Configure how and when you receive notifications
                </CardDescription>
              </CardHeader>
              <CardContent>
                <NotificationSettingsForm />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};