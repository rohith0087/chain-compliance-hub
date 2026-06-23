import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Building2, Search, ArrowLeft, Mail, Phone, 
  Send, RefreshCw, Eye, MoreHorizontal, UserPlus, 
  Users, Check, X, Calendar, Clock, MessageSquare
} from 'lucide-react';
import { CompanyLogo } from '@/components/ui/CompanyLogo';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useBuyerSetup } from '@/hooks/useBuyerSetup';
import { useWorkspaceProfile } from '@/hooks/useWorkspaceProfile';
import { VALID_INDUSTRIES } from '@/config/industries';
import { SafeSelect, SafeSelectItem } from '@/components/ui/SafeSelect';
import { createSafeSelectValue } from '@/utils/selectValidation';
import IndustryBasedSupplierSetup from './IndustryBasedSupplierSetup';
import { SupplierProfileModal } from './SupplierProfileModal';
import { BranchSupplierDashboard } from './BranchSupplierDashboard';
import { useBranchContext } from '@/contexts/BranchContext';
import { InviteSupplierModal } from './InviteSupplierModal';
import ConnectionApprovalModal, { OnboardingType } from './ConnectionApprovalModal';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  getIndustryBadgeClass,
  reviewActionButtonSecondaryClass,
  reviewCardContainerClass,
  reviewEmptyStateContainerClass,
  reviewPageSubtitleClass,
  reviewPageTitleClass,
  reviewToolbarSelectTriggerClass,
} from '@/components/documents/buyerReviewDesignSystem';
import ReviewPagination from '@/components/documents/ReviewPagination';

interface ConnectionRequest {
  id: string;
  buyer_id: string;
  supplier_id: string;
  status: 'pending' | 'approved' | 'rejected';
  notes: string | null;
  requested_at: string;
  initiated_by: string;
  supplier: {
    company_name: string;
    industry: string;
    company_logo_url?: string | null;
    profile?: {
      full_name: string;
    } | null;
  };
}

