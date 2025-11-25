import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Clock, CheckCircle, XCircle, Search, RefreshCw, Eye, Send, AlertCircle, BarChart3, Activity, Keyboard, Download, ChevronDown, ThumbsUp, ThumbsDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { OnboardingRequestDetailDrawer } from './OnboardingRequestDetailDrawer';
import { PipelineAnalytics } from './PipelineAnalytics';
import { OnboardingActivityFeed } from './OnboardingActivityFeed';
import { BulkActionsBar } from './BulkActionsBar';
import { AdvancedFilters } from './AdvancedFilters';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { ExportModal } from './ExportModal';
import { useOnboardingPipeline } from '@/hooks/useOnboardingPipeline';
import { useHotkeys } from 'react-hotkeys-hook';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DndContext, DragEndEvent, DragOverlay, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useBranchContext } from '@/contexts/BranchContext';
import { Building2 } from 'lucide-react';

const PIPELINE_STAGES = [
  { id: 'requested', name: 'Requested', color: 'bg-purple-100' },
  { id: 'invited', name: 'Invited', color: 'bg-indigo-100' },
  { id: 'pending', name: 'Pending Signup', color: 'bg-slate-100' },
  { id: 'onboarding_initiated', name: 'Started', color: 'bg-blue-100' },
  { id: 'under_review', name: 'Under Review', color: 'bg-yellow-100' },
  { id: 'approved', name: 'Approved', color: 'bg-green-100' },
  { id: 'rejected', name: 'Declined', color: 'bg-red-100' }
];

