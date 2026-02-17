import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Activity, 
  Plus, 
  FlaskConical, 
  Bell, 
  FileDown,
  CheckCircle,
  FileText,
  Link2,
  Upload,
  Users,
  ShieldAlert
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useBranchContext } from '@/contexts/BranchContext';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ActivityQuickActionsPanelProps {
  buyerId: string;
  onNewRequest: () => void;
  onInviteSupplier: () => void;
  onNavigateToDocuments: (filter?: string) => void;
  onNavigateToTab: (tab: string) => void;
}

interface ActivityItem {
  id: string;
  action_type: string;
  description: string;
  created_at: string;
  metadata?: any;
}

const actionIcons: Record<string, any> = {
  approved: CheckCircle,
  uploaded: Upload,
  requested: FileText,
  link_created: Link2,
  submitted: FileText,
  rejected: FileText,
  downloaded: FileDown,
};

const actionColors: Record<string, string> = {
  approved: 'text-green-500 bg-green-500/10',
  uploaded: 'text-blue-500 bg-blue-500/10',
  requested: 'text-primary bg-primary/10',
  link_created: 'text-purple-500 bg-purple-500/10',
  submitted: 'text-teal-500 bg-teal-500/10',
  rejected: 'text-red-500 bg-red-500/10',
  downloaded: 'text-amber-500 bg-amber-500/10',
};

export function ActivityQuickActionsPanel({
  buyerId,
  onNewRequest,
  onInviteSupplier,
  onNavigateToDocuments,
  onNavigateToTab
}: ActivityQuickActionsPanelProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentBranch, allBranchesView } = useBranchContext();

  useEffect(() => {
    const fetchActivities = async () => {
      if (!buyerId) return;
      
      setLoading(true);
      try {
        const branchFilter = !allBranchesView && currentBranch?.id ? currentBranch.id : null;
        
        let requestsQuery = supabase
          .from('document_requests')
          .select('id')
          .eq('buyer_id', buyerId);
        
        if (branchFilter) requestsQuery = requestsQuery.eq('branch_id', branchFilter);
        const { data: requestIds } = await requestsQuery;
        
        if (!requestIds || requestIds.length === 0) {
          setActivities([]);
          setLoading(false);
          return;
        }

        const { data: activityData, error } = await supabase
          .from('document_activity_logs')
          .select('*')
          .or(`document_request_id.in.(${requestIds.map(r => r.id).join(',')}),document_upload_id.in.(select id from document_uploads where request_id in (${requestIds.map(r => r.id).join(',')}))`)
          .order('created_at', { ascending: false })
          .limit(15);

        if (error) {
          const { data: fallbackData } = await supabase
            .from('document_activity_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(15);
          
          setActivities((fallbackData || []).map(a => ({
            id: a.id,
            action_type: a.action_type,
            description: formatActionDescription(a.action_type, a.metadata),
            created_at: a.created_at,
            metadata: a.metadata
          })));
        } else {
          setActivities((activityData || []).map(a => ({
            id: a.id,
            action_type: a.action_type,
            description: formatActionDescription(a.action_type, a.metadata),
            created_at: a.created_at,
            metadata: a.metadata
          })));
        }
      } catch (error) {
        console.error('Error fetching activities:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, [buyerId, currentBranch?.id, allBranchesView]);

  const formatActionDescription = (actionType: string, metadata: any) => {
    const docName = metadata?.document_name || metadata?.title || 'Document';
    switch (actionType) {
      case 'approved': return `${docName} approved`;
      case 'rejected': return `${docName} declined`;
      case 'uploaded': return `${docName} uploaded`;
      case 'submitted': return `${docName} submitted`;
      case 'requested': return `${docName} requested`;
      case 'link_created': return `Link created for ${docName}`;
      case 'downloaded': return `${docName} downloaded`;
      default: return `${actionType} - ${docName}`;
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays === 1) return '1d';
    return `${diffDays}d`;
  };

  const quickActions = [
    { label: 'New Request', icon: Plus, onClick: onNewRequest, color: 'bg-primary hover:bg-primary/90 text-primary-foreground' },
    { label: 'COA Analysis', icon: FlaskConical, onClick: () => onNavigateToTab('coa-analysis'), color: 'bg-teal-500 hover:bg-teal-600 text-white' },
    { label: 'Supplier Risk', icon: ShieldAlert, onClick: () => onNavigateToTab('supplier-risk'), color: 'bg-secondary hover:bg-secondary/90 text-secondary-foreground' },
    { label: 'Suppliers', icon: Users, onClick: () => onNavigateToTab('suppliers'), color: 'bg-muted hover:bg-muted/80 text-foreground' },
  ];

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Quick Actions */}
      <Card className="flex-shrink-0 border-0 bg-gradient-to-br from-card via-card to-muted/30">
        <CardHeader className="pb-3 pt-4">
          <CardTitle className="text-sm font-semibold">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="pb-4 px-4">
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action) => (
              <Button
                key={action.label}
                size="sm"
                className={cn("h-10 text-xs font-medium justify-start px-3", action.color)}
                onClick={action.onClick}
              >
                <action.icon className="w-4 h-4 mr-2 flex-shrink-0" />
                <span className="truncate">{action.label}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Activity Feed */}
      <Card className="flex-1 min-h-0 flex flex-col border-0 bg-gradient-to-br from-card via-card to-primary/5">
        <CardHeader className="flex-shrink-0 pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 p-0">
          <ScrollArea className="h-full px-4 pb-4">
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-10 bg-muted/50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : activities.length > 0 ? (
              <div className="space-y-1.5">
                {activities.map((activity, index) => {
                  const Icon = actionIcons[activity.action_type] || FileText;
                  const colorClass = actionColors[activity.action_type] || 'text-muted-foreground bg-muted';
                  
                  return (
                    <motion.div
                      key={activity.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors"
                    >
                      <div className={cn("p-1.5 rounded-full flex-shrink-0", colorClass)}>
                        <Icon className="w-3 h-3" />
                      </div>
                      <p className="text-xs text-muted-foreground flex-1 truncate">
                        {activity.description}
                      </p>
                      <span className="text-[10px] text-muted-foreground/70 flex-shrink-0">
                        {formatTimeAgo(activity.created_at)}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-6">
                <Activity className="w-8 h-8 text-muted-foreground/30 mb-2" />
                <p className="text-xs text-muted-foreground">No recent activity</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
