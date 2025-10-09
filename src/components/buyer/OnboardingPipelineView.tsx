import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Clock, CheckCircle, XCircle, Search, RefreshCw, Eye, Send, AlertCircle, BarChart3, Activity, Keyboard, Download, ChevronDown } from 'lucide-react';
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
  { id: 'pending', name: 'Invited', color: 'bg-slate-100' },
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
          loadRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

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
      setBuyerId(buyer.id);

      const { data, error } = await supabase
        .from('supplier_onboarding_requests')
        .select('*')
        .eq('buyer_id', buyer.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Apply search filter
      let filtered = data || [];
      if (searchQuery.trim()) {
        filtered = filtered.filter(r => 
          r.supplier_company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.supplier_email?.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }
      
      setRequests(filtered);

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
