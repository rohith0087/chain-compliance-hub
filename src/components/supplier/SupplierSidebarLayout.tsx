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
  MessageSquare,
  UserCheck,
  Send,
  UserPlus,
  Upload,
  Shield,
  Clock,
  CheckCircle
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
  const { profile } = useAuth();
  const sidebar = useSidebar();
  const collapsed = sidebar?.state === 'collapsed';

  // Company branches management
  const {
    branches,
    currentBranch,
    switchBranch,
    loading: branchesLoading
  } = useCompanyBranches(supplierProfile?.id, 'supplier');

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
      value: 'company'
    }
  ];

  const isActiveRoute = (value: string) => activeTab === value;

  const handleMenuClick = (value: string) => {
    onTabChange(value);
  };

  const handleSpecialAction = (action: string) => {
    switch (action) {
      case 'connect-buyer':
        onConnectWithBuyer?.();
        break;
      case 'upload-document':
        onUploadDocument?.();
        break;
      case 'chat':
        navigate('/chat');
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
                  <SidebarMenuButton onClick={() => handleSpecialAction('chat')}>
                    <MessageSquare className="h-4 w-4" />
                    <span>Compliance Assistant</span>
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
                        Supplier
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
                {profile?.roles?.includes('buyer') && (
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