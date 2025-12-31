import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Bell, 
  Building2, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Clock,
  Check
} from 'lucide-react';
import { useSimulation } from '@/contexts/SimulationContext';
import { formatDistanceToNow } from 'date-fns';

export const SimulationNotificationCenter = () => {
  const { 
    notifications, 
    showNotificationCenter, 
    setShowNotificationCenter,
    markNotificationRead,
    markAllNotificationsRead,
    getUnreadNotificationCount,
  } = useSimulation();

  const unreadCount = getUnreadNotificationCount();

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'connection_request':
      case 'connection_approved':
        return <Building2 className="h-4 w-4 text-blue-500" />;
      case 'new_document_request':
        return <FileText className="h-4 w-4 text-amber-500" />;
      case 'document_approved':
      case 'onboarding_approved':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'document_expiring':
        return <Clock className="h-4 w-4 text-amber-500" />;
      case 'document_expired':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Bell className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <Popover open={showNotificationCenter} onOpenChange={setShowNotificationCenter}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center font-medium">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <h4 className="font-semibold">Notifications</h4>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs h-7"
              onClick={markAllNotificationsRead}
            >
              <Check className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        
        <ScrollArea className="max-h-80">
          {notifications.length > 0 ? (
            <div className="divide-y">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => markNotificationRead(notification.id)}
                  className={`w-full text-left p-3 hover:bg-muted/50 transition-colors ${
                    !notification.read ? 'bg-blue-50/50' : ''
                  }`}
                >
                  <div className="flex gap-3">
                    <div className="mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm ${!notification.read ? 'font-medium' : ''}`}>
                          {notification.title}
                        </p>
                        {!notification.read && (
                          <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <Bell className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No notifications</p>
            </div>
          )}
        </ScrollArea>
        
        <div className="p-2 border-t">
          <Badge variant="outline" className="w-full justify-center text-xs">
            Demo Notifications
          </Badge>
        </div>
      </PopoverContent>
    </Popover>
  );
};
