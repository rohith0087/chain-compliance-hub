import { useState, useEffect, useRef } from 'react';
import logger from '@/utils/logger';
import { Slab } from 'react-loading-indicators';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Clock, CheckCircle, XCircle, Search, RefreshCw, Eye, Send, AlertCircle, BarChart3, Activity, Keyboard, Download, ChevronDown, ThumbsUp, ThumbsDown, LayoutGrid, Table as TableIcon, ChevronUp, Plus, X } from 'lucide-react';
import { OnboardingRequestForm } from './OnboardingRequestForm';
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
import { OnboardingPipelineTableView } from './OnboardingPipelineTableView';
import { useOnboardingPipeline } from '@/hooks/useOnboardingPipeline';
import { useHotkeys } from 'react-hotkeys-hook';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useBranchContext } from '@/contexts/BranchContext';

const PIPELINE_STAGES = [
  { id: 'requested', name: 'Requested', color: 'bg-primary/15' },
  { id: 'invited', name: 'Invited', color: 'bg-primary/15' },
  { id: 'pending', name: 'Pending', color: 'bg-muted' },
  { id: 'onboarding_initiated', name: 'Started', color: 'bg-primary/15' },
  { id: 'under_review', name: 'Review', color: 'bg-warning/15' },
  { id: 'approved', name: 'Approved', color: 'bg-success/15' },
  { id: 'rejected', name: 'Declined', color: 'bg-danger/15' }
];

