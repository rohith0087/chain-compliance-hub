import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Building2,
  Users,
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
  Volume2,
  VolumeX,
  HelpCircle,
  ArrowLeftRight,
  Share2,
  PanelLeft,
  PanelLeftClose
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
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
import { ThemeToggle } from '@/components/ui/theme-toggle';
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
  evidenceSharingEnabled?: boolean;
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
  unreadMessages = 0,
  evidenceSharingEnabled = false
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
  const isMobile = useIsMobile();

  // Sidebar display mode: pinned (280px in flow) vs auto-hide (72px icon rail with hover overlay)
  const [mode, setMode] = useState<'pinned' | 'auto-hide'>('pinned');
  const [overlayOpen, setOverlayOpen] = useState(false);
  const openTimerRef = useRef<NodeJS.Timeout | null>(null);
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('supplier-sidebar-mode') : null;
    if (saved === 'auto-hide' || saved === 'pinned') setMode(saved);
  }, []);
  useEffect(() => {
    try { localStorage.setItem('supplier-sidebar-mode', mode); } catch {}
  }, [mode]);

  const clearOverlayTimers = useCallback(() => {
    if (openTimerRef.current) { clearTimeout(openTimerRef.current); openTimerRef.current = null; }
    if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; }
  }, []);
  const scheduleOverlayOpen = useCallback(() => {
    if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; }
    if (openTimerRef.current) return;
    openTimerRef.current = setTimeout(() => {
      setOverlayOpen(true);
      openTimerRef.current = null;
    }, 1100);
  }, []);
  const scheduleOverlayClose = useCallback(() => {
    if (openTimerRef.current) { clearTimeout(openTimerRef.current); openTimerRef.current = null; }
    if (closeTimerRef.current) return;
    closeTimerRef.current = setTimeout(() => {
      setOverlayOpen(false);
      closeTimerRef.current = null;
    }, 300);
  }, []);
  const cancelOverlayClose = useCallback(() => {
    if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; }
  }, []);

  useEffect(() => {
    if (mode === 'pinned') {
      clearOverlayTimers();
      setOverlayOpen(false);
    }
  }, [mode, clearOverlayTimers]);
  useEffect(() => () => clearOverlayTimers(), [clearOverlayTimers]);

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
    // Document Requests tab removed from nav for now (pending a redesign);
    // the 'requests' view and its data plumbing are left intact so internal
    // deep links (dashboard notifications, pending-request cards) still work.
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
    ...(evidenceSharingEnabled ? [{
      title: 'Evidence Sharing',
      icon: Share2,
      value: 'evidence-sharing'
    }] : []),
    {
      title: t('supplier:tabs.compliance'),
      icon: BarChart3,
      value: 'compliance'
    },
    {
      title: 'Settings',
      icon: Settings,
      value: 'settings',
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

  const hasActiveSubmenu = (item: NavigationItem) => {
    if (!item.submenu) return false;
    return item.submenu.some(sub => isActiveRoute(sub.value));
  };

  const toggleSubmenu = (value: string) => {
    setActiveDropdown(prev => (prev === value ? null : value));
  };

  const isSubmenuExpanded = (item: NavigationItem) => {
    if (!item.submenu) return false;
    return activeDropdown === item.value || hasActiveSubmenu(item);
  };

  const handleMenuClick = (value: string) => {
    // Navigate to /messages instead of changing tabs
    if (value === 'messages') {
      navigate('/messages');
      return;
    }
    // Open Settings Modal
    if (value === 'settings') {
      onShowSettings();
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

  const workspaceItems = filteredNavigationItems.filter((i) => i.value !== 'settings');
  const adminItems = filteredNavigationItems.filter((i) => i.value === 'settings');

  const renderItem = (item: NavigationItem) => {
    const active = isActiveRoute(item.value);
    const expanded = isSubmenuExpanded(item);
    const childActive = hasActiveSubmenu(item);
    const showActive = active || childActive;
    return (
      <SidebarMenuItem
        key={item.value}
        className="relative px-2"
        data-guide-id={`nav-${item.value}`}
        onMouseEnter={() => handleMouseEnter(item.value, !!item.submenu)}
        onMouseLeave={handleMouseLeave}
      >
        {showActive && (
          <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-primary" />
        )}
        <SidebarMenuButton
          isActive={showActive}
          onClick={() => (item.submenu ? toggleSubmenu(item.value) : handleMenuClick(item.value))}
          className={`group h-11 px-3 rounded-xl gap-3 text-body font-medium transition-colors ${
            showActive
              ? 'bg-primary/10 text-primary hover:bg-primary/15 font-semibold'
              : 'text-foreground/80 hover:bg-sidebar-accent hover:text-foreground'
          }`}
        >
          <item.icon className="h-5 w-5 shrink-0 transition-transform duration-200 group-hover:scale-110" />
          <span className="truncate">{item.title}</span>
          {item.submenu && (
            <ChevronDown
              className={`ml-auto h-4 w-4 transition-transform duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${
                expanded ? 'rotate-180' : ''
              }`}
            />
          )}
          {item.badge && (
            <Badge className="ml-auto bg-primary text-primary-foreground">{item.badge}</Badge>
          )}
        </SidebarMenuButton>
        {item.submenu && (
          <div
            className={`grid transition-all duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${
              expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="overflow-hidden">
              <SidebarMenuSub
                className="ml-7 mt-1 pl-3 border-l border-sidebar-border"
                onMouseEnter={cancelHoverTimeout}
                onMouseLeave={handleMouseLeave}
              >
                {item.submenu.map((subItem) => {
                  const subActive = isActiveRoute(subItem.value);
                  return (
                    <SidebarMenuSubItem key={subItem.value}>
                      <SidebarMenuSubButton asChild isActive={subActive}>
                        <button
                          onClick={() => handleMenuClick(subItem.value)}
                          className={`w-full group h-8 px-3 rounded-lg text-body transition-colors ${
                            subActive
                              ? 'bg-primary/5 text-primary font-medium'
                              : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent'
                          }`}
                        >
                          {subItem.icon && (
                            <subItem.icon className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                          )}
                          <span className="truncate">{subItem.title}</span>
                          {subItem.badge && (
                            <Badge variant="secondary" className="ml-auto">
                              {subItem.badge}
                            </Badge>
                          )}
                        </button>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  );
                })}
              </SidebarMenuSub>
            </div>
          </div>
        )}
      </SidebarMenuItem>
    );
  };

  const SupplierLogo = ({ size = 'h-10 w-10', icon = 'h-5 w-5' }: { size?: string; icon?: string }) => (
    <div className={`flex ${size} items-center justify-center rounded-full bg-primary overflow-hidden shrink-0`}>
      {supplierProfile?.company_logo_url ? (
        <>
          <img
            src={supplierProfile.company_logo_url}
            alt="Company Logo"
            className="h-full w-full object-contain"
            onError={(e) => {
              const target = e.currentTarget;
              target.style.display = 'none';
              const fallback = target.nextElementSibling as HTMLElement;
              if (fallback) fallback.classList.remove('hidden');
            }}
          />
          <Shield className={`${icon} text-primary-foreground hidden`} />
        </>
      ) : (
        <Shield className={`${icon} text-primary-foreground`} />
      )}
    </div>
  );

  const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

  const fullBody = (
    <>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-3 bg-transparent">
        <div className="flex items-center gap-3">
          <SupplierLogo />
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-body font-semibold text-foreground truncate leading-tight">
                {supplierProfile?.company_name || t('supplier:title')}
              </span>
              <span className="text-small text-muted-foreground truncate leading-tight mt-0.5">
                {user.name}
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Upload Document — standalone primary action */}
        <SidebarGroup className="pt-3 pb-0 px-3">
          <SidebarGroupContent>
            <button
              onClick={() => handleSpecialAction('upload-document')}
              className="w-full h-12 rounded-[14px] cta-texture text-primary-foreground font-semibold text-body shadow-sm flex items-center justify-center gap-2.5 transition-colors"
            >
              <span className="h-7 w-7 rounded-full bg-card/15 flex items-center justify-center shrink-0">
                <Upload className="h-4 w-4" />
              </span>
              {!collapsed && <span>Upload Document</span>}
              {currentBranch && !collapsed && (
                <Badge className="ml-1 text-micro bg-card/20 text-white border-white/30 font-medium">
                  {currentBranch.branch_name}
                </Badge>
              )}
            </button>
          </SidebarGroupContent>
        </SidebarGroup>

        {workspaceItems.length > 0 && (
          <SidebarGroup className="pt-3">
            <SidebarGroupLabel className="px-4 pb-1.5 text-micro font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
              Workspace
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {workspaceItems.map(renderItem)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        {adminItems.length > 0 && (
          <SidebarGroup className="pt-2">
            <SidebarGroupLabel className="px-4 pb-1.5 text-micro font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
              Admin
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {adminItems.map(renderItem)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3 space-y-2 border-t border-sidebar-border">
        {!collapsed && (
          <button
            onClick={() => navigate('/help')}
            className="w-full rounded-2xl bg-card border border-sidebar-border p-3 flex items-center gap-3 hover:bg-sidebar-accent transition-colors text-left"
          >
            <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <HelpCircle className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-body font-semibold text-foreground leading-tight">Need help?</div>
              <div className="text-caption text-muted-foreground truncate leading-tight mt-0.5">Docs & guides</div>
            </div>
          </button>
        )}
        <VersionButton />
      </SidebarFooter>
    </>
  );

  const railBody = (
    <div className="flex h-full flex-col items-center py-3 gap-2">
      <SupplierLogo />

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => handleSpecialAction('upload-document')}
            className="mt-2 h-11 w-11 rounded-xl cta-texture text-primary-foreground flex items-center justify-center shadow-sm transition-colors"
            aria-label="Upload Document"
          >
            <Upload className="h-5 w-5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">Upload Document</TooltipContent>
      </Tooltip>

      <div className="mt-2 flex flex-col items-center gap-1 w-full px-2">
        {filteredNavigationItems.map((item) => {
          const active = isActiveRoute(item.value) || (item.submenu?.some(s => isActiveRoute(s.value)) ?? false);
          return (
            <Tooltip key={item.value}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleMenuClick(item.value)}
                  className={`relative h-11 w-11 rounded-xl flex items-center justify-center transition-colors ${
                    active ? 'bg-primary/10 text-primary' : 'text-foreground/80 hover:bg-sidebar-accent hover:text-foreground'
                  }`}
                  aria-label={item.title}
                >
                  {active && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-primary" />}
                  <item.icon className="h-5 w-5" />
                  {item.badge ? (
                    <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-micro font-semibold flex items-center justify-center">
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{item.title}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      <div className="flex-1" />

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => navigate('/help')}
            className="h-10 w-10 rounded-xl bg-card border border-sidebar-border text-primary flex items-center justify-center hover:bg-sidebar-accent transition-colors"
            aria-label="Help"
          >
            <HelpCircle className="h-5 w-5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">Help & docs</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-micro text-muted-foreground/70 font-medium select-none" aria-label={`TraceR2C v${APP_VERSION}`}>
            v{APP_VERSION}
          </span>
        </TooltipTrigger>
        <TooltipContent side="right">TraceR2C v{APP_VERSION}</TooltipContent>
      </Tooltip>
    </div>
  );

  const inFlowWidth = mode === 'pinned' ? 280 : 72;
  const overlayTopOffset = isImpersonating ? 48 : 0;

  return (
    <div className={`flex w-full ${activeTab === 'messages' ? 'h-screen overflow-hidden' : 'min-h-screen'} ${isImpersonating ? 'pt-12' : ''}`}>
      {isMobile ? (
        <Sidebar className="border-r border-sidebar-border bg-sidebar">
          {fullBody}
        </Sidebar>
      ) : (
        <>
          <aside
            data-mode={mode}
            style={{ width: inFlowWidth, transition: `width 220ms ${EASE}` }}
            className="hidden md:flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar sticky top-0 h-screen overflow-hidden motion-reduce:transition-none"
            onMouseEnter={mode === 'auto-hide' ? scheduleOverlayOpen : undefined}
            onMouseLeave={mode === 'auto-hide' ? scheduleOverlayClose : undefined}
          >
            {mode === 'pinned' ? fullBody : railBody}
          </aside>

          {mode === 'auto-hide' && (
            <>
              <div
                aria-hidden
                style={{ top: overlayTopOffset }}
                className="hidden md:block fixed left-0 bottom-0 w-2 z-50"
                onMouseEnter={scheduleOverlayOpen}
              />
              <aside
                style={{
                  width: 280,
                  top: overlayTopOffset,
                  transform: overlayOpen ? 'translateX(0)' : 'translateX(-110%)',
                  transition: `transform ${overlayOpen ? 260 : 220}ms ${EASE}, opacity 200ms ${EASE}`,
                  opacity: overlayOpen ? 1 : 0,
                  pointerEvents: overlayOpen ? 'auto' : 'none',
                }}
                className="hidden md:flex fixed left-0 bottom-0 z-50 flex-col border-r border-sidebar-border bg-sidebar shadow-2xl overflow-hidden motion-reduce:transition-none"
                onMouseEnter={cancelOverlayClose}
                onMouseLeave={scheduleOverlayClose}
              >
                {fullBody}
              </aside>
            </>
          )}
        </>
      )}

      <div className={`flex-1 flex flex-col ${activeTab === 'messages' ? 'overflow-hidden' : ''}`}>
        {/* Top Header */}
        <header className="h-[72px] border-t border-t-primary/10 bg-card/95 backdrop-blur-xl sticky top-0 z-40 shadow-sm">
          <div className="flex h-full items-center justify-between px-8">
            <div className="flex items-center gap-4">
              {isMobile ? (
                <SidebarTrigger className="-ml-1" />
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setMode((m) => (m === 'pinned' ? 'auto-hide' : 'pinned'))}
                      className="-ml-1 h-9 w-9"
                      aria-label={mode === 'pinned' ? 'Switch to auto-hide sidebar' : 'Pin sidebar'}
                    >
                      {mode === 'pinned' ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {mode === 'pinned' ? 'Auto-hide sidebar' : 'Pin sidebar'}
                  </TooltipContent>
                </Tooltip>
              )}

              {(branches.length > 1 || hasAllBranchAccess) && (
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
                      className="h-9 w-9 hover:bg-primary/10 hover:text-primary transition-colors"
                    >
                      <ArrowLeftRight className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Switch to {wsT.buyer}</TooltipContent>
                </Tooltip>
              )}
              
              <ThemeToggle />

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
                      <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                        {user.name?.charAt(0)?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 bg-popover">
                  <div 
                    className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted rounded-md transition-colors"
                    onClick={() => {
                      onShowSettings();
                      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
                    }}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={profile?.avatar_url} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
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