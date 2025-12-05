
import { useState } from 'react';
import { Bell, CheckCheck, FileText, Users, Upload, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useNotifications } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';

interface NotificationCenterProps {
  onNavigate?: (tab: string, notificationId?: string) => void;
}

const NotificationCenter = ({ onNavigate }: NotificationCenterProps) => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, loading } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'document_approved':
      case 'document_submitted':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'document_declined':
      case 'document_rejected':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'connection_request':
      case 'connection_response':
        return <Users className="w-5 h-5 text-blue-500" />;
      case 'new_document_request':
        return <FileText className="w-5 h-5 text-purple-500" />;
      case 'document_uploaded':
        return <Upload className="w-5 h-5 text-orange-500" />;
      case 'document_expiry_expires_soon':
        return <Clock className="w-5 h-5 text-blue-500" />;
      case 'document_expiry_urgent':
        return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'document_expiry_overdue':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      default:
        return <Bell className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getExpiryUrgencyBadge = (type: string) => {
    if (type === 'document_expiry_expires_soon') {
      return <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Expires Soon</Badge>;
    }
    if (type === 'document_expiry_urgent') {
      return <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">Urgent</Badge>;
    }
    if (type === 'document_expiry_overdue') {
      return <Badge variant="destructive" className="text-xs">Overdue</Badge>;
    }
    return null;
  };

  const getNotificationTargetTab = (type: string) => {
    switch (type) {
      case 'document_approved':
      case 'document_declined':
      case 'document_rejected':
      case 'document_submitted':
      case 'new_document_request':
      case 'document_expiry_expires_soon':
      case 'document_expiry_urgent':
      case 'document_expiry_overdue':
        return 'requests';
      case 'connection_request':
      case 'connection_response':
        return 'connections';
      case 'onboarding_request':
        return 'onboarding';
      default:
        return 'overview';
    }
  };

  const handleNotificationClick = (notification: any) => {
    markAsRead(notification.id);
    
    const targetTab = getNotificationTargetTab(notification.type);
    onNavigate?.(targetTab, notification.id);
    
    setIsOpen(false);
  };

  if (loading) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Bell className="w-4 h-4" />
      </Button>
    );
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="relative group hover:shadow-md transition-all duration-200">
          <Bell className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs shadow-lg animate-pulse"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0 border shadow-xl" align="end">
        {/* Header */}
        <div className="p-4 border-b bg-gradient-to-r from-background to-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-foreground">Notifications</h3>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                  {unreadCount} new
                </Badge>
              )}
            </div>
            {unreadCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={markAllAsRead}
                className="h-auto p-2 hover:bg-primary/10 text-primary"
              >
                <CheckCheck className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        <div className="max-h-[32rem] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-muted-foreground">No notifications yet</p>
              <p className="text-sm text-muted-foreground/70 mt-1">We'll notify you when something happens</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 border-b transition-all duration-200 cursor-pointer group ${
                  !notification.read 
                    ? 'bg-gradient-to-r from-primary/5 to-transparent hover:from-primary/10 hover:to-primary/5' 
                    : 'hover:bg-muted/30'
                }`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className="flex-shrink-0 mt-0.5">
                    {getNotificationIcon(notification.type)}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                          {notification.title}
                        </h4>
                        {getExpiryUrgencyBadge(notification.type)}
                      </div>
                      {!notification.read && (
                        <div className="w-2 h-2 bg-primary rounded-full ml-2 mt-1.5 animate-pulse flex-shrink-0" />
                      )}
                    </div>
                    
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                      {notification.message}
                    </p>
                    
                    <div className="flex items-center justify-between mt-3">
                      <p className="text-xs text-muted-foreground/70">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </p>
                      
                      {!notification.read && (
                        <Badge variant="outline" className="text-xs px-2 py-0.5 bg-primary/10 text-primary border-primary/20">
                          New
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="p-3 border-t bg-muted/20">
            <p className="text-xs text-center text-muted-foreground">
              Click on notifications to navigate to relevant sections
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default NotificationCenter;