export const OnboardingPipelineView = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { currentBranch, allBranchesView } = useBranchContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  const [requirementCounts, setRequirementCounts] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [buyerId, setBuyerId] = useState<string>('');
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showActivityFeed, setShowActivityFeed] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>(() => {
    const saved = localStorage.getItem('onboarding-pipeline-view');
    return (saved as 'kanban' | 'table') || 'table';
  });
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(new Set());
  const [showBottleneckAlert, setShowBottleneckAlert] = useState(true);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Check for pre-selected supplier from notifications/discovery
  useEffect(() => {
    const preselectConnectionId = sessionStorage.getItem('preselect_onboarding_supplier_connection_id');
    if (preselectConnectionId && buyerId) {
      setShowCreateForm(true);
    }
  }, [buyerId]);

  // Auto-open drawer for specific request (e.g., from custom onboarding flow)
  useEffect(() => {
    const requestId = searchParams.get('request');
    if (requestId && requests.length > 0 && !loading) {
      const targetRequest = requests.find(r => r.id === requestId);
      if (targetRequest) {
        setSelectedRequest(targetRequest);
        setDrawerOpen(true);
        // Clear the URL parameter
        searchParams.delete('request');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [requests, searchParams, loading]);

  // Persist view mode preference
  useEffect(() => {
    localStorage.setItem('onboarding-pipeline-view', viewMode);
  }, [viewMode]);

  const toggleColumnCollapse = (stageId: string) => {
    setCollapsedColumns(prev => {
      const next = new Set(prev);
      if (next.has(stageId)) {
        next.delete(stageId);
      } else {
        next.add(stageId);
      }
      return next;
    });
  };
  
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

    const channelName = `onboarding-pipeline-changes-${user.id}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'supplier_onboarding_requests'
        },
        (payload) => {
          logger.debug('Real-time update:', payload);
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

      // Load requirement counts in a single batch query (fixes N+1 problem)
      if (data && data.length > 0) {
        const requestIds = data.map(r => r.id);
        
        const { data: requirementsData } = await supabase
          .from('onboarding_document_requirements')
          .select('onboarding_request_id')
          .in('onboarding_request_id', requestIds);
        
        // Aggregate counts client-side
        const counts: Record<string, number> = {};
        requestIds.forEach(id => counts[id] = 0); // Initialize all to 0
        
        if (requirementsData) {
          requirementsData.forEach(req => {
            counts[req.onboarding_request_id] = (counts[req.onboarding_request_id] || 0) + 1;
          });
        }
        
        setRequirementCounts(counts);
      } else {
        setRequirementCounts({});
      }
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
        } as any)
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
      // Get the request data to find the supplier
      const requestData = requests.find(r => r.id === requestId);

      const { error } = await supabase
        .from('supplier_onboarding_requests')
        .update({ 
          status: 'rejected',
          responded_at: new Date().toISOString(),
          rejection_reason: reason
        } as any)
        .eq('id', requestId);

      if (error) throw error;

      // Send notification to supplier about full onboarding decline
      if (requestData?.supplier_id) {
        const { data: supplier } = await supabase
          .from('suppliers')
          .select('profile_id')
          .eq('id', requestData.supplier_id)
          .single();

        if (supplier?.profile_id) {
          await supabase.rpc('create_notification', {
            p_user_id: supplier.profile_id,
            p_title: 'Onboarding Request Declined',
            p_message: `Your onboarding request has been declined. Reason: ${reason}`,
            p_type: 'onboarding_declined',
            p_reference_id: requestId
          });
        }
      }

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
    
    if (!buyerId) {
      toast({ title: 'Error', description: 'Buyer ID not found', variant: 'destructive' });
      return;
    }

    try {
      const { data: buyerProfile } = await supabase
        .from('buyers')
        .select('company_name, contact_email, industry')
        .eq('id', buyerId)
        .single();

      await supabase.functions.invoke('send-supplier-invitation', {
        body: {
          emails: [request.supplier_email],
          subject: `Reminder: Complete your onboarding with ${buyerProfile?.company_name || 'our company'}`,
          buyerData: {
            name: buyerProfile?.company_name || '',
            company: buyerProfile?.company_name || '',
            email: buyerProfile?.contact_email || '',
            industry: buyerProfile?.industry || '',
            buyerId: buyerId
          }
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
    if (!buyerId) {
      toast({ title: 'Error', description: 'Buyer ID not found', variant: 'destructive' });
      return;
    }

    const selected = requests.filter(r => selectedRequests.has(r.id));
    
    try {
      const { data: buyerProfile } = await supabase
        .from('buyers')
        .select('company_name, contact_email, industry')
        .eq('id', buyerId)
        .single();

      const emails = selected.map(r => r.supplier_email).filter(Boolean);
      
      if (emails.length === 0) {
        toast({ title: 'Error', description: 'No valid emails found', variant: 'destructive' });
        return;
      }

      await supabase.functions.invoke('send-supplier-invitation', {
        body: {
          emails,
          subject: `Reminder: Complete your onboarding with ${buyerProfile?.company_name || 'our company'}`,
          buyerData: {
            name: buyerProfile?.company_name || '',
            company: buyerProfile?.company_name || '',
            email: buyerProfile?.contact_email || '',
            industry: buyerProfile?.industry || '',
            buyerId: buyerId
          }
        }
      });

      toast({ title: 'Reminders Sent', description: `Sent reminders to ${emails.length} suppliers` });
    } catch (error) {
      console.error('Failed to send reminders:', error);
      toast({ title: 'Error', description: 'Failed to send reminders', variant: 'destructive' });
    }
    
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

  // Auto-dismiss bottleneck alert after 10 seconds
  useEffect(() => {
    if (bottlenecks > 0 && showBottleneckAlert) {
      const timer = setTimeout(() => {
        setShowBottleneckAlert(false);
      }, 10000);
      
      return () => clearTimeout(timer);
    }
  }, [bottlenecks, showBottleneckAlert]);

  // Reset alert visibility when requests data changes
  useEffect(() => {
    if (bottlenecks > 0) {
      setShowBottleneckAlert(true);
    }
  }, [requests.length]);
  
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
    return (
      <div className="flex items-center justify-center py-24">
        <Slab color="#0d9e8a" size="medium" text="Loading..." textColor="#0d9e8a" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Bottleneck Alert */}
      {bottlenecks > 0 && showBottleneckAlert && (
        <Alert variant="destructive" className="relative">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{bottlenecks} supplier{bottlenecks > 1 ? "s haven't" : " hasn't"} responded</AlertTitle>
          <AlertDescription>
            These suppliers have not started or completed their onboarding in over 7 days. Consider sending a reminder.
          </AlertDescription>
          <button 
            onClick={() => setShowBottleneckAlert(false)}
            className="absolute top-3 right-3 text-destructive-foreground/70 hover:text-destructive-foreground transition-colors"
            aria-label="Dismiss alert"
          >
            <X className="h-4 w-4" />
          </button>
        </Alert>
      )}
      
      {/* Search & Filter Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              {/* New Request Button */}
              <Button 
                onClick={() => setShowCreateForm(true)} 
                className="gap-2 bg-gradient-to-r from-primary to-primary-hover"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New Request</span>
              </Button>
              
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
              
              {/* View Toggle */}
              <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as 'kanban' | 'table')}>
                <ToggleGroupItem value="kanban" aria-label="Kanban view" className="gap-1.5">
                  <LayoutGrid className="h-4 w-4" />
                  <span className="hidden sm:inline">Kanban</span>
                </ToggleGroupItem>
                <ToggleGroupItem value="table" aria-label="Table view" className="gap-1.5">
                  <TableIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">Table</span>
                </ToggleGroupItem>
              </ToggleGroup>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowAnalytics(prev => !prev)} className="gap-2">
                  <BarChart3 className="h-4 w-4" />
                  <span className="hidden md:inline">Analytics</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowActivityFeed(true)} className="gap-2">
                  <Activity className="h-4 w-4" />
                  <span className="hidden md:inline">Activity</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowExport(true)} className="gap-2">
                  <Download className="h-4 w-4" />
                  <span className="hidden md:inline">Export</span>
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

      {/* Pipeline View - Kanban or Table */}
      {viewMode === 'kanban' ? (
        <div className="overflow-x-auto pb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 min-w-[900px]">
            {PIPELINE_STAGES.map(stage => {
              const stageRequests = getRequestsForStage(stage.id);
              const isCollapsed = collapsedColumns.has(stage.id);
              
              return (
                <div key={stage.id} className="space-y-2 min-w-[140px]">
                  {/* Column Header */}
                  <Card className={`${stage.color} cursor-pointer`} onClick={() => toggleColumnCollapse(stage.id)}>
                    <CardHeader className="p-2.5 flex flex-row items-center justify-between">
                      <CardTitle className="text-xs font-medium truncate">{stage.name}</CardTitle>
                      <div className="flex items-center gap-1">
                        <Badge variant="secondary" className="text-xs h-5 px-1.5">{stageRequests.length}</Badge>
                        {isCollapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
                      </div>
                    </CardHeader>
                  </Card>

                  {/* Column Content - Scrollable */}
                  {!isCollapsed && (
                    <ScrollArea className="h-[500px]">
                      <div className="space-y-2 pr-2">
                        {stageRequests.map(request => {
                          const alert = getAlertStatus(request);
                          const truncatedEmail = request.supplier_email?.length > 18 
                            ? request.supplier_email.substring(0, 16) + '...' 
                            : request.supplier_email;

                          const getStatusDot = () => {
                            if (alert.level === 'critical') return 'bg-destructive';
                            if (alert.level === 'warning') return 'bg-warning';
                            if (alert.level === 'success') return 'bg-success';
                            if (alert.level === 'ended') return 'bg-muted-foreground';
                            return 'bg-success';
                          };

                          return (
                            <Card 
                              key={request.id} 
                              className={`group cursor-pointer hover:border-primary/50 transition-colors ${
                                isSelected(request.id) ? 'ring-2 ring-primary' : ''
                              }`}
                              onClick={() => handleCardClick(request)}
                            >
                              <CardContent className="p-2 space-y-1.5">
                                {/* Row 1: Checkbox + Name + Status Dot */}
                                <div className="flex items-center gap-1.5">
                                  <Checkbox
                                    checked={isSelected(request.id)}
                                    onCheckedChange={() => toggleSelection(request.id)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="h-3.5 w-3.5 shrink-0"
                                  />
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="text-xs font-medium truncate flex-1 min-w-0">
                                          {request.supplier_company_name || truncatedEmail}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent side="top">
                                        <p className="font-medium">{request.supplier_company_name || 'No company'}</p>
                                        <p className="text-xs text-muted-foreground">{request.supplier_email}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className={`h-2 w-2 rounded-full shrink-0 ${getStatusDot()}`} />
                                      </TooltipTrigger>
                                      <TooltipContent side="top">{alert.message}</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>

                                {/* Row 2: Time */}
                                <div className="flex items-center text-micro text-muted-foreground">
                                  <Clock className="h-2.5 w-2.5 mr-1" />
                                  {getDaysInStage(request)}
                                </div>

                                {/* Row 3: Progress (only for active stages) */}
                                {stage.id !== 'approved' && stage.id !== 'rejected' && (
                                  <div className="flex items-center gap-1.5">
                                    <Progress value={calculateProgress(request)} className="h-1 flex-1" />
                                    <span className="text-micro text-muted-foreground w-6">{calculateProgress(request)}%</span>
                                  </div>
                                )}

                                {/* Completed/Declined indicators */}
                                {stage.id === 'approved' && (
                                  <div className="flex items-center gap-1 text-micro text-success">
                                    <CheckCircle className="h-2.5 w-2.5" />
                                    <span>Complete</span>
                                  </div>
                                )}

                                {stage.id === 'rejected' && (
                                  <div className="flex items-center gap-1 text-micro text-destructive">
                                    <XCircle className="h-2.5 w-2.5" />
                                    <span>Declined</span>
                                  </div>
                                )}

                                {/* Actions - appear on hover */}
                                <div className="flex gap-1 pt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-5 w-5 p-0"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleCardClick(request);
                                          }}
                                        >
                                          <Eye className="h-3 w-3" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>View</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>

                                  {(stage.id === 'pending' || stage.id === 'onboarding_initiated' || stage.id === 'invited') && (
                                    <>
                                      {requirementCounts[request.id] === 0 && (
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-5 w-5 p-0"
                                                onClick={(e) => handlePopulateRequirements(request.id, e)}
                                              >
                                                <AlertCircle className="h-3 w-3 text-warning" />
                                              </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>Populate Requirements</TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      )}

                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              className="h-5 w-5 p-0"
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
                        
                        {stageRequests.length === 0 && (
                          <div className="text-center py-6 text-xs text-muted-foreground">
                            No suppliers
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <OnboardingPipelineTableView
          requests={filteredRequests}
          selectedRequests={selectedRequests}
          toggleSelection={toggleSelection}
          selectAll={selectAll}
          clearSelection={clearSelection}
          getAlertStatus={getAlertStatus}
          calculateProgress={calculateProgress}
          requirementCounts={requirementCounts}
          onCardClick={handleCardClick}
          onSendReminder={handleSendReminder}
          onPopulateRequirements={handlePopulateRequirements}
        />
      )}

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
      
      {/* Create Onboarding Request Sheet */}
      <Sheet open={showCreateForm} onOpenChange={setShowCreateForm}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Create Onboarding Request</SheetTitle>
          </SheetHeader>
          {buyerId && (
            <OnboardingRequestForm
              buyerId={buyerId}
              onBack={() => setShowCreateForm(false)}
              onSuccess={() => {
                setShowCreateForm(false);
                loadRequests();
              }}
              embedded
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};
