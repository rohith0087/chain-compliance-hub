import { useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  BarChart3,
  LogOut,
  FileText,
  Ticket,
  X,
  Sparkles,
  MailWarning,
  ShieldAlert,
  Flag,
  Database,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { useSupportTickets } from '@/hooks/useSupportTickets';
import { useIsMobile } from '@/hooks/use-mobile';
import { AdminBrand } from './AdminBrand';

interface PlatformAdminSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

interface NavItem {
  title: string;
  section: string;
  url: string;
  icon: typeof LayoutDashboard;
}

// Grouped navigation. Sections map to ?tab= values read by PlatformAdminDashboardContent.
const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: 'Overview',
    items: [
      { title: 'Dashboard', section: 'dashboard', url: '/platform-admin/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'People',
    items: [
      { title: 'User Management', section: 'users', url: '/platform-admin/dashboard?tab=users', icon: Users },
      { title: 'Invitations', section: 'invitations', url: '/platform-admin/dashboard?tab=invitations', icon: UserPlus },
      { title: 'Support Tickets', section: 'tickets', url: '/platform-admin/dashboard?tab=tickets', icon: Ticket },
    ],
  },
  {
    label: 'Risk & Operations',
    items: [
      { title: 'Supplier Risk', section: 'supplier-risk', url: '/platform-admin/dashboard?tab=supplier-risk', icon: ShieldAlert },
      { title: 'Analytics', section: 'analytics', url: '/platform-admin/dashboard?tab=analytics', icon: BarChart3 },
      { title: 'Email Intake', section: 'email-intake', url: '/platform-admin/dashboard?tab=email-intake', icon: MailWarning },
      { title: 'AI Backfill', section: 'backfill', url: '/platform-admin/dashboard?tab=backfill', icon: Sparkles },
    ],
  },
  {
    label: 'Platform',
    items: [
      { title: 'Feature Flags', section: 'feature-flags', url: '/platform-admin/dashboard?tab=feature-flags', icon: Flag },
      { title: 'Data Explorer', section: 'data-explorer', url: '/platform-admin/dashboard?tab=data-explorer', icon: Database },
      { title: 'Audit Logs', section: 'logs', url: '/platform-admin/dashboard?tab=logs', icon: FileText },
    ],
  },
];

export function PlatformAdminSidebar({ onSectionChange }: PlatformAdminSidebarProps) {
  const { state, setOpenMobile, openMobile } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { platformAdmin } = usePlatformAdmin();
  const { stats } = useSupportTickets();
  const isMobile = useIsMobile();

  const collapsed = state === 'collapsed';
  const showLabels = !collapsed || isMobile;
  const openTicketCount = (stats.open || 0) + (stats.urgent || 0);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/platform-admin/login');
  };

  const isActive = (section: string) => {
    const currentTab = new URLSearchParams(location.search).get('tab') || 'dashboard';
    return currentTab === section || (section === 'dashboard' && !new URLSearchParams(location.search).get('tab'));
  };

  const handleNavClick = (url: string, section: string) => {
    onSectionChange(section);
    navigate(url);
    if (isMobile) setOpenMobile(false);
  };

  const sidebarContent = (
    <>
      <SidebarHeader
        className="border-b p-4"
        style={{ borderColor: 'hsl(var(--admin-border))', backgroundColor: 'hsl(var(--admin-sidebar))' }}
      >
        <div className="flex items-center justify-between">
          {showLabels ? <AdminBrand size="sm" /> : (
            <img src="/logo.png" alt="TraceR2C" className="h-8 w-8 rounded-lg object-contain"
              style={{ background: 'hsl(var(--admin-accent-weak))', padding: 2 }} />
          )}
          {isMobile && (
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0"
              onClick={() => setOpenMobile(false)} style={{ color: 'hsl(var(--admin-text-muted))' }}>
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2.5 py-3" style={{ backgroundColor: 'hsl(var(--admin-sidebar))' }}>
        {navGroups.map((group) => (
          <SidebarGroup key={group.label} className="mb-1">
            {showLabels && (
              <SidebarGroupLabel
                className="px-2 text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: 'hsl(var(--admin-text-muted))' }}
              >
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(item.section);
                  return (
                    <SidebarMenuItem key={item.section}>
                      <SidebarMenuButton
                        className="group relative h-auto rounded-lg p-0 transition-colors"
                        style={{ backgroundColor: active ? 'hsl(var(--admin-accent-weak))' : 'transparent' }}
                        onClick={() => handleNavClick(item.url, item.section)}
                      >
                        <div
                          className={`flex w-full items-center rounded-lg px-2.5 py-2 ${collapsed && !isMobile ? 'justify-center' : ''}`}
                        >
                          {active && (
                            <span
                              className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full"
                              style={{ background: 'hsl(var(--admin-accent-blue))' }}
                            />
                          )}
                          <div className="relative">
                            <item.icon
                              className={`h-[18px] w-[18px] ${showLabels ? 'mr-2.5' : ''}`}
                              style={{ color: active ? 'hsl(var(--admin-accent-blue))' : 'hsl(var(--admin-text-muted))' }}
                            />
                            {item.section === 'tickets' && collapsed && !isMobile && openTicketCount > 0 && (
                              <Badge className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center p-0 text-[10px]"
                                style={{ backgroundColor: 'hsl(var(--admin-accent-blue))', color: 'white' }}>
                                {openTicketCount > 9 ? '9+' : openTicketCount}
                              </Badge>
                            )}
                          </div>
                          {showLabels && (
                            <div className="flex flex-1 items-center justify-between">
                              <span className="text-sm font-medium"
                                style={{ color: active ? 'hsl(var(--admin-text))' : 'hsl(var(--admin-text-muted))' }}>
                                {item.title}
                              </span>
                              {item.section === 'tickets' && openTicketCount > 0 && (
                                <Badge className="flex h-5 min-w-5 items-center justify-center p-0 text-xs"
                                  style={{ backgroundColor: 'hsl(var(--admin-accent-blue))', color: 'white' }}>
                                  {openTicketCount > 99 ? '99+' : openTicketCount}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t p-3"
        style={{ borderColor: 'hsl(var(--admin-border))', backgroundColor: 'hsl(var(--admin-sidebar))' }}>
        <div className={`flex items-center ${collapsed && !isMobile ? 'justify-center' : 'justify-between'}`}>
          <div className={`flex items-center ${collapsed && !isMobile ? '' : 'space-x-2.5'}`}>
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-sm font-semibold"
                style={{ backgroundColor: 'hsl(var(--admin-accent-blue))', color: 'white' }}>
                {platformAdmin?.full_name?.charAt(0) || 'A'}
              </AvatarFallback>
            </Avatar>
            {showLabels && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" style={{ color: 'hsl(var(--admin-text))' }}>
                  {platformAdmin?.full_name || 'Admin'}
                </p>
                <p className="truncate text-xs" style={{ color: 'hsl(var(--admin-text-muted))' }}>
                  {platformAdmin?.email}
                </p>
              </div>
            )}
          </div>
          {showLabels && (
            <Button variant="ghost" size="sm" onClick={handleSignOut}
              className="h-8 w-8 p-0" style={{ color: 'hsl(var(--admin-text-muted))' }}>
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
        {collapsed && !isMobile && (
          <Button variant="ghost" size="sm" onClick={handleSignOut}
            className="mt-2 h-8 w-8 p-0" style={{ color: 'hsl(var(--admin-text-muted))' }}>
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </SidebarFooter>
    </>
  );

  if (isMobile) {
    return (
      <>
        {openMobile && (
          <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setOpenMobile(false)} />
        )}
        <div
          className={`fixed inset-y-0 left-0 z-50 w-[280px] transform transition-transform duration-300 ease-in-out md:hidden ${
            openMobile ? 'translate-x-0' : '-translate-x-full'
          }`}
          style={{ backgroundColor: 'hsl(var(--admin-sidebar))', borderRight: '1px solid hsl(var(--admin-border))' }}
        >
          {sidebarContent}
        </div>
      </>
    );
  }

  return (
    <Sidebar
      className={`hidden border-r transition-all duration-300 md:flex ${collapsed ? 'w-[60px]' : 'w-[248px]'}`}
      style={{
        backgroundColor: 'hsl(var(--admin-sidebar))',
        borderColor: 'hsl(var(--admin-border))',
        color: 'hsl(var(--admin-text))',
      }}
      collapsible="icon"
    >
      {sidebarContent}
    </Sidebar>
  );
}
