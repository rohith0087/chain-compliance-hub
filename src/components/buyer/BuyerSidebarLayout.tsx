import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Building2, 
  Users, 
  ListChecks, 
  FileCheck, 
  FileText, 
  BarChart3, 
  Plus, 
  Settings, 
  LogOut,
  Home,
  ChevronDown,
  Search,
  Bell,
  User,
  Compass,
  UserCheck,
  Send,
  UserPlus,
  Upload,
  CreditCard,
  Bot,
  TrendingUp,
  AlertTriangle,
  ClipboardCheck,
  GitBranch,
  Package,
  FolderKanban
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRoles } from '@/hooks/useUserRoles';
import { useTranslation } from 'react-i18next';
import { useCompanyBranches } from '@/hooks/useCompanyBranches';
import { useBranchContext } from '@/contexts/BranchContext';
import { useCompanyPermissions } from '@/hooks/useCompanyPermissions';
import { supabase } from '@/integrations/supabase/client';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import NotificationCenter from '@/components/notifications/NotificationCenter';
import { SubscriptionStatusWidget } from '@/components/subscription/SubscriptionStatusWidget';
import { BranchSelector } from '@/components/company/BranchSelector';
import { HelpButton } from '@/components/support/HelpButton';
import { CommandPaletteSearch } from './CommandPaletteSearch';

interface NavigationItem {
  title: string;
  icon: any;
  value: string;
  badge?: number;
  submenu?: {
    title: string;
    value: string;
    icon?: any;
    badge?: number;
  }[];
}

interface BuyerSidebarLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  user: {
    roles: ('buyer' | 'supplier')[];
    name: string;
    currentRole: 'buyer' | 'supplier';
  };
  onLogout: () => void;
  onRoleSwitch: (role: 'buyer' | 'supplier') => void;
  onShowRequestForm: () => void;
  onShowSettings: () => void;
  onShowQuickOnboarding: () => void;
  onShowBulkInvite: () => void;
  buyerProfile: any;
  companyId?: string;
}

