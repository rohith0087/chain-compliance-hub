import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { FileText, UserPlus, CheckCircle, XCircle, Clock, Bell, X } from "lucide-react";
import { formatDistanceToNow } from 'date-fns';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface Activity {
  id: string;
  type: string;
  request_id: string;
  supplier_name: string;
  message: string;
  timestamp: string;
  icon: any;
  color: string;
}

interface OnboardingActivityFeedProps {
  buyerId: string;
  isOpen: boolean;
  onClose: () => void;
  onRequestClick?: (requestId: string) => void;
}

export const OnboardingActivityFeed = ({ buyerId, isOpen, onClose, onRequestClick }: OnboardingActivityFeedProps) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  
  useEffect(() => {
    loadRecentActivities();
    
    // Subscribe to real-time changes
    const channelName = `activity-feed-${buyerId}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'supplier_onboarding_requests',
        filter: `buyer_id=eq.${buyerId}`
      }, (payload) => {
        const activity = createActivityFromPayload(payload);
        if (activity) {
          setActivities(prev => [activity, ...prev].slice(0, 50));
        }
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [buyerId]);
  
  const loadRecentActivities = async () => {
    const { data, error } = await supabase
      .from('supplier_onboarding_requests')
      .select('*')
      .eq('buyer_id', buyerId)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (data && !error) {
      const initialActivities = data.map(request => ({
        id: request.id,
        type: 'request_created',
        request_id: request.id,
        supplier_name: request.supplier_company_name || request.supplier_email,
        message: `Onboarding request created for ${request.supplier_company_name || request.supplier_email}`,
        timestamp: request.created_at,
        icon: UserPlus,
        color: 'text-primary'
      }));
      setActivities(initialActivities);
    }
  };
  
  const createActivityFromPayload = (payload: any): Activity | null => {
    const { new: newRecord, old: oldRecord, eventType } = payload;
    
    if (eventType === 'INSERT') {
      return {
        id: newRecord.id,
        type: 'request_created',
        request_id: newRecord.id,
        supplier_name: newRecord.supplier_company_name || newRecord.supplier_email,
        message: `New onboarding request created`,
        timestamp: newRecord.created_at,
        icon: UserPlus,
        color: 'text-primary'
      };
    }
    
    if (eventType === 'UPDATE' && oldRecord.status !== newRecord.status) {
      const statusMessages: Record<string, { message: string; icon: any; color: string }> = {
        'onboarding_initiated': { message: 'Supplier started onboarding', icon: Clock, color: 'text-warning' },
        'under_review': { message: 'Ready for review', icon: Bell, color: 'text-warning' },
        'approved': { message: 'Onboarding approved', icon: CheckCircle, color: 'text-success' },
        'declined': { message: 'Onboarding declined', icon: XCircle, color: 'text-danger' },
      };
      
      const statusInfo = statusMessages[newRecord.status] || { message: 'Status updated', icon: FileText, color: 'text-muted-foreground' };
      
      return {
        id: `${newRecord.id}-${Date.now()}`,
        type: 'status_changed',
        request_id: newRecord.id,
        supplier_name: newRecord.supplier_company_name || newRecord.supplier_email,
        message: statusInfo.message,
        timestamp: new Date().toISOString(),
        icon: statusInfo.icon,
        color: statusInfo.color
      };
    }
    
    return null;
  };
  
  const getActivityIcon = (activity: Activity) => {
    const Icon = activity.icon;
    return <Icon className={`h-4 w-4 ${activity.color}`} />;
  };
  
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>Activity Feed</SheetTitle>
        </SheetHeader>
        
        <ScrollArea className="h-[calc(100vh-100px)] mt-6">
          <div className="space-y-4">
            {activities.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No recent activity</p>
            ) : (
              activities.map((activity) => (
                <Card 
                  key={activity.id} 
                  className="cursor-pointer hover:bg-accent transition-colors"
                  onClick={() => {
                    onRequestClick?.(activity.request_id);
                    onClose();
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        {getActivityIcon(activity)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{activity.supplier_name}</p>
                        <p className="text-sm text-muted-foreground">{activity.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {activity.type.replace('_', ' ')}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
