import { Search, Bell, Menu } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';

export function PlatformAdminHeader() {
  return (
    <header 
      className="border-b px-6 py-4"
      style={{
        backgroundColor: 'hsl(var(--admin-surface))',
        borderColor: 'hsl(var(--admin-border))'
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <SidebarTrigger />
          
          <div className="hidden md:flex items-center space-x-2 text-sm">
            <span style={{ color: 'hsl(var(--admin-text-muted))' }}>Platform</span>
            <span style={{ color: 'hsl(var(--admin-text-muted))' }}>/</span>
            <span style={{ color: 'hsl(var(--admin-text))' }}>Administration</span>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {/* Search */}
          <div className="relative hidden md:block">
            <Search 
              className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4" 
              style={{ color: 'hsl(var(--admin-text-muted))' }}
            />
            <Input
              placeholder="Search users, documents..."
              className="pl-10 w-80 border-0 focus-visible:ring-1 focus-visible:ring-blue-500"
              style={{
                backgroundColor: 'hsl(var(--admin-card))',
                color: 'hsl(var(--admin-text))'
              }}
            />
          </div>

          {/* Notifications */}
          <Button
            variant="ghost"
            size="sm"
            className="relative h-9 w-9 p-0"
          >
            <Bell className="h-4 w-4" style={{ color: 'hsl(var(--admin-text-muted))' }} />
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs flex items-center justify-center"
              style={{
                backgroundColor: 'hsl(var(--admin-accent-blue))',
                color: 'white'
              }}
            >
              3
            </Badge>
          </Button>

          {/* Mobile menu */}
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden h-9 w-9 p-0"
          >
            <Menu className="h-4 w-4" style={{ color: 'hsl(var(--admin-text-muted))' }} />
          </Button>
        </div>
      </div>
    </header>
  );
}