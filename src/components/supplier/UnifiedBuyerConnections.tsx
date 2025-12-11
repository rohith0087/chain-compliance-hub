import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CheckCircle, XCircle, Clock, Building2, AlertCircle, Users, Mail, Phone, MapPin, Send, RefreshCw, Upload
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { ConnectWithBuyerModal } from './ConnectWithBuyerModal';
import { OnboardingProcess } from './OnboardingProcess';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface UnifiedBuyerConnectionsProps {
  onConnectionRequest?: () => void;
}

const UnifiedBuyerConnections = ({ onConnectionRequest }: UnifiedBuyerConnectionsProps) => {
  const [requests, setRequests] = useState<any[]>([]);
  const [connectedBuyers, setConnectedBuyers] = useState<any[]>([]);
  const [supplierProfile, setSupplierProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<'all' | 'active_onboarding' | 'connected_only'>('all');
  const [selectedOnboardingRequest, setSelectedOnboardingRequest] = useState<any>(null);
  const [showOnboardingProcess, setShowOnboardingProcess] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchData();
      const channel = supabase.channel('buyer_connections').on('postgres_changes', { event: '*', schema: 'public', table: 'buyer_supplier_connections' }, () => fetchData()).subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Step 1: Check if user is a team member first (company ID resolution pattern)
      const { data: teamMember } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('profile_id', user?.id)
        .eq('company_type', 'supplier')
        .eq('status', 'active')
        .maybeSingle();

      let supplier: any = null;
      let supplierId: string;

      if (teamMember) {
        // Team member path - use company_id to fetch supplier profile
        const { data: supplierData, error: supplierError } = await supabase
          .from('suppliers')
          .select('*')
          .eq('id', teamMember.company_id)
          .single();
        
        if (supplierError || !supplierData) {
          setError('Failed to load supplier profile.');
          return;
        }
        supplier = supplierData;
        supplierId = teamMember.company_id;
      } else {
        // Company owner path
        const { data: supplierData, error: supplierError } = await supabase
          .from('suppliers')
          .select('*')
          .eq('profile_id', user?.id)
          .maybeSingle();
        
        if (supplierError || !supplierData) {
          setError('Failed to load supplier profile.');
          return;
        }
        supplier = supplierData;
        supplierId = supplierData.id;
      }

      setSupplierProfile(supplier);

      const { data: requestsData, error: requestsError } = await supabase
        .from('buyer_supplier_connections')
        .select(`*, buyers:buyer_id (*), supplier_onboarding_requests:onboarding_request_id (*)`)
        .eq('supplier_id', supplierId)
        .order('requested_at', { ascending: false });
      
      if (requestsError) { setError('Failed to load connection requests.'); return; }

      setRequests(requestsData?.filter((req: any) => req.status === 'pending' && req.initiated_by === 'buyer') || []);
      setConnectedBuyers(requestsData?.filter((req: any) => req.status === 'approved') || []);
    } catch (error) {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const getConnectionDisplayStatus = (connection: any) => {
    const onboardingRequest = connection.supplier_onboarding_requests;
    if (connection.status === 'pending') return connection.initiated_by === 'supplier' ? { status: 'requested', label: 'Connection Requested', color: 'bg-purple-100 text-purple-800', icon: <Clock className="w-4 h-4 text-purple-500" />, action: 'awaiting_buyer' } : { status: 'pending_approval', label: 'Pending Your Approval', color: 'bg-orange-100 text-orange-800', icon: <AlertCircle className="w-4 h-4 text-orange-500" />, action: 'approve_reject' };
    if (connection.status === 'rejected') return { status: 'rejected', label: 'Connection Rejected', color: 'bg-red-100 text-red-800', icon: <XCircle className="w-4 h-4 text-red-500" />, action: 'none' };
    if (connection.status === 'approved') {
      if (!onboardingRequest) return { status: 'connected_no_onboarding', label: 'Connected - No Onboarding', color: 'bg-gray-100 text-gray-800', icon: <CheckCircle className="w-4 h-4 text-gray-500" />, action: 'request_onboarding', description: 'Buyer has not initiated onboarding process yet' };
      const statusMap: any = { requested: { status: 'onboarding_requested', label: 'Onboarding Requested', color: 'bg-purple-100 text-purple-800', icon: <Clock className="w-4 h-4 text-purple-500" />, action: 'awaiting_buyer', description: 'Waiting for buyer to approve' }, pending: { status: 'onboarding_pending', label: 'Onboarding Pending', color: 'bg-amber-100 text-amber-800', icon: <AlertCircle className="w-4 h-4 text-amber-500" />, action: 'start_onboarding', description: onboardingRequest.rejection_reason ? `Changes requested: ${onboardingRequest.rejection_reason}` : 'Ready to start onboarding' }, onboarding_initiated: { status: 'onboarding_in_progress', label: 'Onboarding In Progress', color: 'bg-blue-100 text-blue-800', icon: <Clock className="w-4 h-4 text-blue-500" />, action: 'continue_onboarding', description: 'Complete remaining steps' }, under_review: { status: 'under_review', label: 'Under Review', color: 'bg-yellow-100 text-yellow-800', icon: <Clock className="w-4 h-4 text-yellow-500" />, action: 'awaiting_buyer', description: 'Buyer is reviewing' }, approved: { status: 'fully_connected', label: 'Fully Connected', color: 'bg-green-100 text-green-800', icon: <CheckCircle className="w-4 h-4 text-green-500" />, action: 'none', description: 'Onboarding complete' } };
      return statusMap[onboardingRequest.status] || { status: 'unknown', label: 'Status Unknown', color: 'bg-gray-100 text-gray-800', icon: <AlertCircle className="w-4 h-4 text-gray-500" />, action: 'none' };
    }
    return { status: 'unknown', label: 'Unknown Status', color: 'bg-gray-100 text-gray-800', icon: <AlertCircle className="w-4 h-4 text-gray-500" />, action: 'none' };
  };

  const handleRequestOnboarding = async (connection: any) => {
    try {
      const { data: buyerProfileData } = await supabase.from('buyers').select('profile_id').eq('id', connection.buyer_id).single();
      if (buyerProfileData?.profile_id) {
        await supabase.from('notifications').insert({ user_id: buyerProfileData.profile_id, title: 'Onboarding Request from Supplier', message: `${supplierProfile.company_name} is requesting onboarding.`, type: 'onboarding_request', reference_id: connection.id });
        toast({ title: "Request Sent", description: `Onboarding request sent to ${connection.buyers.company_name}` });
        fetchData();
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to send request", variant: "destructive" });
    }
  };

  const handleRequestResponse = async (connectionId: string, response: 'approved' | 'rejected') => {
    try {
      await supabase.from('buyer_supplier_connections').update({ status: response, responded_at: new Date().toISOString() }).eq('id', connectionId);
      toast({ title: response === 'approved' ? 'Approved' : 'Rejected', description: `Connection ${response}` });
      fetchData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update', variant: 'destructive' });
    }
  };

  const renderBuyerCard = (connection: any, showActions = false) => {
    const buyerInfo = connection.buyers;
    const displayStatus = getConnectionDisplayStatus(connection);
    const onboardingRequest = connection.supplier_onboarding_requests;
    return (
      <Card key={connection.id} className="hover:shadow-md transition-shadow">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-start space-x-4 flex-1">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center"><Building2 className="w-6 h-6 text-blue-600" /></div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">{displayStatus.icon}<h3 className="font-semibold text-lg">{buyerInfo?.company_name}</h3></div>
                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex items-center"><Users className="w-4 h-4 mr-2" /><span>{buyerInfo?.industry}</span></div>
                  <div className="flex items-center"><Mail className="w-4 h-4 mr-2" /><span>{buyerInfo?.contact_email}</span></div>
                  {displayStatus.description && <p className="text-xs text-gray-500 italic">{displayStatus.description}</p>}
                </div>
              </div>
            </div>
            <Badge className={displayStatus.color}>{displayStatus.label}</Badge>
          </div>
          {showActions && displayStatus.action === 'approve_reject' && (
            <div className="mt-4 flex gap-2">
              <Button size="sm" onClick={() => handleRequestResponse(connection.id, 'approved')} className="flex-1"><CheckCircle className="w-4 h-4 mr-2" />Approve</Button>
              <Button size="sm" variant="outline" onClick={() => handleRequestResponse(connection.id, 'rejected')} className="flex-1"><XCircle className="w-4 h-4 mr-2" />Reject</Button>
            </div>
          )}
          {displayStatus.action === 'request_onboarding' && (
            <div className="mt-4"><Button size="sm" variant="outline" onClick={() => handleRequestOnboarding(connection)} className="w-full"><Send className="w-4 h-4 mr-2" />Request Onboarding</Button></div>
          )}
          
          {displayStatus.action === 'start_onboarding' && onboardingRequest && (
            <div className="mt-4">
              <Button 
                size="sm" 
                onClick={() => {
                  setSelectedOnboardingRequest(onboardingRequest);
                  setShowOnboardingProcess(true);
                }} 
                className="w-full"
              >
                <Upload className="w-4 h-4 mr-2" />
                Start Onboarding
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const filteredConnectedBuyers = connectedBuyers.filter(c => {
    const s = getConnectionDisplayStatus(c);
    return filterTab === 'active_onboarding' ? ['onboarding_pending', 'onboarding_in_progress', 'under_review', 'onboarding_requested'].includes(s.status) : filterTab === 'connected_only' ? ['connected_no_onboarding', 'fully_connected'].includes(s.status) : true;
  });

  if (loading) return <Card><CardContent className="py-12 text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div><p>Loading...</p></CardContent></Card>;
  if (error) return <Card><CardContent className="py-12 text-center"><AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" /><p className="text-red-600 mb-2">{error}</p><Button onClick={fetchData} variant="outline" size="sm"><RefreshCw className="w-4 h-4 mr-2" />Try Again</Button></CardContent></Card>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold">Buyer Connections</h2>
          <p className="text-muted-foreground mt-1">Manage your connections</p>
        </div>
        <div className="shrink-0">
          <ConnectWithBuyerModal onConnectionRequest={onConnectionRequest} />
        </div>
      </div>
      <Tabs defaultValue="connected" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="connected">Connected Buyers ({connectedBuyers.length})</TabsTrigger>
          <TabsTrigger value="pending">Pending Requests ({requests.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="connected" className="space-y-4">
          <div className="flex gap-2 border-b pb-2">
            <Button variant={filterTab === 'all' ? 'default' : 'ghost'} size="sm" onClick={() => setFilterTab('all')}>All ({connectedBuyers.length})</Button>
            <Button variant={filterTab === 'active_onboarding' ? 'default' : 'ghost'} size="sm" onClick={() => setFilterTab('active_onboarding')}>Active Onboarding ({connectedBuyers.filter(c => ['onboarding_pending', 'onboarding_in_progress', 'under_review', 'onboarding_requested'].includes(getConnectionDisplayStatus(c).status)).length})</Button>
            <Button variant={filterTab === 'connected_only' ? 'default' : 'ghost'} size="sm" onClick={() => setFilterTab('connected_only')}>Connected Only ({connectedBuyers.filter(c => ['connected_no_onboarding', 'fully_connected'].includes(getConnectionDisplayStatus(c).status)).length})</Button>
          </div>
          {filteredConnectedBuyers.length > 0 ? <div className="space-y-4">{filteredConnectedBuyers.map(c => renderBuyerCard(c, false))}</div> : <Card><CardContent className="py-12 text-center"><Users className="w-12 h-12 text-gray-400 mb-4 mx-auto" /><p className="text-gray-600">No buyers found</p></CardContent></Card>}
        </TabsContent>
        <TabsContent value="pending" className="space-y-4">
          {requests.length > 0 ? <div className="space-y-4">{requests.map(c => renderBuyerCard(c, true))}</div> : <Card><CardContent className="py-12 text-center"><Clock className="w-12 h-12 text-gray-400 mb-4 mx-auto" /><p className="text-gray-600">No pending requests</p></CardContent></Card>}
        </TabsContent>
      </Tabs>

      {/* Onboarding Process Dialog */}
      {showOnboardingProcess && selectedOnboardingRequest && (
        <Dialog open={showOnboardingProcess} onOpenChange={setShowOnboardingProcess}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Onboarding Process</DialogTitle>
              <DialogDescription>
                Complete the onboarding requirements for this buyer
              </DialogDescription>
            </DialogHeader>
            <OnboardingProcess
              request={selectedOnboardingRequest}
              onComplete={() => {
                setShowOnboardingProcess(false);
                fetchData();
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default UnifiedBuyerConnections;