export const OnboardingPipelineView = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { currentBranch, allBranchesView } = useBranchContext();
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  const [requirementCounts, setRequirementCounts] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [buyerId, setBuyerId] = useState<string>('');
  const [showAnalytics, setShowAnalytics] = useState(true);
  const [showActivityFeed, setShowActivityFeed] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Use the pipeline hook for advanced features
  const {
    filters,
    setFilters,
    filteredRequests,
    selectedRequests,
    toggleSelection,
    selectAll,
    clearSelection,
    isSelected,
    getAlertStatus,
    calculateProgress,
    prepareExportData,
  } = useOnboardingPipeline(requests);

  // Keyboard shortcuts
  useHotkeys('r', () => loadRequests(), { preventDefault: true });
  useHotkeys('f', () => searchInputRef.current?.focus(), { preventDefault: true });
  useHotkeys('s', () => setShowActivityFeed(prev => !prev), { preventDefault: true });
  useHotkeys('a', () => setShowAnalytics(prev => !prev), { preventDefault: true });
  useHotkeys('e', () => setShowExport(true), { preventDefault: true });
  useHotkeys('/', () => setShowShortcuts(true), { preventDefault: true });
  useHotkeys('?', () => setShowShortcuts(true), { preventDefault: true });
  useHotkeys('shift+a', () => selectAll(), { preventDefault: true });
  useHotkeys('shift+c', () => clearSelection(), { preventDefault: true });
  useHotkeys('esc', () => {
    setDrawerOpen(false);
    setShowShortcuts(false);
    setShowExport(false);
    clearSelection();
  }, { preventDefault: true });

  useEffect(() => {
    if (user?.id) {
      loadRequests();
    }
  }, [user?.id]);

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
          loadRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      
      // Step 1: Check if user is a team member
      const { data: teamMember } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('profile_id', user?.id)
        .eq('company_type', 'buyer')
        .eq('status', 'active')
        .maybeSingle();

      // Step 2: Resolve buyer ID (team member uses company_id, owner uses profile_id)
      const buyerId = teamMember?.company_id || user?.id;

      // Step 3: Get buyer profile using resolved ID
      const { data: buyerData, error: buyerError } = await supabase
        .from('buyers')
        .select('id')
        .eq('id', buyerId)
        .single();

      if (buyerError || !buyerData) {
        console.error('Error fetching buyer:', buyerError);
        setRequests([]);
        return;
      }

      setBuyerId(buyerData.id);

      // Add defensive check to prevent queries with empty buyer_id
      if (!buyerData.id) {
        console.error('No buyer ID resolved');
        setRequests([]);
        return;
      }

      // Onboarding requests are company-level, not branch-level
      // No branch filtering needed - show all onboarding requests for the company
      const { data, error } = await supabase
        .from('supplier_onboarding_requests')
        .select('*')
        .eq('buyer_id', buyerData.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);

      // Load requirement counts
      const counts: Record<string, number> = {};
      if (data) {
        for (const req of data) {
          const { count } = await supabase
            .from('onboarding_document_requirements')
            .select('id', { count: 'exact', head: true })
            .eq('onboarding_request_id', req.id);
          
          counts[req.id] = count ?? 0;
        }
      }
      setRequirementCounts(counts);
    } catch (error) {
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

  const getRequestAlertStatus = (request: any) => {
    const now = new Date();
    const createdAt = new Date(request.created_at);
    const updatedAt = new Date(request.updated_at || request.created_at);
    const daysSinceCreated = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    const daysSinceUpdated = Math.floor((now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));
    
    if (request.status === 'pending' && daysSinceCreated > 7) {
      return { 
        level: 'warning', 
        message: `${daysSinceCreated} days since invitation`,
        variant: 'default' as const
      };
    }
    if (request.status === 'onboarding_initiated' && daysSinceUpdated > 14) {
      return { 
        level: 'danger', 
        message: `${daysSinceUpdated} days in progress`,
        variant: 'destructive' as const
      };
    }
    if (request.status === 'under_review' && daysSinceUpdated > 7) {
      return { 
        level: 'warning', 
        message: `${daysSinceUpdated} days awaiting review`,
        variant: 'default' as const
      };
    }
    return null;
  };

  const getRequestsForStage = (stageId: string) => {
    return filteredRequests.filter(r => r.status === stageId);
  };

  const handleApproveRequest = async (requestId: string) => {
    try {
      // Update status to 'pending'
      const { error: updateError } = await supabase
        .from('supplier_onboarding_requests')
        .update({ 
          status: 'pending',
          responded_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (updateError) throw updateError;

      // Populate requirements
      const { error: functionError } = await supabase.functions.invoke('populate-onboarding-requirements', {
        body: { onboarding_request_id: requestId }
      });

      if (functionError) throw functionError;

      toast({
        title: 'Request Approved',
        description: 'The onboarding request has been approved and requirements have been set up.'
      });

      loadRequests();
    } catch (error: any) {
      console.error('Error approving request:', error);
      toast({
        title: 'Error',
        description: 'Failed to approve request',
        variant: 'destructive'
      });
    }
  };

  const handleRejectRequest = async (requestId: string, reason: string) => {
    try {
      const { error } = await supabase
        .from('supplier_onboarding_requests')
        .update({ 
          status: 'rejected',
          responded_at: new Date().toISOString(),
          rejection_reason: reason
        })
        .eq('id', requestId);

      if (error) throw error;

      toast({
        title: 'Request Declined',
        description: 'The onboarding request has been declined.'
      });

      loadRequests();
    } catch (error: any) {
      console.error('Error rejecting request:', error);
      toast({
        title: 'Error',
        description: 'Failed to decline request',
        variant: 'destructive'
      });
    }
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

  const handleBulkSendReminders = async () => {
    const selected = requests.filter(r => selectedRequests.has(r.id));
    for (const request of selected) {
      try {
        await supabase.functions.invoke('send-supplier-invitation', {
          body: { email: request.supplier_email, isReminder: true, requestId: request.id }
        });
      } catch (error) {
        console.error('Failed to send reminder:', error);
      }
    }
    toast({ title: 'Reminders Sent', description: `Sent ${selected.length} reminders` });
    clearSelection();
  };

  const handleBulkExport = () => {
    setShowExport(true);
  };

  const handleBulkArchive = () => {
    toast({ title: 'Archive', description: 'Archive functionality coming soon' });
  };

  const handlePopulateRequirements = async (requestId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      const { data, error } = await supabase.functions.invoke('populate-onboarding-requirements', {
        body: { onboarding_request_id: requestId }
      });

      if (error) throw error;

      if (data?.skipped) {
        toast({
          title: 'Already Populated',
          description: 'This request already has requirements',
        });
      } else {
        toast({
          title: 'Requirements Populated',
          description: `Added ${data?.documents_added || 0} documents and ${data?.fields_added || 0} form fields`,
        });
        // Refresh the requests to update UI
        loadRequests();
      }
    } catch (error: any) {
      console.error('Failed to populate requirements:', error);
      toast({
        title: 'Error',
        description: 'Failed to populate requirements',
        variant: 'destructive'
      });
    }
  };

  const checkHasRequirements = (requestId: string) => {
    // This will be checked in real-time from the database
    // For now, we'll add a state to track this
    return true; // Placeholder - will be replaced with actual check
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
  
  const getDaysInStage = (request: any) => {
    const statusDate = request.responded_at || request.created_at;
    return formatDistanceToNow(new Date(statusDate), { addSuffix: false });
  };
  
  const bottlenecks = requests.filter(r => {
    const alert = getAlertStatus(r);
    return alert.level === 'critical';
  }).length;
  
  const getAnalytics = () => {
    const total = requests.length;
    const inProgress = stats.started + stats.review;
    const completed = stats.approved;
    const conversionRate = total > 0 ? ((completed / total) * 100).toFixed(1) : '0';
    const avgTimeToComplete = completed > 0 
      ? requests.filter(r => r.status === 'approved').reduce((sum, r) => {
          const days = (new Date(r.responded_at || new Date()).getTime() - new Date(r.created_at).getTime()) / (1000 * 60 * 60 * 24);
          return sum + days;
        }, 0) / completed
      : 0;
    
    return { total, inProgress, completed, conversionRate, avgTimeToComplete: avgTimeToComplete.toFixed(1) };
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Bottleneck Alert */}
      {bottlenecks > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{bottlenecks} request{bottlenecks > 1 ? 's require' : ' requires'} attention</AlertTitle>
          <AlertDescription>
            You have {bottlenecks} supplier{bottlenecks > 1 ? 's' : ''} waiting more than 7 days
          </AlertDescription>
        </Alert>
      )}
      
      {/* Search & Filter Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  placeholder="Search by company name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowAnalytics(prev => !prev)} className="gap-2">
                <BarChart3 className="h-4 w-4" />
                Analytics
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowActivityFeed(true)} className="gap-2">
                <Activity className="h-4 w-4" />
                Activity
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowExport(true)} className="gap-2">
                <Download className="h-4 w-4" />
                Export
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowShortcuts(true)} className="gap-2">
                <Keyboard className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={loadRequests} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
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
      
      {/* Advanced Filters */}
      <AdvancedFilters filters={filters} onFiltersChange={setFilters} />
      
      {/* Analytics Section */}
      {showAnalytics && (
        <Collapsible open={showAnalytics} onOpenChange={setShowAnalytics}>
          <CollapsibleContent>
            <PipelineAnalytics requests={requests} />
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Pipeline Stages */}
      <div className="grid grid-cols-5 gap-4">
      {PIPELINE_STAGES.map(stage => {
        const stageRequests = getRequestsForStage(stage.id);
        
        return (
          <div key={stage.id} className="space-y-3">
            <Card className={stage.color}>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium">{stage.name}</CardTitle>
                <Badge variant="secondary">{stageRequests.length}</Badge>
              </CardHeader>
            </Card>

            <div className="space-y-3">
              {stageRequests.map(request => {
                const alert = getAlertStatus(request);
                const overdueAlert = getRequestAlertStatus(request);
                return (
                  <Card 
                    key={request.id} 
                    className={`hover:shadow-lg transition-all cursor-pointer hover:border-primary/50 ${
                      isSelected(request.id) ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => handleCardClick(request)}
                  >
                    <CardContent className="p-4 space-y-3">
                      {/* Selection Checkbox & Alert Badge */}
                      <div className="flex items-start justify-between">
                        <Checkbox
                          checked={isSelected(request.id)}
                          onCheckedChange={() => toggleSelection(request.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <Badge variant={alert.level === 'critical' ? 'destructive' : 'outline'} className="text-xs">
                          {alert.icon} {alert.message}
                        </Badge>
                      </div>
                      
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
                          <>
                            {/* Populate Requirements Button (only if empty) */}
                            {requirementCounts[request.id] === 0 && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="flex-1 border-yellow-500"
                                      onClick={(e) => handlePopulateRequirements(request.id, e)}
                                    >
                                      <AlertCircle className="h-3 w-3 text-yellow-500" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Populate Requirements (Empty!)</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}

                            {/* Send Reminder Button */}
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
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
      </div>

      {/* Bulk Actions Bar */}
      <BulkActionsBar
        selectedCount={selectedRequests.size}
        onSendReminders={handleBulkSendReminders}
        onExport={handleBulkExport}
        onArchive={handleBulkArchive}
        onClear={clearSelection}
      />

      {/* Detail Drawer */}
      {selectedRequest && (
        <OnboardingRequestDetailDrawer
          request={selectedRequest}
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          onStatusChange={loadRequests}
        />
      )}
      
      {/* Activity Feed Sidebar */}
      <OnboardingActivityFeed
        buyerId={buyerId}
        isOpen={showActivityFeed}
        onClose={() => setShowActivityFeed(false)}
        onRequestClick={(requestId) => {
          const request = requests.find(r => r.id === requestId);
          if (request) {
            setSelectedRequest(request);
            setDrawerOpen(true);
          }
        }}
      />
      
      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />
      
      {/* Export Modal */}
      <ExportModal
        isOpen={showExport}
        onClose={() => setShowExport(false)}
        data={prepareExportData()}
        analytics={getAnalytics()}
      />
    </div>
  );
};
