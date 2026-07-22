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
  GitCompare,
  ListTree,
  BookOpenCheck,
  ClipboardCheck,
  Gauge,
  Wand2,
  ShieldCheck,
  Activity,
  Inbox,
  PanelLeft,
  PanelLeftClose,
  SlidersHorizontal,
  Plug
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
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { BranchSelector } from '@/components/company/BranchSelector';

import { CommandPaletteSearch } from './CommandPaletteSearch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { WhatsNewDialog } from '@/components/shared/WhatsNewDialog';
import { APP_VERSION } from '@/config/version';
import { getWorkspaceProfileForIndustry } from '@/config/workspaceProfiles';
import { navIconClass, navSubIconClass } from '@/design/system';

// Version button component for sidebar footer
function VersionButton() {
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  
  return (
    <>
      <button
        onClick={() => setShowWhatsNew(true)}
        className="w-full px-1 py-1 text-caption text-muted-foreground/70 hover:text-foreground/80 transition-colors text-left"
      >
        TraceR2C v{APP_VERSION}
      </button>
      <WhatsNewDialog open={showWhatsNew} onOpenChange={setShowWhatsNew} />
    </>
  );
}


// Maps each Settings submenu value to its micro-animation class (keyframes in
// index.css). Plays once on row hover via .group:hover and idles slowly while
// the row is the active route via .settings-sub-active.
const SETTINGS_SUB_ANIM: Record<string, string> = {
  settings: 'sanim-user',
  'settings-organization': 'sanim-building',
  'settings-security': 'sanim-shield',
  'settings-notifications': 'sanim-bell',
  'settings-preferences': 'sanim-sliders',
  'settings-integrations': 'sanim-plug',
  'settings-billing': 'sanim-card',
};

