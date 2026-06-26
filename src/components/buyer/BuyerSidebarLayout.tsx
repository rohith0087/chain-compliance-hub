import { useState, useEffect, useRef, useCallback } from 'react';
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
  GitBranch,
  Package,
  FolderKanban,
  FileImage,
  MessageSquare,
  HelpCircle,
  ArrowLeftRight,
  FlaskConical,
  ListTree,
  ShieldCheck,
  Activity,
  Inbox,
  PanelLeft,
  PanelLeftClose
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/hooks/useAuth';
import { useUserRoles } from '@/hooks/useUserRoles';
import { useTranslation } from 'react-i18next';
import { useCompanyBranches } from '@/hooks/useCompanyBranches';
import { useBranchContext } from '@/contexts/BranchContext';
import { useCompanyPermissions } from '@/hooks/useCompanyPermissions';
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

import { CommandPaletteSearch } from './CommandPaletteSearch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { WhatsNewDialog } from '@/components/shared/WhatsNewDialog';
import { APP_VERSION } from '@/config/version';
import { getWorkspaceProfileForIndustry } from '@/config/workspaceProfiles';

// Version button component for sidebar footer
function VersionButton() {
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  
  return (
    <>
      <button
        onClick={() => setShowWhatsNew(true)}
        className="w-full px-1 py-1 text-[12px] text-slate-400 hover:text-slate-600 transition-colors text-left"
      >
        TraceR2C v{APP_VERSION}
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
  unreadMessages?: number;
  requirementEngineEnabled?: boolean;
  complianceDecisionsEnabled?: boolean;
  dossiersEnabled?: boolean;
  emailReplyIngestionEnabled?: boolean;
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
  companyId,
  unreadMessages = 0,
  requirementEngineEnabled = false,
  complianceDecisionsEnabled = false,
  dossiersEnabled = false,
  emailReplyIngestionEnabled = false
}: BuyerSidebarLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation(['dashboard', 'common']);
  const { profile } = useAuth();
  const { hasRole } = useUserRoles();
  const sidebar = useSidebar();
  const collapsed = sidebar?.state === 'collapsed';
  const { isImpersonating, impersonatedCompany } = useImpersonation();
  const isMobile = useIsMobile();

  // Sidebar display mode: pinned (280px in flow) vs auto-hide (72px icon rail with hover overlay)
  const [mode, setMode] = useState<'pinned' | 'auto-hide'>('pinned');
  const [overlayOpen, setOverlayOpen] = useState(false);
  const openTimerRef = useRef<NodeJS.Timeout | null>(null);
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('buyer-sidebar-mode') : null;
    if (saved === 'auto-hide' || saved === 'pinned') setMode(saved);
  }, []);
  useEffect(() => {
    try { localStorage.setItem('buyer-sidebar-mode', mode); } catch {}
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

  // When switching back to pinned, drop any overlay state
  useEffect(() => {
    if (mode === 'pinned') {
      clearOverlayTimers();
      setOverlayOpen(false);
    }
  }, [mode, clearOverlayTimers]);
  useEffect(() => () => clearOverlayTimers(), [clearOverlayTimers]);

  // Single active dropdown state (accordion behavior)
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Hover handlers for improved UX
  const handleMouseEnter = useCallback((value: string, hasSubmenu: boolean) => {
    if (!hasSubmenu) return;
    
    // Clear any pending timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    
    // Delay before opening to prevent accidental triggers
    hoverTimeoutRef.current = setTimeout(() => {
      setActiveDropdown(value);
    }, 1000);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    
    // Graceful buffer before closing
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

  // Resolve company ID for team members vs owners (impersonation-aware)
  const [resolvedCompanyId, setResolvedCompanyId] = useState<string | null>(null);

  useEffect(() => {
    const resolveCompanyId = async () => {
      // During impersonation, use the impersonated company ID directly
      if (isImpersonating && impersonatedCompany?.type === 'buyer') {
        setResolvedCompanyId(impersonatedCompany.id);
        return;
      }

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
  }, [profile?.id, buyerProfile?.id, isImpersonating, impersonatedCompany]);

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

  // Workspace profile (terminology pack) driven by buyer industry
  const wsProfile = getWorkspaceProfileForIndustry(buyerProfile?.industry);
  const wsTerms = wsProfile.terms;
  const wsFlags = wsProfile.flags;

  const suppliersSubmenu = [
    { title: 'Discovery', value: 'suppliers', icon: Search },
    !wsFlags.hideSupplierMap && { title: `${wsTerms.supplier} Map`, value: 'supplier-map', icon: Compass },
    !wsFlags.hidePrePopulate && { title: 'Pre-populate Documents', value: 'pre-populate', icon: Upload }
  ].filter(Boolean) as { title: string; value: string; icon: any }[];

  const requestsSubmenu = [
    { title: t('common:navigation.documents'), value: 'documents', icon: FileCheck },
    emailReplyIngestionEnabled && { title: 'Email Intake', value: 'email-intake', icon: Inbox },
    { title: 'Activity', value: 'document-activity', icon: Activity },
    { title: 'Templates', value: 'templates', icon: FileText },
    !wsFlags.hideBuyerSamples && { title: 'Buyer Samples', value: 'sample-templates', icon: FileImage },
    { title: 'Document Sets', value: 'document-sets', icon: FolderKanban },
    !wsFlags.hideCOAAnalysis && { title: 'COA Analysis', value: 'coa-analysis', icon: FlaskConical },
    { title: 'Corporate Documents', value: 'corporate-documents', icon: Building2 },
    { title: 'Communication Log', value: 'communication-log', icon: Bell }
  ].filter(Boolean) as { title: string; value: string; icon: any }[];

  const complianceSubmenu = [
    { title: 'Workbench', value: 'compliance', icon: BarChart3 },
    requirementEngineEnabled && { title: 'Requirements', value: 'requirements', icon: ListTree },
    complianceDecisionsEnabled && { title: 'Compliance Decisions', value: 'compliance-decisions', icon: ShieldCheck },
    dossiersEnabled && { title: 'Dossiers', value: 'dossiers', icon: FileText },
    { title: wsTerms.supplier_risk, value: 'supplier-risk', icon: AlertTriangle },
    !wsFlags.hideItemCompliance && { title: 'Item Compliance', value: 'item-compliance', icon: Package },
    !wsFlags.hideFacilityMatrix && { title: 'Facility Matrix', value: 'facility-matrix', icon: Building2 }
  ].filter(Boolean) as { title: string; value: string; icon: any }[];

  // Define navigation items with role requirements
  const navigationItems: NavigationItem[] = [
    {
      title: t('common:navigation.dashboard'),
      icon: Home,
      value: 'dashboard'
    },
    {
      title: wsTerms.suppliers,
      icon: Users,
      value: 'suppliers',
      submenu: suppliersSubmenu
    },
    {
      title: 'Requests & Documents',
      icon: FileCheck,
      value: 'requests',
      submenu: requestsSubmenu
    },
    !wsFlags.hideCompliance && {
      title: t('common:navigation.compliance'),
      icon: BarChart3,
      value: 'compliance',
      submenu: complianceSubmenu
    },
    // Assignments tab - phased out for next build
    // {
    //   title: 'Assignments',
    //   icon: ClipboardCheck,
    //   value: 'assignments'
    // },
    {
      title: wsTerms.onboarding_pipeline,
      icon: GitBranch,
      value: 'onboarding'
    },
    !wsFlags.hideMessages && {
      title: 'Messages',
      icon: MessageSquare,
      value: 'messages',
      badge: unreadMessages > 0 ? unreadMessages : undefined
    },
    // {
    //   title: 'Agents',
    //   icon: Bot,
    //   value: 'agents'
    // },
    {
      title: 'Settings',
      icon: Settings,
      value: 'settings'
    }
  ].filter(item => {
    // Filter out items based on permissions
    // Company Management requires company owner (not just admin)
    if (item.value === 'settings') {
      return isCompanyOwner();
    }
    // Messages is always available - it navigates to /messages
    if (item.value === 'messages') {
      return true;
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

  // Toggle submenu on click (accordion behavior - only one open at a time)
  const toggleSubmenu = (value: string) => {
    setActiveDropdown(prev => prev === value ? null : value);
  };

  const isSubmenuExpanded = (item: NavigationItem) => {
    if (!item.submenu) return false;
    // Expanded if actively open OR has active child route
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
        navigate(wsFlags.showAuditFindings ? '/audit-assistant' : '/chat');
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
      {(() => {
      const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
      const fullBody = (
        <>
        <SidebarHeader className="border-b border-[#E5E7EB] px-4 py-3 bg-transparent">
          <div className="flex items-center gap-3">
            {/* Company Logo - displays uploaded logo or default Building2 icon */}
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary overflow-hidden shrink-0">
              {buyerProfile?.company_logo_url ? (
                <>
                  <img 
                    src={buyerProfile.company_logo_url} 
                    alt="Company Logo"
                    className="h-full w-full object-contain"
                    onError={(e) => {
                      const target = e.currentTarget;
                      target.style.display = 'none';
                      const fallback = target.nextElementSibling as HTMLElement;
                      if (fallback) {
                        fallback.classList.remove('hidden');
                      }
                    }}
                  />
                  <Building2 className="h-5 w-5 text-primary-foreground hidden" />
                </>
              ) : (
                <Building2 className="h-5 w-5 text-primary-foreground" />
              )}
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-[15px] font-semibold text-slate-900 truncate leading-tight">
                  {buyerProfile?.company_name || 'Buyer Portal'}
                </span>
                <span className="text-[13px] text-slate-500 truncate leading-tight mt-0.5">
                  {user.name}
                </span>
              </div>
            )}
          </div>
        </SidebarHeader>

        <SidebarContent>
          {/* + New Request Button - Standalone at top */}
          <SidebarGroup className="pt-3 pb-0 px-3">
            <SidebarGroupContent>
              <button
                data-guide-id="quick-new-request"
                onClick={() => handleSpecialAction('new-request')}
                className="w-full h-12 rounded-[14px] bg-primary hover:bg-primary-hover text-primary-foreground font-semibold text-[15px] shadow-sm flex items-center justify-center gap-2.5 transition-colors"
              >
                <span className="h-7 w-7 rounded-full bg-white/15 flex items-center justify-center shrink-0">
                  <Plus className="h-4 w-4" />
                </span>
                {!collapsed && <span>New Request</span>}
                {currentBranch && !collapsed && (
                  <Badge className="ml-1 text-[11px] bg-white/20 text-white border-white/30 font-medium">
                    {currentBranch.branch_name}
                  </Badge>
                )}
              </button>
            </SidebarGroupContent>
          </SidebarGroup>


          {/* Render a navigation group with Workspace/Admin separation */}
          {(() => {
            const adminValues = new Set(['settings']);
            const workspaceItems = navigationItems.filter((i) => !adminValues.has(i.value));
            const adminItems = navigationItems.filter((i) => adminValues.has(i.value));

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
                    className={`group h-11 px-3 rounded-xl gap-3 text-[15px] font-medium transition-colors ${
                      showActive
                        ? 'bg-primary/10 text-primary hover:bg-primary/15 font-semibold'
                        : 'text-slate-700 hover:bg-[#F1F5F9] hover:text-slate-900'
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
                      <Badge className="ml-auto bg-primary text-white">{item.badge}</Badge>
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
                          className="ml-7 mt-1 pl-3 border-l border-[#E5E7EB]"
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
                                    className={`w-full group h-8 px-3 rounded-lg text-[14px] transition-colors ${
                                      subActive
                                        ? 'bg-primary/5 text-primary font-medium'
                                        : 'text-slate-500 hover:text-slate-900 hover:bg-[#F1F5F9]'
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

            return (
              <>
                {workspaceItems.length > 0 && (
                  <SidebarGroup className="pt-3">
                    <SidebarGroupLabel className="px-4 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
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
                    <SidebarGroupLabel className="px-4 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Admin
                    </SidebarGroupLabel>
                    <SidebarGroupContent>
                      <SidebarMenu className="gap-0.5">
                        {adminItems.map(renderItem)}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </SidebarGroup>
                )}
              </>
            );
          })()}
        </SidebarContent>

        <SidebarFooter className="p-3 space-y-2 border-t border-[#E5E7EB]">
          {!collapsed && (
            <button
              onClick={() => navigate('/help')}
              className="w-full rounded-2xl bg-white border border-[#E5E7EB] p-3 flex items-center gap-3 hover:bg-[#F1F5F9] transition-colors text-left"
            >
              <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <HelpCircle className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[14px] font-semibold text-slate-900 leading-tight">Need help?</div>
                <div className="text-[12px] text-slate-500 truncate leading-tight mt-0.5">Docs & guides</div>
              </div>
            </button>
          )}
          <VersionButton />
        </SidebarFooter>
        </>
      );

      const railBody = (
        <div className="flex h-full flex-col items-center py-3 gap-2">
          {/* Logo */}
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary overflow-hidden shrink-0">
            {buyerProfile?.company_logo_url ? (
              <img src={buyerProfile.company_logo_url} alt="Logo" className="h-full w-full object-contain" />
            ) : (
              <Building2 className="h-5 w-5 text-primary-foreground" />
            )}
          </div>

          {/* New Request */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => handleSpecialAction('new-request')}
                className="mt-2 h-11 w-11 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground flex items-center justify-center shadow-sm transition-colors"
                aria-label="New Request"
              >
                <Plus className="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">New Request</TooltipContent>
          </Tooltip>

          {/* Nav items - icon only */}
          <div className="mt-2 flex flex-col items-center gap-1 w-full px-2">
            {navigationItems.map((item) => {
              const active = isActiveRoute(item.value) || (item.submenu?.some(s => isActiveRoute(s.value)) ?? false);
              return (
                <Tooltip key={item.value}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => {
                        if (item.submenu) {
                          // Open overlay so user can pick a sub-item
                          cancelOverlayClose();
                          setOverlayOpen(true);
                          setActiveDropdown(item.value);
                        } else {
                          handleMenuClick(item.value);
                        }
                      }}
                      className={`relative h-11 w-11 rounded-xl flex items-center justify-center transition-colors ${
                        active ? 'bg-primary/10 text-primary' : 'text-slate-700 hover:bg-[#F1F5F9] hover:text-slate-900'
                      }`}
                      aria-label={item.title}
                    >
                      {active && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-primary" />}
                      <item.icon className="h-5 w-5" />
                      {item.badge ? (
                        <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-primary text-white text-[10px] font-semibold flex items-center justify-center">
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

          {/* Spacer */}
          <div className="flex-1" />

          {/* Help icon */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => navigate('/help')}
                className="h-10 w-10 rounded-xl bg-white border border-[#E5E7EB] text-primary flex items-center justify-center hover:bg-[#F1F5F9] transition-colors"
                aria-label="Help"
              >
                <HelpCircle className="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Help & docs</TooltipContent>
          </Tooltip>

          {/* Version dot */}
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-[10px] text-slate-400 font-medium select-none" aria-label={`TraceR2C v${APP_VERSION}`}>
                v{APP_VERSION}
              </span>
            </TooltipTrigger>
            <TooltipContent side="right">TraceR2C v{APP_VERSION}</TooltipContent>
          </Tooltip>
        </div>
      );

      // Mobile: shadcn Sheet via <Sidebar>
      if (isMobile) {
        return (
          <Sidebar className="border-r border-[#E5E7EB] bg-[#FAFAFB]">
            {fullBody}
          </Sidebar>
        );
      }

      // Desktop: custom rail/pinned + optional overlay
      const inFlowWidth = mode === 'pinned' ? 280 : 72;
      const overlayTopOffset = 72 + (isImpersonating ? 48 : 0);

      return (
        <>
          {/* In-flow sidebar (rail in auto-hide, full in pinned) */}
          <aside
            data-mode={mode}
            style={{
              width: inFlowWidth,
              transition: `width 220ms ${EASE}`,
            }}
            className="hidden md:flex shrink-0 flex-col border-r border-[#E5E7EB] bg-[#FAFAFB] sticky top-0 h-screen overflow-hidden motion-reduce:transition-none"
            onMouseEnter={mode === 'auto-hide' ? scheduleOverlayOpen : undefined}
            onMouseLeave={mode === 'auto-hide' ? scheduleOverlayClose : undefined}
          >
            {mode === 'pinned' ? fullBody : railBody}
          </aside>

          {/* Auto-hide: edge trigger + overlay */}
          {mode === 'auto-hide' && (
            <>
              <div
                aria-hidden
                style={{ top: overlayTopOffset }}
                className="hidden md:block fixed left-0 bottom-0 w-2 z-30"
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
                className="hidden md:flex fixed left-0 bottom-0 z-40 flex-col border-r border-t border-[#E5E7EB] bg-[#FAFAFB] shadow-2xl overflow-hidden motion-reduce:transition-none"
                onMouseEnter={cancelOverlayClose}
                onMouseLeave={scheduleOverlayClose}
              >
                {fullBody}
              </aside>
            </>
          )}
        </>
      );
      })()}


      <div className={`flex-1 flex flex-col ${activeTab === 'messages' ? 'overflow-hidden' : ''}`}>
        {/* Top Header */}
        <header className="h-[72px] border-t border-t-primary/10 bg-white/95 backdrop-blur-xl sticky top-0 z-50 shadow-sm">
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
            
            <div className="flex items-center gap-2">
              {/* Role Switch Button - Only for dual-role users */}
              {hasRole('supplier') && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onRoleSwitch('supplier')}
                      className="h-9 w-9 hover:bg-green-50 hover:text-green-600 transition-colors"
                    >
                      <ArrowLeftRight className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Switch to Supplier</TooltipContent>
                </Tooltip>
              )}
              
              <NotificationCenter 
                onNavigate={(tab, referenceId) => {
                  if (tab === 'create-onboarding') {
                    onTabChange('onboarding');
                    return;
                  }
                  
                  onTabChange(tab);
                  if (referenceId) {
                    sessionStorage.setItem('highlight_document_request_id', referenceId);
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
                      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); // Close menu
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
            <div className="container mx-auto py-[28px] px-[32px] max-w-[1440px]">
              {children}
            </div>
          )}
        </main>
      </div>

    </div>
  );
}

export default BuyerSidebarLayout;
