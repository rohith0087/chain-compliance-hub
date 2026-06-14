import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Play,
  Volume2,
  VolumeX,
  HelpCircle,
  ArrowLeftRight
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRoles } from '@/hooks/useUserRoles';
import { useTranslation } from 'react-i18next';
import { useWorkspaceProfile } from '@/hooks/useWorkspaceProfile';
import { useCompanyBranches } from '@/hooks/useCompanyBranches';
import { useCompanyPermissions } from '@/hooks/useCompanyPermissions';
import { useBranchContext } from '@/contexts/BranchContext';
import { useImpersonation } from '@/contexts/ImpersonationContext';
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
import { BranchSelector } from '@/components/company/BranchSelector';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useNotificationSound } from '@/hooks/useNotificationSound';
import { WhatsNewDialog } from '@/components/shared/WhatsNewDialog';
import { APP_VERSION } from '@/config/version';

// Version button component for sidebar footer
function VersionButton() {
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  
  return (
    <>
      <button
        onClick={() => setShowWhatsNew(true)}
        className="w-full py-2.5 px-4 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors text-primary font-medium text-sm"
      >
        v{APP_VERSION}
      </button>
      <WhatsNewDialog open={showWhatsNew} onOpenChange={setShowWhatsNew} />
    </>
  );
}

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
  unreadMessages?: number;
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
  connectedBuyers = 0,
  unreadMessages = 0
}: SupplierSidebarLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation(['supplier', 'common']);
  const { t: wsT, flags } = useWorkspaceProfile();
  const { profile, user: authUser } = useAuth();
  const { hasRole } = useUserRoles();
  const sidebar = useSidebar();
  const collapsed = sidebar?.state === 'collapsed';
  const { isEnabled, isUnlocked, toggleEnabled } = useNotificationSound();
  const { isImpersonating, impersonatedCompany } = useImpersonation();
  
  // Single active dropdown state for hover UX (future-proofing for submenus)
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Hover handlers for improved UX
  const handleMouseEnter = useCallback((value: string, hasSubmenu: boolean) => {
    if (!hasSubmenu) return;
    
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    
    hoverTimeoutRef.current = setTimeout(() => {
      setActiveDropdown(value);
    }, 1000);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    
    hoverTimeoutRef.current = setTimeout(() => {
      setActiveDropdown(null);
    }, 500);
  }, []);

  const cancelHoverTimeout = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Resolve company ID for team members (impersonation-aware)
  const [resolvedSupplierId, setResolvedSupplierId] = useState<string | null>(supplierProfile?.id || null);

  useEffect(() => {
    const resolveCompanyId = async () => {
      // During impersonation, use the impersonated company ID directly
      if (isImpersonating && impersonatedCompany?.type === 'supplier') {
        setResolvedSupplierId(impersonatedCompany.id);
        return;
      }

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
  }, [authUser, supplierProfile?.id, isImpersonating, impersonatedCompany]);

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
      title: wsT.buyer_connections,
      icon: Users,
      value: 'connections',
      badge: connectedBuyers > 0 ? connectedBuyers : undefined
    },
    {
      title: 'Messages',
      icon: MessageSquare,
      value: 'messages',
      badge: unreadMessages > 0 ? unreadMessages : undefined
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
    // Navigate to /messages instead of changing tabs
    if (value === 'messages') {
      navigate('/messages');
      return;
    }
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
      case 'messages':
        navigate('/messages');
        break;
    }
  };

  return (
    <div className={`flex w-full ${activeTab === 'messages' ? 'h-screen overflow-hidden' : 'min-h-screen'} ${isImpersonating ? 'pt-12' : ''}`}>
      <Sidebar className="border-r border-gray-200 bg-white">
        <SidebarHeader className="border-b border-gray-200 px-3 py-4 bg-white">
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
                    <span>Simulation Mode</span>
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
                  <SidebarMenuItem 
                    key={item.value}
                    onMouseEnter={() => handleMouseEnter(item.value, !!item.submenu)}
                    onMouseLeave={handleMouseLeave}
                  >
                    <SidebarMenuButton
                      isActive={isActiveRoute(item.value)}
                      onClick={() => handleMenuClick(item.value)}
                      className="group transition-colors duration-200"
                    >
                      <item.icon className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
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

        <SidebarFooter className="p-3">
          <VersionButton />
        </SidebarFooter>
      </Sidebar>

      <div className={`flex-1 flex flex-col ${activeTab === 'messages' ? 'overflow-hidden' : ''}`}>
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleEnabled}
                    className="h-8 w-8 p-0"
                  >
                    {isEnabled ? (
                      <Volume2 
                        className={`h-4 w-4 ${
                          isUnlocked 
                            ? 'text-primary' 
                            : 'text-muted-foreground animate-pulse'
                        }`} 
                      />
                    ) : (
                      <VolumeX className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {!isEnabled 
                    ? 'Enable notification sounds' 
                    : !isUnlocked 
                      ? 'Click anywhere to enable sounds' 
                      : 'Mute notification sounds'}
                </TooltipContent>
              </Tooltip>
              {/* Role Switch Button - Only for dual-role users */}
              {hasRole('buyer') && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onRoleSwitch('buyer')}
                      className="h-9 w-9 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                    >
                      <ArrowLeftRight className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Switch to Buyer</TooltipContent>
                </Tooltip>
              )}
              
              <NotificationCenter
                onNavigate={async (tab, referenceId) => {
                  onTabChange(tab);
                  if (referenceId) {
                    try {
                      const { data: uploadData } = await supabase
                        .from('document_uploads')
                        .select('request_id')
                        .eq('id', referenceId)
                        .maybeSingle();
                      
                      if (uploadData?.request_id) {
                        sessionStorage.setItem('highlight_request_id', uploadData.request_id);
                      } else {
                        sessionStorage.setItem('highlight_request_id', referenceId);
                      }
                    } catch {
                      sessionStorage.setItem('highlight_request_id', referenceId);
                    }
                  }
                }}
                
              />
              
              {/* User Profile Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={profile?.avatar_url} />
                      <AvatarFallback className="bg-green-600 text-white text-sm">
                        {user.name?.charAt(0)?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 bg-popover">
                  <div 
                    className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted rounded-md transition-colors"
                    onClick={() => navigate('/profile-settings')}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={profile?.avatar_url} />
                      <AvatarFallback className="bg-green-600 text-white">
                        {user.name?.charAt(0)?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium truncate">{profile?.full_name || user.name}</span>
                      <span className="text-xs text-muted-foreground truncate">{profile?.email}</span>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/help')} className="gap-2">
                    <HelpCircle className="h-4 w-4" />
                    Help & Support
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onLogout} className="gap-2 text-destructive focus:text-destructive">
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className={`flex-1 ${activeTab === 'messages' ? 'overflow-hidden' : 'overflow-auto'}`}>
          {activeTab === 'messages' ? (
            <div className="h-full overflow-hidden">
              {children}
            </div>
          ) : (
            <div className="container mx-auto py-6 px-4">
              {children}
            </div>
          )}
        </main>
      </div>

    </div>
  );
}