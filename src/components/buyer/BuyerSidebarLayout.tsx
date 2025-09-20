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
  Upload
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { useCompanyBranches } from '@/hooks/useCompanyBranches';

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
  buyerProfile
}: BuyerSidebarLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation(['dashboard', 'common']);
  const { profile } = useAuth();
  const sidebar = useSidebar();
  const collapsed = sidebar?.state === 'collapsed';

  // Company branches management
  const {
    branches,
    currentBranch,
    switchBranch,
    loading: branchesLoading
  } = useCompanyBranches(buyerProfile?.id, 'buyer');

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
        { title: 'Connection Requests', value: 'supplier-requests', icon: UserCheck },
        { title: 'Quick Onboarding', value: 'quick-onboarding', icon: UserPlus },
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
        { title: 'Templates', value: 'templates', icon: FileText }
      ]
    },
    {
      title: t('common:navigation.compliance'),
      icon: BarChart3,
      value: 'compliance'
    },
    {
      title: t('dashboard:company.title'),
      icon: Building2,
      value: 'company'
    }
  ];

  const isActiveRoute = (value: string) => activeTab === value;
  
  const hasActiveSubmenu = (item: NavigationItem) => {
    if (!item.submenu) return false;
    return item.submenu.some(sub => isActiveRoute(sub.value));
  };

  const handleMenuClick = (value: string) => {
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
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    onClick={() => handleSpecialAction('new-request')}
                    className="text-primary hover:text-primary hover:bg-primary/10"
                  >
                    <Plus className="h-4 w-4" />
                    <span>New Request</span>
                    {currentBranch && !collapsed && (
                      <Badge variant="secondary" className="ml-auto text-xs">
                        {currentBranch.branch_name}
                      </Badge>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => handleSpecialAction('chat')}>
                    <Compass className="h-4 w-4" />
                    <span>Compliance Compass</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => handleSpecialAction('bulk-invite')}>
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
                  <SidebarMenuItem key={item.value}>
                    <SidebarMenuButton
                      isActive={isActiveRoute(item.value) || hasActiveSubmenu(item)}
                      onClick={() => handleMenuClick(item.value)}
                      className="group"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                      {item.submenu && (
                        <ChevronDown 
                          className={`ml-auto h-4 w-4 transition-transform ${
                            hasActiveSubmenu(item) ? 'rotate-180' : ''
                          }`} 
                        />
                      )}
                      {item.badge && (
                        <Badge variant="secondary" className="ml-auto">
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

        <SidebarFooter className="border-t p-3">
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
                        Buyer
                      </span>
                    </div>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={onShowSettings}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                {profile?.roles?.includes('supplier') && (
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
        <header className="h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
          <div className="flex h-full items-center justify-between px-4">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="-ml-1" />
              {branches.length > 1 && (
                <BranchSelector
                  branches={branches}
                  currentBranch={currentBranch}
                  onBranchChange={switchBranch}
                  loading={branchesLoading}
                />
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <NotificationCenter />
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
    </div>
  );
}