export function BuyerSidebarLayout({
  children,
  activeTab,
  onTabChange,
  user,
  onLogout,
  onRoleSwitch,
  onShowRequestForm,
  onShowSettings,
  onShowQuickOnboarding,
  onShowBulkInvite,
  buyerProfile,
  companyId
}: BuyerSidebarLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation(['dashboard', 'common']);
  const { profile } = useAuth();
  const { hasRole } = useUserRoles();
  const sidebar = useSidebar();
  const collapsed = sidebar?.state === 'collapsed';

  // Resolve company ID for team members vs owners
  const [resolvedCompanyId, setResolvedCompanyId] = useState<string | null>(null);

  useEffect(() => {
    const resolveCompanyId = async () => {
      if (!profile?.id) return;
      
      // Check if user is a team member first
      const { data: companyUserData } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('profile_id', profile.id)
        .eq('company_type', 'buyer')
        .in('status', ['active', 'pending'])
        .maybeSingle();
      
      if (companyUserData?.company_id) {
        // Team member - use company_id from company_users
        setResolvedCompanyId(companyUserData.company_id);
      } else {
        // Company owner - use buyerProfile.id
        setResolvedCompanyId(buyerProfile?.id || null);
      }
    };
    
    resolveCompanyId();
  }, [profile?.id, buyerProfile?.id, supabase]);

  // Company branches management - use resolved company ID
  const {
    branches,
    currentBranch,
    switchBranch,
    loading: branchesLoading,
    hasAllBranchAccess
  } = useCompanyBranches(resolvedCompanyId, 'buyer');

  const { setCurrentBranch } = useBranchContext();
  
  // Get permissions for the current user - use resolved company ID
  const effectiveCompanyId = companyId || resolvedCompanyId;
  const { canAccessRoute, isCompanyOwner, role } = useCompanyPermissions(effectiveCompanyId, 'buyer');

  // Sync branch context with local branch state
  useEffect(() => {
    setCurrentBranch(currentBranch);
  }, [currentBranch, setCurrentBranch]);

  // Define navigation items with role requirements
  const navigationItems: NavigationItem[] = [
    {
      title: t('common:navigation.dashboard'),
      icon: Home,
      value: 'dashboard'
    },
    {
      title: t('common:navigation.suppliers'),
      icon: Users,
      value: 'suppliers',
      submenu: [
        { title: 'Discovery', value: 'suppliers', icon: Search },
        { title: 'Supplier Map', value: 'supplier-map', icon: Compass },
        { title: 'Connection Requests', value: 'supplier-requests', icon: UserCheck },
        { title: 'Pre-populate Documents', value: 'pre-populate', icon: Upload }
      ]
    },
    {
      title: 'Requests & Documents',
      icon: FileCheck,
      value: 'requests',
      submenu: [
        { title: t('common:navigation.requests'), value: 'requests', icon: ListChecks },
        { title: t('common:navigation.documents'), value: 'documents', icon: FileCheck },
        { title: 'Templates', value: 'templates', icon: FileText },
        { title: 'Document Sets', value: 'document-sets', icon: FolderKanban }
      ]
    },
    {
      title: t('common:navigation.compliance'),
      icon: BarChart3,
      value: 'compliance',
      submenu: [
        { title: 'Overview', value: 'compliance', icon: BarChart3 },
        { title: 'Item Compliance', value: 'item-compliance', icon: Package },
        { title: 'Facility Matrix', value: 'facility-matrix', icon: Building2 }
      ]
    },
    // Assignments tab - phased out for next build
    // {
    //   title: 'Assignments',
    //   icon: ClipboardCheck,
    //   value: 'assignments'
    // },
    {
      title: 'Onboarding Pipeline',
      icon: GitBranch,
      value: 'onboarding'
    },
    // {
    //   title: 'Agents',
    //   icon: Bot,
    //   value: 'agents'
    // },
    {
      title: t('dashboard:company.title'),
      icon: Building2,
      value: 'company'
    },
    {
      title: 'Subscription & Billing',
      icon: CreditCard,
      value: 'subscription'
    }
  ].filter(item => {
    // Filter out items based on permissions
    // Company Management and Subscription require company owner (not just admin)
    if (item.value === 'company' || item.value === 'subscription') {
      return isCompanyOwner();
    }
    // Check other navigation permissions
    if (!canAccessRoute(item.value)) {
      return false;
    }
    return true;
  });

  const isActiveRoute = (value: string) => activeTab === value;
  
  const hasActiveSubmenu = (item: NavigationItem) => {
    if (!item.submenu) return false;
    return item.submenu.some(sub => isActiveRoute(sub.value));
  };

  const handleMenuClick = (value: string) => {
    // Switch to All Branches view when clicking Onboarding Pipeline
    if (value === 'onboarding') {
      setCurrentBranch(null); // Set to null for all branches view
    }
    onTabChange(value);
  };

  const handleSpecialAction = (action: string) => {
    switch (action) {
      case 'new-request':
        onShowRequestForm();
        break;
      case 'quick-onboarding':
        onShowQuickOnboarding();
        break;
      case 'bulk-invite':
        onShowBulkInvite();
        break;
      case 'chat':
        navigate('/chat');
        break;
      case 'subscription':
        navigate('/subscription');
        break;
    }
  };

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar className="border-r">
        <SidebarHeader className="border-b px-3 py-4">
          <div className="flex items-center gap-3">
            {/* Company Logo - displays uploaded logo or default Building2 icon */}
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary overflow-hidden">
              {buyerProfile?.company_logo_url ? (
                <>
                  <img 
                    src={buyerProfile.company_logo_url} 
                    alt="Company Logo"
                    className="h-full w-full object-contain"
                    onError={(e) => {
                      // Fallback to default icon if image fails to load
                      const target = e.currentTarget;
                      target.style.display = 'none';
                      const fallback = target.nextElementSibling as HTMLElement;
                      if (fallback) {
                        fallback.classList.remove('hidden');
                      }
                    }}
                  />
                  {/* Hidden fallback icon */}
                  <Building2 className="h-4 w-4 text-primary-foreground hidden" />
                </>
              ) : (
                <Building2 className="h-4 w-4 text-primary-foreground" />
              )}
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="text-sm font-semibold">
                  {buyerProfile?.company_name || 'Buyer Portal'}
                </span>
                <span className="text-xs text-muted-foreground">
                  {user.name}
                </span>
              </div>
            )}
          </div>
        </SidebarHeader>

        <SidebarContent>
          {/* Quick Actions */}
          <SidebarGroup>
            <SidebarGroupLabel>Quick Actions</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem data-guide-id="quick-new-request">
                  <SidebarMenuButton 
                    onClick={() => handleSpecialAction('new-request')}
                    className="relative group bg-gradient-to-r from-primary to-primary-hover text-white hover:shadow-lg transition-all duration-300"
                  >
                    <div className="relative">
                      <div className="absolute inset-0 bg-white/30 blur-sm" />
                      <Plus className="h-4 w-4 relative z-10" />
                    </div>
                    <span className="font-medium">New Request</span>
                    {currentBranch && !collapsed && (
                      <Badge className="ml-auto text-xs bg-white/20 text-white border-white/30">
                        {currentBranch.branch_name}
                      </Badge>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    onClick={() => handleSpecialAction('chat')}
                    className="hover:bg-secondary/10 hover:text-secondary transition-colors"
                  >
                    <Compass className="h-4 w-4" />
                    <span>Compliance Compass</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem data-guide-id="quick-bulk-invite">
                  <SidebarMenuButton 
                    onClick={() => handleSpecialAction('bulk-invite')}
                    className="hover:bg-accent/10 hover:text-accent transition-colors"
                  >
                    <Send className="h-4 w-4" />
                    <span>Bulk Invite</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Main Navigation */}
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navigationItems.map((item) => (
                <SidebarMenuItem key={item.value} className="relative" data-guide-id={`nav-${item.value}`}>
                    {/* Active indicator gradient bar */}
                    {isActiveRoute(item.value) && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary to-secondary rounded-r-full" />
                    )}
                    <SidebarMenuButton
                      isActive={isActiveRoute(item.value) || hasActiveSubmenu(item)}
                      onClick={() => handleMenuClick(item.value)}
                      className={`group transition-all duration-300 ${
                        isActiveRoute(item.value) 
                          ? 'bg-primary/10 text-primary hover:bg-primary/15' 
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      <div className="relative">
                        {isActiveRoute(item.value) && (
                          <div className="absolute inset-0 bg-primary/30 blur-lg" />
                        )}
                        <item.icon className="h-4 w-4 relative z-10" />
                      </div>
                      <span className={isActiveRoute(item.value) ? 'font-medium' : ''}>
                        {item.title}
                      </span>
                      {item.submenu && (
                        <ChevronDown 
                          className={`ml-auto h-4 w-4 transition-transform duration-300 ${
                            hasActiveSubmenu(item) ? 'rotate-180' : ''
                          }`} 
                        />
                      )}
                      {item.badge && (
                        <Badge className="ml-auto bg-primary text-white">
                          {item.badge}
                        </Badge>
                      )}
                    </SidebarMenuButton>
                    {item.submenu && hasActiveSubmenu(item) && (
                      <SidebarMenuSub>
                        {item.submenu.map((subItem) => (
                          <SidebarMenuSubItem key={subItem.value}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={isActiveRoute(subItem.value)}
                            >
                              <button
                                onClick={() => handleMenuClick(subItem.value)}
                                className="w-full"
                              >
                                {subItem.icon && <subItem.icon className="h-4 w-4" />}
                                <span>{subItem.title}</span>
                                {subItem.badge && (
                                  <Badge variant="secondary" className="ml-auto">
                                    {subItem.badge}
                                  </Badge>
                                )}
                              </button>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="p-3">
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-auto p-2 w-full justify-start" data-guide-id="profile-dropdown">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={profile?.avatar_url} />
                    <AvatarFallback>
                      {user.name?.charAt(0)?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {!collapsed && (
                    <div className="flex flex-col items-start ml-2 flex-1">
                      <span className="text-sm font-medium truncate">
                        {user.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {hasAllBranchAccess 
                          ? 'Buyer' 
                          : `Buyer - ${currentBranch?.branch_name || 'No Branch'}`
                        }
                      </span>
                    </div>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={onShowSettings} data-guide-id="settings-menu-item">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                {hasRole('supplier') && (
                  <DropdownMenuItem onClick={() => onRoleSwitch('supplier')}>
                    <User className="mr-2 h-4 w-4" />
                    {t('common:navigation.switchTo', { role: 'supplier' })}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLogout} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  {t('common:navigation.logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </SidebarFooter>
      </Sidebar>

      <div className="flex-1 flex flex-col">
        {/* Top Header */}
        <header className="h-16 border-t border-t-primary/10 bg-white/95 backdrop-blur-xl sticky top-0 z-50 shadow-sm">
          <div className="flex h-full items-center justify-between px-6">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="-ml-1" />
              
              {/* Global Search Bar - Command Palette */}
              <div className="hidden md:block">
              <CommandPaletteSearch
                onTabChange={onTabChange}
                onShowRequestForm={onShowRequestForm}
                onShowSettings={onShowSettings}
                onShowQuickOnboarding={onShowQuickOnboarding}
                onShowBulkInvite={onShowBulkInvite}
                buyerId={resolvedCompanyId || buyerProfile?.id}
                onSelectSupplier={(supplierId, supplierName) => {
                  // Navigate to suppliers tab - could enhance to open detail modal
                  onTabChange('suppliers');
                }}
                onSelectDocument={(documentId) => {
                  // Navigate to documents tab with highlight
                  sessionStorage.setItem('highlight_document_request_id', documentId);
                  onTabChange('documents');
                }}
                onSelectOnboarding={(requestId) => {
                  // Navigate to onboarding tab
                  onTabChange('onboarding');
                }}
              />
              </div>

              {(branches.length > 1 || hasAllBranchAccess) && (
                <BranchSelector
                  branches={branches}
                  currentBranch={currentBranch}
                  onBranchChange={switchBranch}
                  loading={branchesLoading}
                  showAllBranchesOption={hasAllBranchAccess}
                />
              )}
            </div>
            
            <div className="flex items-center gap-3">
              <SubscriptionStatusWidget compact />
              <NotificationCenter 
                onNavigate={(tab, referenceId) => {
                  onTabChange(tab);
                  if (referenceId) {
                    sessionStorage.setItem('highlight_document_request_id', referenceId);
                  }
                }}
              />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <div className="container mx-auto py-6 px-4">
            {children}
          </div>
        </main>
      </div>

      {/* Floating Help Button */}
      <HelpButton 
        source="buyer_portal"
        user={{
          id: profile?.id,
          email: profile?.email,
          name: profile?.full_name || user.name,
          companyId: buyerProfile?.id,
          companyName: buyerProfile?.company_name,
          userType: 'buyer'
        }}
      />
    </div>
  );
}

export default BuyerSidebarLayout;