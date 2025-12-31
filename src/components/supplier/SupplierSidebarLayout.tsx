import React, { useState, useEffect, useRef } from 'react';
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
  MessageSquare,
  UserCheck,
  Send,
  UserPlus,
  Upload,
  Shield,
  Clock,
  CheckCircle,
  CreditCard,
  Package,
  UserCog,
  Play
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRoles } from '@/hooks/useUserRoles';
import { useTranslation } from 'react-i18next';
import { useCompanyBranches } from '@/hooks/useCompanyBranches';
import { useCompanyPermissions } from '@/hooks/useCompanyPermissions';
import { useBranchContext } from '@/contexts/BranchContext';
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

interface NavigationItem {
  title: string;
  icon: any;
  value: string;
  badge?: number;
  ownerOnly?: boolean;
  submenu?: {
    title: string;
    value: string;
    icon?: any;
    badge?: number;
  }[];
}

interface SupplierSidebarLayoutProps {
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
  onShowSettings: () => void;
  supplierProfile: any;
  onConnectWithBuyer?: () => void;
  onUploadDocument?: () => void;
  pendingRequests?: number;
  connectedBuyers?: number;
}

export function SupplierSidebarLayout({
  children,
  activeTab,
  onTabChange,
  user,
  onLogout,
  onRoleSwitch,
  onShowSettings,
  supplierProfile,
  onConnectWithBuyer,
  onUploadDocument,
  pendingRequests = 0,
  connectedBuyers = 0
}: SupplierSidebarLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation(['supplier', 'common']);
  const { profile, user: authUser } = useAuth();
  const { hasRole } = useUserRoles();
  const sidebar = useSidebar();
  const collapsed = sidebar?.state === 'collapsed';

  // Resolve company ID for team members
  const [resolvedSupplierId, setResolvedSupplierId] = useState<string | null>(supplierProfile?.id || null);

  useEffect(() => {
    const resolveCompanyId = async () => {
      if (!authUser) return;
      
      // Check if user is a team member
      const { data: teamMember } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('profile_id', authUser.id)
        .eq('company_type', 'supplier')
        .eq('status', 'active')
        .maybeSingle();
      
      if (teamMember) {
        setResolvedSupplierId(teamMember.company_id);
      } else if (supplierProfile?.id) {
        setResolvedSupplierId(supplierProfile.id);
      }
    };
    
    resolveCompanyId();
  }, [authUser, supplierProfile?.id]);

  // Company branches management with resolved ID
  const {
    branches,
    currentBranch,
    switchBranch,
    loading: branchesLoading,
    hasAllBranchAccess
  } = useCompanyBranches(resolvedSupplierId, 'supplier');

  // Company permissions with resolved ID
  const { canViewCompanyManagement, isOwner, role } = useCompanyPermissions(resolvedSupplierId, 'supplier');

  // Branch context for global state sync
  const { setCurrentBranch, setAllBranchesView } = useBranchContext();

  // Track synced branch ID to prevent circular updates
  const syncedBranchIdRef = React.useRef<string | null | undefined>(undefined);

  // Sync branch changes to BranchContext - use ID comparison to prevent infinite loop
  useEffect(() => {
    const newBranchId = currentBranch?.id || null;
    
    // Only sync if the branch ID actually changed
    if (syncedBranchIdRef.current === newBranchId) return;
    syncedBranchIdRef.current = newBranchId;
    
    if (currentBranch) {
      setCurrentBranch(currentBranch);
      setAllBranchesView(false);
    } else if (hasAllBranchAccess) {
      setCurrentBranch(null);
      setAllBranchesView(true);
    }
  }, [currentBranch?.id, hasAllBranchAccess, setCurrentBranch, setAllBranchesView]);

  // Handle branch change and sync to context
  const handleBranchChange = (branch: any) => {
    switchBranch(branch);
    if (branch) {
      setCurrentBranch(branch);
      setAllBranchesView(false);
    } else {
      setCurrentBranch(null);
      setAllBranchesView(true);
    }
  };

  // Format role name for display (e.g., 'branch_manager' → 'Branch Manager')
  const formatRole = (roleName: string | null): string => {
    if (!roleName) return '';
    return roleName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const navigationItems: NavigationItem[] = [
    {
      title: t('supplier:tabs.overview'),
      icon: Home,
      value: 'overview'
    },
    {
      title: t('supplier:tabs.requests'),
      icon: ListChecks,
      value: 'requests',
      badge: pendingRequests > 0 ? pendingRequests : undefined
    },
    {
      title: t('supplier:tabs.documents'),
      icon: FileCheck,
      value: 'documents'
    },
    {
      title: 'Document Library',
      icon: FileText,
      value: 'library'
    },
    // Items tab hidden for now - feature will be enabled in future iteration
    // {
    //   title: t('supplier:tabs.items'),
    //   icon: Package,
    //   value: 'items'
    // },
    {
      title: t('supplier:tabs.contacts'),
      icon: UserCog,
      value: 'contacts',
      ownerOnly: true // Only visible to company owners
    },
    {
      title: 'Buyer Connections',
      icon: Users,
      value: 'connections',
      badge: connectedBuyers > 0 ? connectedBuyers : undefined
    },
    {
      title: t('supplier:tabs.compliance'),
      icon: BarChart3,
      value: 'compliance'
    },
    {
      title: t('supplier:tabs.company'),
      icon: Building2,
      value: 'company',
      ownerOnly: true // Only visible to company owners
    }
  ];

  // Filter navigation items based on permissions
  const filteredNavigationItems = navigationItems.filter(item => {
    if (item.ownerOnly) {
      return isOwner;
    }
    return true;
  });

  const isActiveRoute = (value: string) => activeTab === value;

  const handleMenuClick = (value: string) => {
    onTabChange(value);
  };

  const handleSpecialAction = (action: string) => {
    switch (action) {
      case 'connect-buyer':
        // Navigate to buyer connections tab
        onTabChange('connections');
        break;
      case 'upload-document':
        onUploadDocument?.();
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
      <Sidebar className="border-r bg-white/80 backdrop-blur-sm">
        <SidebarHeader className="border-b border-gray-200/50 px-3 py-4 bg-white/50">
          <div className="flex items-center gap-3">
            {/* Company Logo - displays uploaded logo or default Shield icon */}
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-600 overflow-hidden">
              {supplierProfile?.company_logo_url ? (
                <>
                  <img 
                    src={supplierProfile.company_logo_url} 
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
                  <Shield className="h-4 w-4 text-white hidden" />
                </>
              ) : (
                <Shield className="h-4 w-4 text-white" />
              )}
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="text-sm font-semibold">
                  {supplierProfile?.company_name || t('supplier:title')}
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
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    onClick={() => handleSpecialAction('connect-buyer')}
                    className="text-green-600 hover:text-green-600 hover:bg-green-50"
                  >
                    <UserPlus className="h-4 w-4" />
                    <span>Connect with Buyer</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    onClick={() => handleSpecialAction('upload-document')}
                    className="text-blue-600 hover:text-blue-600 hover:bg-blue-50"
                  >
                    <Upload className="h-4 w-4" />
                    <span>Upload Document</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    onClick={() => navigate('/supplier-simulation')}
                    className="text-amber-600 hover:text-amber-600 hover:bg-amber-50"
                  >
                    <Play className="h-4 w-4" />
                    <span>Practice Mode</span>
                    <Badge variant="outline" className="ml-auto text-xs bg-amber-50 border-amber-200 text-amber-700">
                      New
                    </Badge>
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
                {filteredNavigationItems.map((item) => (
                  <SidebarMenuItem key={item.value}>
                    <SidebarMenuButton
                      isActive={isActiveRoute(item.value)}
                      onClick={() => handleMenuClick(item.value)}
                      className="group"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                      {item.badge && (
                        <Badge variant="secondary" className="ml-auto">
                          {item.badge}
                        </Badge>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t border-gray-200/50 p-3 bg-white/50">
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-auto p-2 w-full justify-start">
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
                        {hasAllBranchAccess || isOwner
                          ? 'Supplier' 
                          : `Supplier - ${formatRole(role) || 'Team Member'}`
                        }
                      </span>
                    </div>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={onShowSettings}>
                  <Settings className="mr-2 h-4 w-4" />
                  {t('supplier:settings')}
                </DropdownMenuItem>
                {hasRole('buyer') && (
                  <DropdownMenuItem onClick={() => onRoleSwitch('buyer')}>
                    <User className="mr-2 h-4 w-4" />
                    {t('common:navigation.switchTo', { role: 'buyer' })}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLogout} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  {t('supplier:logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </SidebarFooter>
      </Sidebar>

      <div className="flex-1 flex flex-col">
        {/* Top Header */}
        <header className="h-14 border-b border-gray-200/50 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 sticky top-0 z-50">
          <div className="flex h-full items-center justify-between px-4">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="-ml-1" />
              {branches.length > 1 && (
                <BranchSelector
                  branches={branches}
                  currentBranch={currentBranch}
                  onBranchChange={handleBranchChange}
                  loading={branchesLoading}
                  showAllBranchesOption={hasAllBranchAccess}
                />
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <NotificationCenter
                onNavigate={async (tab, referenceId) => {
                  onTabChange(tab);
                  // Store reference ID in sessionStorage for deep-linking
                  // Handle backward compatibility: referenceId could be request_id (new) or document_upload_id (old)
                  if (referenceId) {
                    // Try to use it as request_id first (new format)
                    // If it's actually a document_upload_id (old format), resolve to request_id
                    try {
                      const { data: uploadData } = await supabase
                        .from('document_uploads')
                        .select('request_id')
                        .eq('id', referenceId)
                        .maybeSingle();
                      
                      if (uploadData?.request_id) {
                        // Old format: was document_upload_id, use resolved request_id
                        sessionStorage.setItem('highlight_request_id', uploadData.request_id);
                      } else {
                        // New format or direct request_id - use as-is
                        sessionStorage.setItem('highlight_request_id', referenceId);
                      }
                    } catch {
                      // Fallback: use referenceId as-is
                      sessionStorage.setItem('highlight_request_id', referenceId);
                    }
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
        source="supplier_portal"
        user={{
          id: profile?.id,
          email: profile?.email,
          name: profile?.full_name || user.name,
          companyId: supplierProfile?.id,
          companyName: supplierProfile?.company_name,
          userType: 'supplier'
        }}
      />
    </div>
  );
}