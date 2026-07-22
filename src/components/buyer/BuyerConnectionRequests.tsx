import { useState, useEffect } from 'react';
import logger from '@/utils/logger';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Building2, Calendar, Check, X, UserCheck } from 'lucide-react';
import { format } from 'date-fns';
import ConnectionApprovalModal, { OnboardingType } from './ConnectionApprovalModal';

interface ConnectionRequest {
  id: string;
  buyer_id: string;
  supplier_id: string;
  status: 'pending' | 'approved' | 'rejected';
  notes: string | null;
  requested_at: string;
  supplier: {
    company_name: string;
    industry: string;
    profile: {
      full_name: string;
    } | null;
  };
}

const BuyerConnectionRequests = () => {
  const [connectionRequests, setConnectionRequests] = useState<ConnectionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<ConnectionRequest | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchConnectionRequests = async () => {
    if (!user) return;

    try {
      // First get the buyer profile to get buyer_id
      const { data: buyer, error: buyerError } = await supabase
        .from('buyers')
        .select('id')
        .eq('profile_id', user.id)
        .single();

      if (buyerError || !buyer) {
        console.error('Error fetching buyer profile:', buyerError);
        return;
      }

      // Then fetch connection requests for this buyer
      const { data, error } = await supabase
        .from('buyer_supplier_connections')
        .select(`
          id,
          buyer_id,
          supplier_id,
          status,
          notes,
          requested_at,
          supplier:suppliers (
            company_name,
            industry,
            profile:profiles!suppliers_profile_id_fkey (
              full_name
            )
          )
        `)
        .eq('buyer_id', buyer.id)
        .eq('initiated_by', 'supplier')
        .order('requested_at', { ascending: false });

      if (error) {
        console.error('Error fetching connection requests:', error);
        return;
      }

      setConnectionRequests((data || []) as ConnectionRequest[]);
    } catch (error) {
      console.error('Error in fetchConnectionRequests:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnectionRequests();
  }, [user]);

  // Set up real-time subscription for new connection requests
  useEffect(() => {
    if (!user) return;

    const channelName = `buyer-connection-requests-${user.id}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'buyer_supplier_connections'
        },
        () => {
          fetchConnectionRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleApproveClick = (request: ConnectionRequest) => {
    setSelectedConnection(request);
    setApprovalModalOpen(true);
  };

  const handleApprovalConfirm = async (onboardingType: OnboardingType) => {
    if (!selectedConnection) return;

    const connectionId = selectedConnection.id;
    logger.debug(`Starting approval with onboarding type: ${onboardingType} for connection ID: ${connectionId}`);

    if (processingIds.has(connectionId)) {
      logger.debug(`Already processing connection ${connectionId}, ignoring duplicate request`);
      return;
    }

    setProcessingIds(prev => new Set(prev).add(connectionId));

    try {
      // Use the new approval with onboarding function
      const { data, error } = await (supabase.rpc as any)('approve_connection_with_onboarding', {
        p_connection_id: connectionId,
        p_onboarding_type: onboardingType,
        p_notes: null
      });

      if (error) {
        console.error('Error approving connection:', error);
        toast({
          title: "Error",
          description: "Failed to approve connection request",
          variant: "destructive",
        });
        return;
      }

      const result = data as { 
        success: boolean; 
        error?: string; 
        message?: string; 
        onboarding_request_id?: string 
      };

      if (!result?.success) {
        toast({
          title: "Error",
          description: result?.error || "Failed to process connection request",
          variant: "destructive",
        });
        return;
      }

      // Create notification for supplier
      await createSupplierNotification(connectionId, 'approved');

      // Show success message based on onboarding type
      let successMessage = 'Connection approved successfully';
      if (onboardingType === 'default') {
        successMessage = 'Connection approved and default onboarding initiated';
      } else if (onboardingType === 'custom') {
        successMessage = 'Connection approved. Redirecting to customize onboarding...';
      }

      toast({
        title: "Success",
        description: successMessage,
      });

      setApprovalModalOpen(false);
      setSelectedConnection(null);

      // If custom onboarding, navigate to the onboarding customization page
      if (onboardingType === 'custom' && result.onboarding_request_id) {
        // Navigate to onboarding pipeline with the new request highlighted
        navigate('/dashboard?tab=onboarding');
      }

      // Refresh the data
      await fetchConnectionRequests();

    } catch (error) {
      console.error('Unexpected error in handleApprovalConfirm:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
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

  const handleReject = async (connectionId: string) => {
    logger.debug(`Starting rejection for connection ID: ${connectionId}`);

    if (processingIds.has(connectionId)) {
      logger.debug(`Already processing connection ${connectionId}, ignoring duplicate request`);
      return;
    }

    setProcessingIds(prev => new Set(prev).add(connectionId));

    try {
      const { data, error } = await supabase.rpc('handle_unified_connection_approval', {
        p_connection_id: connectionId,
        p_action: 'rejected',
        p_notes: null
      });

      if (error) {
        console.error('Error rejecting connection:', error);
        toast({
          title: "Error",
          description: "Failed to reject connection request",
          variant: "destructive",
        });
        return;
      }

      const result = data as { success: boolean; error?: string };

      if (!result?.success) {
        toast({
          title: "Error",
          description: result?.error || "Failed to process connection request",
          variant: "destructive",
        });
        return;
      }

      await createSupplierNotification(connectionId, 'rejected');

      toast({
        title: "Success",
        description: "Connection request rejected",
      });

      await fetchConnectionRequests();

    } catch (error) {
      console.error('Unexpected error in handleReject:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
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

  const createSupplierNotification = async (connectionId: string, action: 'approved' | 'rejected') => {
    const connection = connectionRequests.find(req => req.id === connectionId);
    if (!connection) return;

    try {
      const { data: supplier, error: supplierError } = await supabase
        .from('suppliers')
        .select('profile_id')
        .eq('id', connection.supplier_id)
        .single();

      if (supplierError || !supplier) {
        console.error('Error fetching supplier profile:', supplierError);
        return;
      }

      await supabase.rpc('create_notification', {
        p_user_id: supplier.profile_id,
        p_title: `Connection Request ${action === 'approved' ? 'Approved' : 'Rejected'}`,
        p_message: `Your connection request has been ${action} by the buyer.`,
        p_type: 'connection_response',
        p_reference_id: connectionId
      });
    } catch (error) {
      console.error('Error creating notification:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">Pending</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-success/10 text-success border-success/20">Approved</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-danger/10 text-danger border-danger/20">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-muted rounded w-1/4 mb-2"></div>
              <div className="h-3 bg-muted rounded w-1/2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold mb-2">Connection Requests</h2>
          <p className="text-muted-foreground">
            Manage incoming connection requests from suppliers
          </p>
        </div>
        <div className="flex items-center gap-2">
          <UserCheck className="w-5 h-5" />
          <span className="text-sm text-muted-foreground">
            {connectionRequests.filter(req => req.status === 'pending').length} pending
          </span>
        </div>
      </div>

      {connectionRequests.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <UserCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Connection Requests</h3>
            <p className="text-muted-foreground">
              You haven't received any connection requests from suppliers yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {connectionRequests.map((request) => (
            <Card key={request.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <Building2 className="w-8 h-8 text-primary mt-1" />
                    <div>
                      <CardTitle className="text-lg">{request.supplier.company_name}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {request.supplier.industry} • Contact: {request.supplier.profile?.full_name || 'N/A'}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          Requested {format(new Date(request.requested_at), 'MMM d, yyyy')}
                        </span>
                        {getStatusBadge(request.status)}
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              {request.notes && (
                <CardContent className="pt-0 pb-3">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-sm"><strong>Message:</strong> {request.notes}</p>
                  </div>
                </CardContent>
              )}

              {request.status === 'pending' && (
                <CardContent className="pt-0">
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleApproveClick(request)}
                      className="flex items-center gap-2"
                      size="sm"
                      disabled={processingIds.has(request.id)}
                    >
                      <Check className="w-4 h-4" />
                      {processingIds.has(request.id) ? 'Processing...' : 'Approve'}
                    </Button>
                    <Button
                      onClick={() => handleReject(request.id)}
                      variant="outline"
                      className="flex items-center gap-2"
                      size="sm"
                      disabled={processingIds.has(request.id)}
                    >
                      <X className="w-4 h-4" />
                      {processingIds.has(request.id) ? 'Processing...' : 'Reject'}
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Approval Modal with Onboarding Options */}
      <ConnectionApprovalModal
        isOpen={approvalModalOpen}
        onClose={() => {
          setApprovalModalOpen(false);
          setSelectedConnection(null);
        }}
        onConfirm={handleApprovalConfirm}
        supplierName={selectedConnection?.supplier.company_name || ''}
        isLoading={selectedConnection ? processingIds.has(selectedConnection.id) : false}
      />
    </div>
  );
};

export default BuyerConnectionRequests;