const SupplierDiscovery = () => {
  const { currentBranch, allBranchesView } = useBranchContext();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState<any[]>([]);
  const [selectedIndustry, setSelectedIndustry] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [buyerProfile, setBuyerProfile] = useState<any>(null);
  const [connections, setConnections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showIndustrySetup, setShowIndustrySetup] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [showSupplierDetail, setShowSupplierDetail] = useState(false);
  const [currentView, setCurrentView] = useState<'suppliers' | 'branches'>('suppliers');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'connected' | 'discover' | 'pending'>('connected');
  const [availableSuppliers, setAvailableSuppliers] = useState<any[]>([]);
  const [filteredAvailableSuppliers, setFilteredAvailableSuppliers] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Map<string, any>>(new Map());
  const [incomingRequests, setIncomingRequests] = useState<ConnectionRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<any[]>([]);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [selectedConnectionRequest, setSelectedConnectionRequest] = useState<ConnectionRequest | null>(null);
  const [connectedPage, setConnectedPage] = useState(1);
  const [connectedRowsPerPage, setConnectedRowsPerPage] = useState(9);
  const [discoverPage, setDiscoverPage] = useState(1);
  const [discoverRowsPerPage, setDiscoverRowsPerPage] = useState(9);
  const { user } = useAuth();
  const { getBuyerProfile } = useBuyerSetup();
  const { terms } = useWorkspaceProfile();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, currentBranch, allBranchesView]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Check if user is a team member first
      const { data: teamMember } = await supabase
        .from('company_users')
        .select('company_id, company_type')
        .eq('profile_id', user.id)
        .eq('company_type', 'buyer')
        .eq('status', 'active')
        .single();

      let buyerId: string | undefined;
      let buyerData: any;

      if (teamMember) {
        buyerId = teamMember.company_id;
        const { data: buyer } = await supabase
          .from('buyers')
          .select('*')
          .eq('id', buyerId)
          .single();
        buyerData = buyer;
      } else {
        buyerData = await getBuyerProfile();
        buyerId = buyerData?.id;
      }

      setBuyerProfile(buyerData);

      if (buyerId) {
        // Fetch approved connections
        const { data: connectionsData } = await supabase
          .from('buyer_supplier_connections')
          .select(`
            *,
            suppliers (
              id, company_name, contact_email, industry, phone, address, description, company_logo_url,
              supplier_items (id, item_name, item_category)
            )
          `)
          .eq('buyer_id', buyerId)
          .eq('status', 'approved');

        if (connectionsData) {
          setConnections(connectionsData);
          const suppliers = connectionsData.map(c => c.suppliers).filter(s => s !== null);
          setSuppliers(suppliers);
        }

        // Fetch available suppliers
        const { data: allSuppliersData } = await supabase
          .rpc('search_suppliers_for_discovery', {
            p_search_query: '',
            p_industry_filter: null,
            p_limit: 100
          });

        // Fetch pending outgoing requests
        const { data: pendingConnectionsData } = await supabase
          .from('buyer_supplier_connections')
          .select('*, supplier:suppliers(*)')
          .eq('buyer_id', buyerId)
          .eq('status', 'pending')
          .eq('initiated_by', 'buyer');

        const pendingMap = new Map();
        (pendingConnectionsData || []).forEach(conn => {
          pendingMap.set(conn.supplier_id, conn);
        });
        setPendingRequests(pendingMap);
        setOutgoingRequests(pendingConnectionsData || []);

        // Fetch incoming requests from suppliers
        const { data: incomingData } = await supabase
          .from('buyer_supplier_connections')
          .select(`
            id, buyer_id, supplier_id, status, notes, requested_at, initiated_by,
            supplier:suppliers (
              company_name, industry, company_logo_url,
              profile:profiles!suppliers_profile_id_fkey (full_name)
            )
          `)
          .eq('buyer_id', buyerId)
          .eq('initiated_by', 'supplier')
          .order('requested_at', { ascending: false });

        setIncomingRequests((incomingData || []) as ConnectionRequest[]);

        // Filter out connected and pending suppliers from available
        if (allSuppliersData && connectionsData) {
          const connectedSupplierIds = connectionsData.map(c => c.suppliers?.id).filter(Boolean);
          const pendingSupplierIds = (pendingConnectionsData || []).map(c => c.supplier_id);
          const excludeIds = [...connectedSupplierIds, ...pendingSupplierIds];
          const available = allSuppliersData.filter((s: any) => !excludeIds.includes(s.id));
          setAvailableSuppliers(available);
          setFilteredAvailableSuppliers(available);
        }
      }
    } catch (error: any) {
      console.error('Error in fetchData:', error);
      toast({
        title: "Error loading data",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const currentSuppliers = activeTab === 'connected' ? suppliers : availableSuppliers;
    let filtered = currentSuppliers;

    if (selectedIndustry !== 'all') {
      filtered = filtered.filter(s => s.industry === selectedIndustry);
    }

    if (searchTerm) {
      filtered = filtered.filter(s =>
        s.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.industry?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (activeTab === 'connected') {
      setFilteredSuppliers(filtered);
    } else {
      setFilteredAvailableSuppliers(filtered);
    }
  }, [selectedIndustry, searchTerm, suppliers, availableSuppliers, activeTab]);

  useEffect(() => {
    setConnectedPage(1);
    setDiscoverPage(1);
  }, [selectedIndustry, searchTerm]);

  const handleIndustryChange = (value: string) => {
    setSelectedIndustry(createSafeSelectValue(value, 'all'));
  };

  const handleViewSupplier = (supplier: any) => {
    setSelectedSupplier(supplier);
    setShowSupplierDetail(true);
  };

  const getConnectionStatus = (supplierId: string) => {
    const connection = connections.find(c => c.supplier_id === supplierId);
    return connection?.status === 'active' ? 'approved' : connection?.status || null;
  };

  const getConnectionDate = (supplierId: string) => {
    const connection = connections.find(c => c.supplier_id === supplierId);
    return connection?.assigned_at || null;
  };

  const handleSendConnectionRequest = async (supplier: any) => {
    if (!buyerProfile) return;

    try {
      const { data, error } = await supabase.rpc('send_supplier_connection_request', {
        p_buyer_id: buyerProfile.id,
        p_supplier_id: supplier.id,
        p_created_by: user?.id || buyerProfile.profile_id
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; supplier_company_name?: string };

      if (!result?.success) {
        throw new Error(result?.error || 'Failed to send connection request');
      }

      toast({
        title: "Request Sent",
        description: `Connection request sent to ${result?.supplier_company_name || supplier.company_name}`,
      });

      await fetchData();
    } catch (error: any) {
      console.error('Error sending connection request:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send connection request",
        variant: "destructive",
      });
    }
  };

  const handleResendRequest = async (supplier: any) => {
    if (!buyerProfile) return;

    try {
      const pendingRequest = pendingRequests.get(supplier.id);
      if (!pendingRequest) return;

      await supabase
        .from('buyer_supplier_connections')
        .update({ requested_at: new Date().toISOString() })
        .eq('id', pendingRequest.id);

      toast({
        title: "Request Resent",
        description: `Connection request resent to ${supplier.company_name}`,
      });

      await fetchData();
    } catch (error: any) {
      console.error('Error resending request:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to resend request",
        variant: "destructive",
      });
    }
  };

  const handleApproveClick = (request: ConnectionRequest) => {
    setSelectedConnectionRequest(request);
    setApprovalModalOpen(true);
  };

  const handleApprovalConfirm = async (onboardingType: OnboardingType) => {
    if (!selectedConnectionRequest) return;
    
    setProcessingIds(prev => new Set(prev).add(selectedConnectionRequest.id));
    
    try {
      const { data, error } = await (supabase.rpc as any)('approve_connection_with_onboarding', {
        p_connection_id: selectedConnectionRequest.id,
        p_onboarding_type: onboardingType,
        p_notes: null
      });
      
      if (error) throw error;
      
      const result = data as { success: boolean; error?: string; onboarding_request_id?: string };
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to approve connection');
      }
      
      toast({
        title: "Connection Approved",
        description: onboardingType === 'none' 
          ? `${terms.supplier} has been connected successfully` 
          : `${terms.supplier} connected and onboarding initiated`,
      });
      
      // Navigate to custom onboarding setup if selected
      if (onboardingType === 'custom' && result.onboarding_request_id) {
        navigate(`/dashboard?tab=onboarding&request=${result.onboarding_request_id}`);
      }
      
      await fetchData();
    } catch (error: any) {
      console.error('Error approving connection:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(selectedConnectionRequest.id);
        return newSet;
      });
      setApprovalModalOpen(false);
      setSelectedConnectionRequest(null);
    }
  };

  const handleRejectConnection = async (connectionId: string) => {
    if (processingIds.has(connectionId)) return;
    setProcessingIds(prev => new Set(prev).add(connectionId));

    try {
      const { data, error } = await supabase.rpc('handle_unified_connection_approval', {
        p_connection_id: connectionId,
        p_action: 'rejected',
        p_notes: null
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to reject request');
      }

      toast({
        title: "Request Rejected",
        description: "Connection request has been rejected",
      });

      await fetchData();
    } catch (error: any) {
      console.error('Error rejecting connection:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(connectionId);
        return newSet;
      });
    }
  };

  // Counts for tabs
  const pendingIncomingCount = incomingRequests.filter(r => r.status === 'pending').length;
  const pendingOutgoingCount = outgoingRequests.length;
  const totalPendingCount = pendingIncomingCount + pendingOutgoingCount;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!buyerProfile) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Complete Your Buyer Profile</h3>
          <p className="text-muted-foreground">Please set up your buyer profile to discover and connect with {terms.suppliers.toLowerCase()}.</p>
        </CardContent>
      </Card>
    );
  }

  if (showIndustrySetup) {
    return (
      <div className="space-y-6">
        <IndustryBasedSupplierSetup 
          buyerProfile={buyerProfile}
          onComplete={() => { setShowIndustrySetup(false); fetchData(); }}
        />
        <div className="text-center">
          <Button variant="outline" onClick={() => setShowIndustrySetup(false)}>
            Browse All {terms.suppliers} Instead
          </Button>
        </div>
      </div>
    );
  }

  if (currentView === 'branches') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => setCurrentView('suppliers')} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div>
            <h2 className="text-xl font-semibold">Branch {terms.supplier} Management</h2>
            <p className="text-sm text-muted-foreground">Manage {terms.supplier.toLowerCase()} assignments across branches</p>
          </div>
        </div>
        {buyerProfile && <BranchSupplierDashboard buyerId={buyerProfile.id} />}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pt-7 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={reviewPageTitleClass}>{terms.supplier} Discovery</h1>
          <p className={reviewPageSubtitleClass}>
            Find and connect with {terms.suppliers.toLowerCase()} for your organization
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="rounded-[10px]" onClick={() => setShowInviteModal(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Invite
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setCurrentView('branches')}>
                <Users className="h-4 w-4 mr-2" />
                Branch {terms.suppliers}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Integrated Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9CA3AF]" />
          <Input
            placeholder={`Search ${terms.suppliers.toLowerCase()}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`pl-10 ${reviewToolbarSelectTriggerClass}`}
          />
        </div>
        <SafeSelect
          value={selectedIndustry}
          onValueChange={handleIndustryChange}
          placeholder="All Industries"
          className={reviewToolbarSelectTriggerClass}
        >
          <SafeSelectItem value="all">All Industries</SafeSelectItem>
          {VALID_INDUSTRIES.map((industry) => (
            <SafeSelectItem key={industry} value={industry}>
              {industry}
            </SafeSelectItem>
          ))}
        </SafeSelect>
      </div>

      {/* Status tabs */}
      <div className="h-[56px] border-b border-[#E5E7EB] flex items-center gap-9">
        {[
          { value: 'connected' as const, label: `My ${terms.suppliers}`, count: suppliers.length, badgeClass: 'bg-[#EAF1FF] text-[#2563EB]' },
          { value: 'discover' as const, label: 'Discover', count: availableSuppliers.length, badgeClass: 'bg-[#F3F4F6] text-[#374151]' },
          { value: 'pending' as const, label: 'Pending', count: totalPendingCount, badgeClass: 'bg-[#FEF2F2] text-[#DC2626]' },
        ].map((tab) => {
          const isActive = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`relative h-full flex items-center gap-2 text-[14px] font-semibold transition-colors ${
                isActive ? 'text-[#2563EB]' : 'text-[#4B5563] hover:text-[#111827]'
              }`}
            >
              {tab.label}
              <span className={`h-[24px] min-w-[24px] rounded-full px-2 text-[13px] font-bold flex items-center justify-center ${tab.badgeClass}`}>
                {tab.count}
              </span>
              {isActive && <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#2563EB] rounded-full" />}
            </button>
          );
        })}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        {/* Connected Suppliers Tab */}
        <TabsContent value="connected" className="mt-6">
          {filteredSuppliers.length === 0 ? (
            <div className={reviewEmptyStateContainerClass}>
              <Building2 className="w-12 h-12 mx-auto mb-4 text-[#9CA3AF]" />
              <h3 className="font-medium text-[#111827] mb-1">No connected {terms.suppliers.toLowerCase()}</h3>
              <p className="text-sm text-[#6B7280] mb-4">
                Start by discovering and connecting with {terms.suppliers.toLowerCase()}
              </p>
              <Button variant="outline" size="sm" className="rounded-[10px]" onClick={() => setActiveTab('discover')}>
                Discover {terms.suppliers}
              </Button>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredSuppliers
                  .slice((connectedPage - 1) * connectedRowsPerPage, (connectedPage - 1) * connectedRowsPerPage + connectedRowsPerPage)
                  .map((supplier) => (
                    <CompactSupplierCard
                      key={supplier.id}
                      supplier={supplier}
                      onView={() => handleViewSupplier(supplier)}
                      onMessage={() => navigate(`/messages?supplier=${supplier.id}`)}
                    />
                  ))}
              </div>
              <div className="mt-4">
                <ReviewPagination
                  currentPage={Math.min(connectedPage, Math.max(1, Math.ceil(filteredSuppliers.length / connectedRowsPerPage)))}
                  totalPages={Math.max(1, Math.ceil(filteredSuppliers.length / connectedRowsPerPage))}
                  pageStart={(connectedPage - 1) * connectedRowsPerPage}
                  pageSize={connectedRowsPerPage}
                  totalCount={filteredSuppliers.length}
                  itemLabel={terms.suppliers.toLowerCase()}
                  onPageChange={setConnectedPage}
                  onPageSizeChange={setConnectedRowsPerPage}
                  pageSizeOptions={[6, 9, 18]}
                />
              </div>
            </>
          )}
        </TabsContent>

        {/* Discover Tab */}
        <TabsContent value="discover" className="mt-6">
          {filteredAvailableSuppliers.length === 0 ? (
            <div className={reviewEmptyStateContainerClass}>
              <Search className="w-12 h-12 mx-auto mb-4 text-[#9CA3AF]" />
              <h3 className="font-medium text-[#111827] mb-1">No {terms.suppliers.toLowerCase()} found</h3>
              <p className="text-sm text-[#6B7280]">
                {searchTerm || selectedIndustry !== 'all'
                  ? "Try adjusting your filters"
                  : `All available ${terms.suppliers.toLowerCase()} are already connected or pending`}
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredAvailableSuppliers
                  .slice((discoverPage - 1) * discoverRowsPerPage, (discoverPage - 1) * discoverRowsPerPage + discoverRowsPerPage)
                  .map((supplier) => (
                    <DiscoverSupplierCard
                      key={supplier.id}
                      supplier={supplier}
                      isPending={pendingRequests.has(supplier.id)}
                      onSendRequest={() => handleSendConnectionRequest(supplier)}
                      onResendRequest={() => handleResendRequest(supplier)}
                    />
                  ))}
              </div>
              <div className="mt-4">
                <ReviewPagination
                  currentPage={Math.min(discoverPage, Math.max(1, Math.ceil(filteredAvailableSuppliers.length / discoverRowsPerPage)))}
                  totalPages={Math.max(1, Math.ceil(filteredAvailableSuppliers.length / discoverRowsPerPage))}
                  pageStart={(discoverPage - 1) * discoverRowsPerPage}
                  pageSize={discoverRowsPerPage}
                  totalCount={filteredAvailableSuppliers.length}
                  itemLabel={terms.suppliers.toLowerCase()}
                  onPageChange={setDiscoverPage}
                  onPageSizeChange={setDiscoverRowsPerPage}
                  pageSizeOptions={[6, 9, 18]}
                />
              </div>
            </>
          )}
        </TabsContent>

        {/* Pending Tab */}
        <TabsContent value="pending" className="mt-6 space-y-6">
          {/* Incoming Requests */}
          {pendingIncomingCount > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Incoming Requests ({pendingIncomingCount})
              </h3>
              <div className="space-y-2">
                {incomingRequests.filter(r => r.status === 'pending' && r.supplier).map((request) => (
                  <div key={request.id} className={`${reviewCardContainerClass} p-4`}>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <CompanyLogo
                          logoUrl={request.supplier?.company_logo_url}
                          companyName={request.supplier?.company_name}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="text-[14px] font-semibold text-[#111827] truncate">{request.supplier.company_name}</p>
                          <p className="text-[13px] text-[#6B7280] flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(request.requested_at), 'MMM d, yyyy')}
                            {request.supplier.industry && (
                              <>
                                <span className="mx-1">•</span>
                                {request.supplier.industry}
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Button
                          size="icon"
                          className="h-[36px] w-[36px] bg-[#10B981] hover:bg-[#059669] text-white rounded-[10px] shadow-sm"
                          onClick={() => handleApproveClick(request)}
                          disabled={processingIds.has(request.id)}
                          title="Approve"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-[36px] w-[36px] bg-white text-[#DC2626] border-[#FCA5A5] hover:bg-[#FEF2F2] rounded-[10px] shadow-sm"
                          onClick={() => handleRejectConnection(request.id)}
                          disabled={processingIds.has(request.id)}
                          title="Reject"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Outgoing Requests */}
          {pendingOutgoingCount > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Outgoing Requests ({pendingOutgoingCount})
              </h3>
              <div className="space-y-2">
                {outgoingRequests.map((request) => (
                  <div key={request.id} className={`${reviewCardContainerClass} p-4`}>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
                          <Clock className="h-5 w-5 text-amber-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[14px] font-semibold text-[#111827] truncate">{request.supplier?.company_name}</p>
                          <p className="text-[13px] text-[#6B7280] flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Sent {format(new Date(request.requested_at), 'MMM d, yyyy')}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className={reviewActionButtonSecondaryClass}
                        onClick={() => handleResendRequest(request.supplier)}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Resend
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {totalPendingCount === 0 && (
            <div className={reviewEmptyStateContainerClass}>
              <Check className="w-12 h-12 mx-auto mb-4 text-emerald-500/60" />
              <h3 className="font-medium text-[#111827] mb-1">All caught up!</h3>
              <p className="text-sm text-[#6B7280]">
                No pending connection requests at this time
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modals */}
      {showInviteModal && buyerProfile && user && (
        <InviteSupplierModal
          buyerId={buyerProfile.id}
          buyerProfile={buyerProfile}
          userProfile={{ full_name: user.user_metadata?.full_name || user.email || '' }}
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
        />
      )}

      <SupplierProfileModal
        supplier={selectedSupplier}
        isOpen={showSupplierDetail}
        onClose={() => setShowSupplierDetail(false)}
        buyerId={buyerProfile?.id}
        allIndustries={VALID_INDUSTRIES}
        connectionStatus={selectedSupplier ? getConnectionStatus(selectedSupplier.id) : undefined}
        connectionDate={selectedSupplier ? getConnectionDate(selectedSupplier.id) : undefined}
      />

      <ConnectionApprovalModal
        isOpen={approvalModalOpen}
        onClose={() => {
          setApprovalModalOpen(false);
          setSelectedConnectionRequest(null);
        }}
        onConfirm={handleApprovalConfirm}
        supplierName={selectedConnectionRequest?.supplier?.company_name || ''}
        isLoading={selectedConnectionRequest ? processingIds.has(selectedConnectionRequest.id) : false}
      />
    </div>
  );
};

// Compact card for connected suppliers
const CompactSupplierCard = ({ supplier, onView, onMessage }: { supplier: any; onView: () => void; onMessage: () => void }) => (
  <div className={`${reviewCardContainerClass} p-4 hover:shadow-md transition-shadow group`}>
    <div className="flex items-start gap-3">
      <CompanyLogo
        logoUrl={supplier.company_logo_url}
        companyName={supplier.company_name}
        size="sm"
      />
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onView}>
        <h4 className="text-[14px] font-semibold text-[#111827] truncate group-hover:text-[#2563EB] transition-colors">
          {supplier.company_name}
        </h4>
        {supplier.industry && (
          <Badge variant="outline" className={`mt-1 text-[12px] px-2 py-0.5 rounded-full font-medium ${getIndustryBadgeClass(supplier.industry, VALID_INDUSTRIES)}`}>
            {supplier.industry}
          </Badge>
        )}
        <div className="mt-2 space-y-1 text-[13px] text-[#6B7280]">
          {supplier.contact_email && (
            <div className="flex items-center gap-1.5 truncate">
              <Mail className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{supplier.contact_email}</span>
            </div>
          )}
          {supplier.phone && (
            <div className="flex items-center gap-1.5">
              <Phone className="h-3 w-3 flex-shrink-0" />
              <span>{supplier.phone}</span>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={(e) => {
            e.stopPropagation();
            onMessage();
          }}
          title="Send Message"
        >
          <MessageSquare className="h-4 w-4 text-[#6B7280] hover:text-[#2563EB]" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onView}
          title="View Details"
        >
          <Eye className="h-4 w-4 text-[#6B7280]" />
        </Button>
      </div>
    </div>
  </div>
);

// Compact card for discoverable suppliers
const DiscoverSupplierCard = ({
  supplier,
  isPending,
  onSendRequest,
  onResendRequest
}: {
  supplier: any;
  isPending: boolean;
  onSendRequest: () => void;
  onResendRequest: () => void;
}) => (
  <div className={`${reviewCardContainerClass} p-4`}>
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0">
        <CompanyLogo
          logoUrl={supplier.company_logo_url}
          companyName={supplier.company_name}
          size="sm"
        />
        <div className="min-w-0">
          <h4 className="text-[14px] font-semibold text-[#111827] truncate">{supplier.company_name}</h4>
          {supplier.industry && (
            <Badge variant="outline" className={`mt-1 text-[12px] px-2 py-0.5 rounded-full font-medium ${getIndustryBadgeClass(supplier.industry, VALID_INDUSTRIES)}`}>
              {supplier.industry}
            </Badge>
          )}
        </div>
      </div>
      {isPending ? (
        <Button
          size="sm"
          variant="outline"
          className={`${reviewActionButtonSecondaryClass} flex-shrink-0`}
          onClick={(e) => { e.stopPropagation(); onResendRequest(); }}
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Resend
        </Button>
      ) : (
        <Button
          size="sm"
          className="rounded-[10px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white flex-shrink-0"
          onClick={(e) => { e.stopPropagation(); onSendRequest(); }}
        >
          <Send className="h-3.5 w-3.5 mr-1.5" />
          Connect
        </Button>
      )}
    </div>
  </div>
);

export default SupplierDiscovery;
