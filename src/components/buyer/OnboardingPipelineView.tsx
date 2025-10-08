import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Clock, CheckCircle, XCircle, Search, RefreshCw, Eye, Send, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { OnboardingRequestDetailDrawer } from './OnboardingRequestDetailDrawer';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const PIPELINE_STAGES = [
  { id: 'pending', name: 'Invited', color: 'bg-slate-100' },
  { id: 'onboarding_initiated', name: 'Started', color: 'bg-blue-100' },
  { id: 'under_review', name: 'Under Review', color: 'bg-yellow-100' },
  { id: 'approved', name: 'Approved', color: 'bg-green-100' },
  { id: 'rejected', name: 'Declined', color: 'bg-red-100' }
];

export const OnboardingPipelineView = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadRequests();
  }, [user]);

  useEffect(() => {
    // Set up real-time subscription
    if (!user) return;

    const channel = supabase
      .channel('onboarding-pipeline-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'supplier_onboarding_requests'
        },
        (payload) => {
          console.log('Real-time update:', payload);
          loadRequests(); // Reload requests on any change
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    // Filter requests based on search query and status
    let filtered = requests;

    if (searchQuery.trim()) {
      filtered = filtered.filter(r => 
        r.supplier_company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.supplier_email?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === statusFilter);
    }

    setFilteredRequests(filtered);
  }, [requests, searchQuery, statusFilter]);

  const loadRequests = async () => {
    if (!user) return;

    try {
      setLoading(true);

      const { data: buyer } = await supabase
        .from('buyers')
        .select('id')
        .eq('profile_id', user.id)
        .single();

      if (!buyer) return;

      const { data, error } = await supabase
        .from('supplier_onboarding_requests')
        .select('*')
        .eq('buyer_id', buyer.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);

    } catch (error: any) {
      console.error('Error loading requests:', error);
      toast({
        title: 'Error',
        description: 'Failed to load onboarding requests',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getRequestsForStage = (stageId: string) => {
    return filteredRequests.filter(r => r.status === stageId);
  };

  const handleCardClick = (request: any) => {
    setSelectedRequest(request);
    setDrawerOpen(true);
  };

  const handleSendReminder = async (request: any, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent drawer from opening
    
    try {
      await supabase.functions.invoke('send-supplier-invitation', {
        body: {
          email: request.supplier_email,
          isReminder: true,
          requestId: request.id
        }
      });

      toast({
        title: 'Reminder Sent',
        description: `Reminder sent to ${request.supplier_email}`
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to send reminder',
        variant: 'destructive'
      });
    }
  };

  const getStageStats = () => {
    return {
      total: requests.length,
      pending: requests.filter(r => r.status === 'pending').length,
      started: requests.filter(r => r.status === 'onboarding_initiated').length,
      review: requests.filter(r => r.status === 'under_review').length,
      approved: requests.filter(r => r.status === 'approved').length,
      rejected: requests.filter(r => r.status === 'rejected').length
    };
  };

  const stats = getStageStats();

  const calculateProgress = (request: any) => {
    if (!request.form_field_responses) return 0;
    
    const totalFields = Object.keys(request.form_fields || {}).length;
    const completedFields = Object.keys(request.form_field_responses || {}).length;
    
    if (totalFields === 0) return 0;
    return Math.round((completedFields / totalFields) * 100);
  };

  const getDaysInStage = (request: any) => {
    const statusDate = request.responded_at || request.created_at;
    return formatDistanceToNow(new Date(statusDate), { addSuffix: false });
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by company name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={loadRequests}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="mt-4 flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Total:</span>
              <span className="font-semibold">{stats.total}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">In Progress:</span>
              <span className="font-semibold">{stats.started + stats.review}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Completed:</span>
              <span className="font-semibold">{stats.approved}</span>
            </div>
            {stats.rejected > 0 && (
              <div className="flex items-center gap-1">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span className="text-destructive font-semibold">{stats.rejected} declined</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pipeline Stages */}
      <div className="grid grid-cols-5 gap-4">
      {PIPELINE_STAGES.map(stage => {
        const stageRequests = getRequestsForStage(stage.id);
        
        return (
          <div key={stage.id} className="space-y-3">
            <Card className={stage.color}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">
                  {stage.name}
                </CardTitle>
                <Badge variant="secondary">{stageRequests.length}</Badge>
              </CardHeader>
            </Card>

            <div className="space-y-3">
              {stageRequests.map(request => (
                <Card 
                  key={request.id} 
                  className="hover:shadow-lg transition-all cursor-pointer hover:border-primary/50"
                  onClick={() => handleCardClick(request)}
                >
                  <CardContent className="p-4 space-y-3">
                    <div>
                      <p className="font-medium text-sm">
                        {request.supplier_company_name || request.supplier_email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <Clock className="inline h-3 w-3 mr-1" />
                        {getDaysInStage(request)}
                      </p>
                    </div>

                    {stage.id !== 'approved' && stage.id !== 'rejected' && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-medium">{calculateProgress(request)}%</span>
                        </div>
                        <Progress value={calculateProgress(request)} className="h-2" />
                      </div>
                    )}

                    {stage.id === 'approved' && (
                      <Badge variant="outline" className="w-full justify-center">
                        <CheckCircle className="mr-1 h-3 w-3" />
                        Complete
                      </Badge>
                    )}

                    {stage.id === 'rejected' && (
                      <Badge variant="destructive" className="w-full justify-center">
                        <XCircle className="mr-1 h-3 w-3" />
                        Declined
                      </Badge>
                    )}

                    {/* Quick Actions */}
                    <div className="flex gap-2 pt-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCardClick(request);
                              }}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>View Details</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      {(stage.id === 'pending' || stage.id === 'onboarding_initiated') && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1"
                                onClick={(e) => handleSendReminder(request, e)}
                              >
                                <Send className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Send Reminder</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
      </div>

      {/* Detail Drawer */}
      {selectedRequest && (
        <OnboardingRequestDetailDrawer
          request={selectedRequest}
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          onStatusChange={loadRequests}
        />
      )}
    </div>
  );
};
