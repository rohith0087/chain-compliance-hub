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
  ShieldAlert,
  Zap,
  ChevronRight
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useBranchContext } from '@/contexts/BranchContext';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getWorkspaceProfileForIndustry } from '@/config/workspaceProfiles';

interface ActivityQuickActionsPanelProps {
  buyerId: string;
  onNewRequest: () => void;
  onInviteSupplier: () => void;
  onNavigateToDocuments: (filter?: string) => void;
  onNavigateToTab: (tab: string) => void;
  industry?: string | null;
}

interface ActivityItem {
  id: string;
  action_type: string;
  description: { title: string; subtitle: string };
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
  approved: 'text-success bg-success/10',
  uploaded: 'text-primary bg-primary/10',
  requested: 'text-primary bg-primary/10',
  link_created: 'text-primary bg-primary/10',
  submitted: 'text-primary bg-primary/10',
  rejected: 'text-danger bg-danger/10',
  downloaded: 'text-warning bg-warning/10',
};

export function ActivityQuickActionsPanel({
  buyerId,
  onNewRequest,
  onInviteSupplier,
  onNavigateToDocuments,
  onNavigateToTab,
  industry
}: ActivityQuickActionsPanelProps) {
  const wsProfile = getWorkspaceProfileForIndustry(industry);
  const wsTerms = wsProfile.terms;
  const wsFlags = wsProfile.flags;
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

        // Fetch upload IDs associated with the requests to filter logs
        const requestIdsList = requestIds.map(r => r.id);
        const { data: uploads } = await supabase
          .from('document_uploads')
          .select('id')
          .in('request_id', requestIdsList);
        
        const uploadIdsList = uploads?.map(u => u.id) || [];
        
        let orQuery = `document_request_id.in.(${requestIdsList.join(',')})`;
        if (uploadIdsList.length > 0) {
          orQuery += `,document_upload_id.in.(${uploadIdsList.join(',')})`;
        }

        const { data: activityData, error } = await supabase
          .from('document_activity_logs')
          .select('*')
          .or(orQuery)
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
    const actor = metadata?.actor_name || metadata?.requested_by || null;
    let title = '';
    let subtitle = '';
    switch (actionType) {
      case 'approved': title = `${docName}`; subtitle = 'Document approved'; break;
      case 'rejected': title = `${docName}`; subtitle = 'Document declined'; break;
      case 'uploaded': title = `${docName}`; subtitle = 'Document uploaded'; break;
      case 'submitted': title = `${docName}`; subtitle = actor ? `Requested by ${actor}` : 'Document submitted'; break;
      case 'requested': title = `${docName}`; subtitle = actor ? `Requested by ${actor}` : 'Document requested'; break;
      case 'link_created': title = `Link created for ${docName}`; subtitle = 'Secure link generated'; break;
      case 'downloaded': title = `${docName}`; subtitle = 'Document downloaded'; break;
      default: title = `${actionType} - ${docName}`; subtitle = ''; break;
    }
    return { title, subtitle };
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
    !wsFlags.hideCOAAnalysis && { label: 'COA Analysis', icon: FlaskConical, onClick: () => onNavigateToTab('coa-analysis'), color: 'bg-primary hover:bg-primary text-white' },
    { label: wsTerms.supplier_risk, icon: ShieldAlert, onClick: () => onNavigateToTab('supplier-risk'), color: 'bg-secondary hover:bg-secondary/90 text-secondary-foreground' },
    { label: wsTerms.suppliers, icon: Users, onClick: () => onNavigateToTab('suppliers'), color: 'bg-muted hover:bg-muted/80 text-foreground' },
  ].filter(Boolean) as { label: string; icon: any; onClick: () => void; color: string }[];


  return (
    <div className="h-full flex flex-col gap-4">
      {/* Quick Actions */}
      <Card className="flex-shrink-0 border-0 bg-gradient-to-br from-card via-card to-muted/30">
        <CardHeader className="pb-3 pt-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Zap className="w-4 h-4 text-warning" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4 px-4">
          <div className="grid grid-cols-2 gap-2">
            {quickActions.map((action) => (
              <Button
                key={action.label}
                size="sm"
                className={cn("h-11 text-xs font-medium justify-center px-2 gap-1.5", action.color)}
                onClick={action.onClick}
              >
                <action.icon className="w-4 h-4 flex-shrink-0" />
                <span className="whitespace-nowrap">{action.label}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Activity Feed */}
      <Card className="flex-1 min-h-0 flex flex-col border-0 bg-gradient-to-br from-card via-card to-primary/5">
        <CardHeader className="flex-shrink-0 pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Recent Activity
            </CardTitle>
            <Button
              variant="link"
              size="sm"
              className="text-xs text-primary h-auto p-0"
              onClick={() => onNavigateToDocuments()}
            >
              View all
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 flex flex-col p-0">
          <ScrollArea className="flex-1 min-h-0 px-4 pb-4">
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
                      className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors"
                    >
                      <div className={cn("p-1.5 rounded-full flex-shrink-0 mt-0.5", colorClass)}>
                        <Icon className="w-3 h-3" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-foreground truncate">
                          {activity.description.title}
                        </p>
                        {activity.description.subtitle && (
                          <p className="text-micro text-muted-foreground/70 mt-0.5 truncate">
                            {activity.description.subtitle}
                          </p>
                        )}
                      </div>
                      <span className="text-micro text-muted-foreground/70 flex-shrink-0 mt-0.5">
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

          {/* Footer link */}
          <div className="flex-shrink-0 px-4 py-3 border-t border-border/30">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-primary hover:text-primary/80 hover:bg-primary/5 justify-center gap-1"
              onClick={() => onNavigateToDocuments()}
            >
              View all activity
              <ChevronRight className="w-3 h-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