function AnimatedSubIcon({
  value,
  icon: Icon,
  className,
}: {
  value: string;
  icon: NavigationItem['icon'];
  className?: string;
}) {
  const anim = SETTINGS_SUB_ANIM[value];
  return <Icon className={anim ? `${className ?? ''} ${anim}` : className} />;
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

  // Dual-tier: hover preview of a section's tier-2 panel. Short delay in, graceful
  // delay out, so sweeping the rail feels smooth instead of flickery.
  const [previewValue, setPreviewValue] = useState<string | null>(null);
  const previewOpenRef = useRef<NodeJS.Timeout | null>(null);
  const previewCloseRef = useRef<NodeJS.Timeout | null>(null);
  const previewEnter = useCallback((value: string) => {
    if (previewCloseRef.current) { clearTimeout(previewCloseRef.current); previewCloseRef.current = null; }
    if (previewOpenRef.current) clearTimeout(previewOpenRef.current);
    previewOpenRef.current = setTimeout(() => { setPreviewValue(value); previewOpenRef.current = null; }, 130);
  }, []);
  const previewLeave = useCallback(() => {
    if (previewOpenRef.current) { clearTimeout(previewOpenRef.current); previewOpenRef.current = null; }
    if (previewCloseRef.current) clearTimeout(previewCloseRef.current);
    previewCloseRef.current = setTimeout(() => { setPreviewValue(null); previewCloseRef.current = null; }, 280);
  }, []);
  const previewCancelClose = useCallback(() => {
    if (previewCloseRef.current) { clearTimeout(previewCloseRef.current); previewCloseRef.current = null; }
  }, []);
  // Keeps the last previewed section mounted so the overlay can animate out.
  const lastPreviewRef = useRef<NavigationItem | null>(null);
  useEffect(() => () => {
    if (previewOpenRef.current) clearTimeout(previewOpenRef.current);
    if (previewCloseRef.current) clearTimeout(previewCloseRef.current);
  }, []);

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
    wsProfile.id === 'auditor' && { title: 'AI Document Comparison', value: 'document-comparison', icon: GitCompare },
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
    // Command Center and the old Workbench were the same job on two pages — merged
    // into one home at 'compliance' (renders Command Center for decisions-engine orgs,
    // the legacy dashboard otherwise).
    { title: 'Command Center', value: 'compliance', icon: Gauge },
    requirementEngineEnabled && { title: 'Frameworks', value: 'frameworks', icon: BookOpenCheck },
    requirementEngineEnabled && { title: 'Requirements', value: 'requirements', icon: ListTree },
    requirementEngineEnabled && { title: 'Requirement Extractor', value: 'requirement-extractor', icon: Wand2 },
    // Per-supplier Decisions, Evidence review, Assistant and Dossiers now live inside the
    // consolidated Supplier Compliance workspace (opened from Frameworks coverage or Suppliers).
    complianceDecisionsEnabled && { title: 'Review Queue', value: 'mapping-review', icon: ClipboardCheck },
    { title: wsTerms.supplier_risk, value: 'supplier-risk', icon: AlertTriangle },
    !wsFlags.hideItemCompliance && { title: 'Item Compliance', value: 'item-compliance', icon: Package },
    !wsFlags.hideFacilityMatrix && { title: 'Facility Matrix', value: 'facility-matrix', icon: Building2 }
  ].filter(Boolean) as { title: string; value: string; icon: any }[];

  const settingsSubmenu = [
    { title: 'Account', value: 'settings', icon: User },
    // Org + billing are owner-only surfaces; the whole Settings section is
    // owner-gated below too, but filter here so that stays true if the
    // parent gate ever relaxes.
    isCompanyOwner() && { title: 'Organization', value: 'settings-organization', icon: Building2 },
    { title: 'Security & sign-in', value: 'settings-security', icon: ShieldCheck },
    { title: 'Notifications', value: 'settings-notifications', icon: Bell },
    { title: 'Preferences', value: 'settings-preferences', icon: SlidersHorizontal },
    { title: 'Integrations', value: 'settings-integrations', icon: Plug },
    isCompanyOwner() && { title: 'Plan & Billing', value: 'settings-billing', icon: CreditCard }
  ].filter(Boolean) as { title: string; value: string; icon: NavigationItem['icon'] }[];

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
      value: 'settings',
      submenu: settingsSubmenu
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
    // Settings is a full page now (Settings-04 style tab in the dashboard).
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
        // Billing now lives inside the Settings section, not the standalone route.
        onTabChange('settings-billing');
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
        <SidebarHeader className="border-b border-sidebar-border px-4 py-3 bg-transparent">
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
                <span className="text-body font-semibold text-foreground truncate leading-tight">
                  {buyerProfile?.company_name || 'Buyer Portal'}
                </span>
                <span className="text-small text-muted-foreground truncate leading-tight mt-0.5">
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
                className="w-full h-12 rounded-[14px] cta-texture text-primary-foreground font-semibold text-body shadow-sm flex items-center justify-center gap-2.5 transition-colors"
              >
                <span className="h-7 w-7 rounded-full bg-card/15 flex items-center justify-center shrink-0">
                  <Plus className="h-4 w-4" />
                </span>
                {!collapsed && <span>New Request</span>}
                {currentBranch && !collapsed && (
                  <Badge className="ml-1 text-micro bg-card/20 text-white border-white/30 font-medium">
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
                                        ? `bg-primary/5 text-primary font-medium${item.value === 'settings' ? ' settings-sub-active' : ''}`
                                        : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent'
                                    }`}
                                  >
                                    {subItem.icon && (
                                      item.value === 'settings' ? (
                                        <AnimatedSubIcon
                                          value={subItem.value}
                                          icon={subItem.icon}
                                          className="h-4 w-4 transition-transform duration-200 group-hover:scale-110"
                                        />
                                      ) : (
                                        <subItem.icon className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                                      )
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
              </>
            );
          })()}
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
                className="mt-2 h-11 w-11 rounded-xl cta-texture text-primary-foreground flex items-center justify-center shadow-sm transition-colors"
                aria-label="New Request"
              >
                <Plus className="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">New Request</TooltipContent>
          </Tooltip>

          {/* Nav items - icon only. Hover previews the section's tier-2 panel;
              click navigates and pins the panel open for sections with children. */}
          <div className="mt-2 flex flex-col items-center gap-1 w-full px-2">
            {navigationItems.map((item) => {
              const active = isActiveRoute(item.value) || (item.submenu?.some(s => isActiveRoute(s.value)) ?? false);
              const previewing = previewValue === item.value;
              return (
                <Tooltip key={item.value}>
                  <TooltipTrigger asChild>
                    <button
                      onMouseEnter={() => (item.submenu ? previewEnter(item.value) : previewLeave())}
                      onMouseLeave={previewLeave}
                      onClick={() => {
                        setPreviewValue(null);
                        if (item.submenu) setMode('pinned');
                        handleMenuClick(item.value);
                      }}
                      className={`relative h-11 w-11 rounded-xl flex items-center justify-center transition-colors duration-150 ${
                        active ? 'bg-primary/10 text-primary' : previewing ? 'bg-sidebar-accent text-foreground' : 'text-foreground/80 hover:bg-sidebar-accent hover:text-foreground'
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
                  {!item.submenu && <TooltipContent side="right">{item.title}</TooltipContent>}
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
                className="h-10 w-10 rounded-xl bg-card border border-sidebar-border text-primary flex items-center justify-center hover:bg-sidebar-accent transition-colors"
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
              <span className="text-micro text-muted-foreground/70 font-medium select-none" aria-label={`TraceR2C v${APP_VERSION}`}>
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
          <Sidebar className="border-r border-sidebar-border bg-sidebar">
            {fullBody}
          </Sidebar>
        );
      }

      // Desktop: dual-tier — 72px icon rail + 232px tier-2 panel for the active
      // section. Hovering another section previews its panel as an overlay; the
      // in-flow panel width animates so the main body reflows smoothly with it.
      const TIER2_W = 232;
      const overlayTopOffset = isImpersonating ? 48 : 0;

      const activeSection =
        navigationItems.find((i) => isActiveRoute(i.value) || (i.submenu?.some((s) => isActiveRoute(s.value)) ?? false)) ?? null;
      const pinnedSection = mode === 'pinned' && activeSection?.submenu ? activeSection : null;
      const previewCandidate = previewValue ? navigationItems.find((i) => i.value === previewValue) ?? null : null;
      const previewSection =
        previewCandidate?.submenu && previewCandidate.value !== pinnedSection?.value ? previewCandidate : null;
      if (previewSection) lastPreviewRef.current = previewSection;
      const shownPreview = previewSection ?? lastPreviewRef.current;

      const renderTier2 = (section: NavigationItem, overlay: boolean) => {
        const SectionIcon = section.icon;
        const items = section.submenu ?? [];
        const activeIdx = items.findIndex((s) => isActiveRoute(s.value));
        return (
          <div className="flex h-full w-[232px] flex-col bg-sidebar">
            {/* Section identity — icon coin + title + progress-ish context */}
            <div className="px-3 pt-4 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
                  <SectionIcon className={navIconClass} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-body font-semibold leading-tight text-foreground">{section.title}</p>
                  <p className="text-micro leading-tight text-muted-foreground">
                    {activeIdx >= 0 ? `${activeIdx + 1} of ${items.length}` : `${items.length} pages`}
                  </p>
                </div>
              </div>
            </div>

            <div className="mx-3 h-px bg-gradient-to-r from-sidebar-border via-sidebar-border to-transparent" />

            <nav className="flex-1 overflow-y-auto px-2 py-2.5 space-y-0.5">
              {items.map((sub) => {
                const subActive = isActiveRoute(sub.value);
                return (
                  <button
                    key={sub.value}
                    onClick={() => { setPreviewValue(null); if (overlay) setMode('pinned'); handleMenuClick(sub.value); }}
                    className={`group relative w-full flex items-center gap-2.5 h-9 pl-3 pr-2 rounded-lg text-small transition-all duration-150 ${
                      subActive
                        ? `bg-primary/10 text-primary font-semibold${section.value === 'settings' ? ' settings-sub-active' : ''}`
                        : 'text-foreground/75 hover:bg-sidebar-accent hover:text-foreground hover:translate-x-0.5'
                    }`}
                  >
                    {subActive && <span className="absolute -left-2 top-1.5 bottom-1.5 w-[3px] rounded-full bg-primary" />}
                    {sub.icon && (
                      section.value === 'settings' ? (
                        <AnimatedSubIcon
                          value={sub.value}
                          icon={sub.icon}
                          className={`${navSubIconClass} shrink-0 transition-transform duration-150 group-hover:scale-110 ${subActive ? '' : 'text-muted-foreground group-hover:text-foreground'}`}
                        />
                      ) : (
                        <sub.icon className={`${navSubIconClass} shrink-0 transition-transform duration-150 group-hover:scale-110 ${subActive ? '' : 'text-muted-foreground group-hover:text-foreground'}`} />
                      )
                    )}
                    <span className="truncate text-left">{sub.title}</span>
                    {sub.badge ? <Badge variant="secondary" className="ml-auto">{sub.badge}</Badge> : null}
                  </button>
                );
              })}
            </nav>

            {/* Footer accent — keeps the panel from feeling empty */}
            <div className="px-3 pb-3">
              <div className="rounded-xl border border-sidebar-border bg-card/60 px-3 py-2.5">
                <p className="truncate text-micro font-semibold text-foreground/80">
                  {buyerProfile?.company_name || 'Workspace'}
                </p>
                <p className="mt-0.5 truncate text-micro leading-snug text-muted-foreground">
                  {buyerProfile?.industry || 'Compliance workspace'}
                </p>
              </div>
            </div>
          </div>
        );
      };

      return (
        <div className="hidden md:flex shrink-0 sticky top-0 h-screen z-50">
          {/* Tier 1 — icon rail */}
          <aside className="w-[72px] shrink-0 flex flex-col border-r border-sidebar-border bg-sidebar overflow-hidden">
            {railBody}
          </aside>

          {/* Tier 2 — in flow for the active section; the body reflows as it animates */}
          <aside
            style={{ width: pinnedSection ? TIER2_W : 0, transition: `width 240ms ${EASE}` }}
            className="shrink-0 overflow-hidden border-r border-sidebar-border bg-sidebar motion-reduce:transition-none"
            aria-hidden={!pinnedSection}
          >
            {pinnedSection && renderTier2(pinnedSection, false)}
          </aside>

          {/* Tier 2 — hover preview overlay for other sections */}
          <div
            style={{
              top: overlayTopOffset,
              left: 72,
              width: TIER2_W,
              transform: previewSection ? 'translateX(0)' : 'translateX(-10px)',
              opacity: previewSection ? 1 : 0,
              pointerEvents: previewSection ? 'auto' : 'none',
              transition: `transform 190ms ${EASE}, opacity 170ms ${EASE}`,
            }}
            className="fixed bottom-0 z-50 border-r border-sidebar-border bg-sidebar shadow-2xl motion-reduce:transition-none"
            onMouseEnter={previewCancelClose}
            onMouseLeave={previewLeave}
          >
            {shownPreview && renderTier2(shownPreview, true)}
          </div>
        </div>
      );
      })()}


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
                      className="h-9 w-9 hover:bg-primary/10 hover:text-primary transition-colors"
                    >
                      <ArrowLeftRight className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Switch to Supplier</TooltipContent>
                </Tooltip>
              )}
              
              <ThemeToggle />

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
            <div className="w-full px-6 py-5">
              {children}
            </div>
          )}
        </main>
      </div>

    </div>
  );
}

export default BuyerSidebarLayout;
