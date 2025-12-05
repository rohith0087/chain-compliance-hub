import { Search, Bell, Menu } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSupportTickets } from '@/hooks/useSupportTickets';
import { useNavigate } from 'react-router-dom';

export function PlatformAdminHeader() {
  const { stats, newTicketCount, clearNewTicketCount } = useSupportTickets();
  const navigate = useNavigate();
  
  // Show open + urgent tickets in badge
  const badgeCount = (stats.open || 0) + (stats.urgent || 0);

  const handleNotificationClick = () => {
    clearNewTicketCount();
    navigate('/platform-admin/dashboard?tab=tickets');
  };

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
            onClick={handleNotificationClick}
          >
            <Bell className="h-4 w-4" style={{ color: 'hsl(var(--admin-text-muted))' }} />
            {badgeCount > 0 && (
              <Badge 
                className={`absolute -top-1 -right-1 h-5 min-w-5 p-0 text-xs flex items-center justify-center ${
                  newTicketCount > 0 ? 'animate-pulse' : ''
                }`}
                style={{
                  backgroundColor: badgeCount > 0 ? 'hsl(var(--admin-accent-blue))' : 'hsl(var(--muted))',
                  color: 'white'
                }}
              >
                {badgeCount > 99 ? '99+' : badgeCount}
              </Badge>
            )}
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
