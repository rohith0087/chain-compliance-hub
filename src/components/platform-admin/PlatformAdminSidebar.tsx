import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  UserPlus, 
  BarChart3, 
  Settings, 
  Shield, 
  LogOut,
  FileText,
  Ticket
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

interface PlatformAdminSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const navigationItems = [
  {
    title: 'Dashboard',
    url: '/platform-admin/dashboard',
    icon: LayoutDashboard,
    section: 'dashboard'
  },
  {
    title: 'User Management',
    url: '/platform-admin/dashboard?tab=users',
    icon: Users,
    section: 'users'
  },
  {
    title: 'Invitations',
    url: '/platform-admin/dashboard?tab=invitations',
    icon: UserPlus,
    section: 'invitations'
  },
  {
    title: 'Support Tickets',
    url: '/platform-admin/dashboard?tab=tickets',
    icon: Ticket,
    section: 'tickets'
  },
  {
    title: 'Analytics',
    url: '/platform-admin/dashboard?tab=analytics',
    icon: BarChart3,
    section: 'analytics'
  },
  {
    title: 'System Settings',
    url: '/platform-admin/dashboard?tab=settings',
    icon: Settings,
    section: 'settings'
  },
  {
    title: 'Audit Logs',
    url: '/platform-admin/dashboard?tab=logs',
    icon: FileText,
    section: 'logs'
  }
];

export function PlatformAdminSidebar({ activeSection, onSectionChange }: PlatformAdminSidebarProps) {
  const { state } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { platformAdmin } = usePlatformAdmin();
  const { stats } = useSupportTickets();
  
  const collapsed = state === 'collapsed';
  const openTicketCount = (stats.open || 0) + (stats.urgent || 0);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/platform-admin/login');
  };

  const isActive = (section: string) => {
    const urlParams = new URLSearchParams(location.search);
    const currentTab = urlParams.get('tab') || 'dashboard';
    return currentTab === section || (section === 'dashboard' && !urlParams.get('tab'));
  };

  return (
    <Sidebar
      className={`border-r transition-all duration-300 ${
        collapsed ? 'w-[60px]' : 'w-[240px]'
      }`}
      style={{
        backgroundColor: 'hsl(var(--admin-sidebar))',
        borderColor: 'hsl(var(--admin-border))',
        color: 'hsl(var(--admin-text))'
      }}
      collapsible="icon"
    >
      <SidebarHeader className="border-b p-6" style={{ 
        borderColor: 'hsl(var(--admin-border))',
        backgroundColor: 'hsl(var(--admin-sidebar))'
      }}>
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div 
              className="absolute inset-0 rounded-lg blur-md opacity-50"
              style={{ backgroundColor: 'hsl(var(--admin-accent-blue))' }}
            ></div>
            <Shield 
              className="relative h-10 w-10" 
              style={{ color: 'hsl(var(--admin-accent-blue))' }}
            />
          </div>
          {!collapsed && (
            <div>
              <h2 className="text-lg font-bold" style={{ color: 'hsl(var(--admin-text))' }}>
                Platform Admin
              </h2>
              <p className="text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>
                Control Center
              </p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-4 py-6" style={{ backgroundColor: 'hsl(var(--admin-sidebar))' }}>
        <SidebarGroup>
          <SidebarGroupLabel 
            className={`text-xs font-semibold uppercase tracking-wider mb-4 ${
              collapsed ? 'text-center' : ''
            }`}
            style={{ color: 'hsl(var(--admin-text-muted))' }}
          >
            {collapsed ? '•••' : 'Navigation'}
          </SidebarGroupLabel>
          
          <SidebarGroupContent>
            <SidebarMenu className="space-y-2">
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.section}>
                  <SidebarMenuButton 
                    asChild
                    className={`group relative rounded-lg transition-all duration-200 ${
                      isActive(item.section)
                        ? 'shadow-lg'
                        : 'hover:shadow-md'
                    }`}
                    style={{
                      backgroundColor: isActive(item.section) 
                        ? 'hsl(var(--admin-sidebar-accent))' 
                        : 'transparent'
                    }}
                  >
                    <NavLink
                      to={item.url}
                      onClick={() => onSectionChange(item.section)}
                      className={`flex items-center w-full p-3 rounded-lg transition-colors hover:bg-[hsl(var(--admin-sidebar-accent))] ${
                        collapsed ? 'justify-center' : 'justify-start'
                      }`}
                    >
                      <div className="relative">
                        <item.icon 
                          className={`h-5 w-5 ${collapsed ? '' : 'mr-3'} transition-colors`}
                          style={{
                            color: isActive(item.section) 
                              ? 'hsl(var(--admin-accent-blue))' 
                              : 'hsl(var(--admin-text-muted))'
                          }}
                        />
                        {/* Badge for tickets in collapsed mode */}
                        {item.section === 'tickets' && collapsed && openTicketCount > 0 && (
                          <Badge 
                            className="absolute -top-2 -right-2 h-4 min-w-4 p-0 text-[10px] flex items-center justify-center"
                            style={{
                              backgroundColor: 'hsl(var(--admin-accent-blue))',
                              color: 'white'
                            }}
                          >
                            {openTicketCount > 9 ? '9+' : openTicketCount}
                          </Badge>
                        )}
                      </div>
                      {!collapsed && (
                        <div className="flex items-center justify-between flex-1">
                          <span 
                            className="font-medium"
                            style={{
                              color: isActive(item.section) 
                                ? 'hsl(var(--admin-text))' 
                                : 'hsl(var(--admin-text-muted))'
                            }}
                          >
                            {item.title}
                          </span>
                          {/* Badge for tickets in expanded mode */}
                          {item.section === 'tickets' && openTicketCount > 0 && (
                            <Badge 
                              className="h-5 min-w-5 p-0 text-xs flex items-center justify-center"
                              style={{
                                backgroundColor: 'hsl(var(--admin-accent-blue))',
                                color: 'white'
                              }}
                            >
                              {openTicketCount > 99 ? '99+' : openTicketCount}
                            </Badge>
                          )}
                        </div>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t p-4" style={{ 
        borderColor: 'hsl(var(--admin-border))',
        backgroundColor: 'hsl(var(--admin-sidebar))'
      }}>
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
          <div className={`flex items-center ${collapsed ? '' : 'space-x-3'}`}>
            <Avatar className="h-8 w-8">
              <AvatarFallback 
                className="text-sm font-semibold"
                style={{ 
                  backgroundColor: 'hsl(var(--admin-accent-blue))',
                  color: 'white'
                }}
              >
                {platformAdmin?.full_name?.charAt(0) || 'A'}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'hsl(var(--admin-text))' }}>
                  {platformAdmin?.full_name || 'Admin'}
                </p>
                <p className="text-xs truncate" style={{ color: 'hsl(var(--admin-text-muted))' }}>
                  {platformAdmin?.email}
                </p>
              </div>
            )}
          </div>
          
          {!collapsed && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="h-8 w-8 p-0 hover:bg-red-500/10"
              style={{ color: 'hsl(var(--admin-text-muted))' }}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        {collapsed && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="h-8 w-8 p-0 mt-2 hover:bg-red-500/10"
            style={{ color: 'hsl(var(--admin-text-muted))' }}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
