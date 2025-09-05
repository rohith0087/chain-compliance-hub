import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Building2, Calendar, Check, X, UserCheck } from 'lucide-react';
import { format } from 'date-fns';

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
  const { user } = useAuth();
  const { toast } = useToast();

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

    // Set up real-time subscription for new connection requests
    const channel = supabase
      .channel('buyer-connection-requests')
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

  const handleConnectionResponse = async (connectionId: string, action: 'approved' | 'rejected') => {
    console.log(`Starting ${action} action for connection ID: ${connectionId}`);
    
    // Prevent multiple clicks
    if (processingIds.has(connectionId)) {
      console.log(`Already processing connection ${connectionId}, ignoring duplicate request`);
      return;
    }

    setProcessingIds(prev => new Set(prev).add(connectionId));

    try {
      // Use the new unified connection approval function
      const { data, error } = await supabase.rpc('handle_unified_connection_approval', {
        p_connection_id: connectionId,
        p_action: action,
        p_notes: null
      });

      if (error) {
        console.error(`Error ${action === 'approved' ? 'approving' : 'rejecting'} connection:`, error);
        toast({
          title: "Error",
          description: `Failed to ${action === 'approved' ? 'approve' : 'reject'} connection request`,
          variant: "destructive",
        });
        return;
      }

      // Cast data to expected type since it's jsonb
      const result = data as { success: boolean; error?: string; message?: string; onboarding_request_id?: string };

      if (!result?.success) {
        toast({
          title: "Error",
          description: result?.error || "Failed to process connection request",
          variant: "destructive",
        });
        return;
      }

      const successMessage = action === 'approved' 
        ? 'Connection approved and onboarding request created' 
        : 'Connection request rejected';

      toast({
        title: "Success",
        description: successMessage,
      });

      // Get the connection details to create notification for supplier
      const connection = connectionRequests.find(req => req.id === connectionId);
      if (connection) {
        console.log(`Creating notification for supplier: ${connection.supplier_id}`);
        
        // Get supplier profile to send notification
        const { data: supplier, error: supplierError } = await supabase
          .from('suppliers')
          .select('profile_id')
          .eq('id', connection.supplier_id)
          .single();

        if (supplierError) {
          console.error('Error fetching supplier profile:', supplierError);
        } else if (supplier) {
          // Create notification for supplier
          const { error: notificationError } = await supabase.rpc('create_notification', {
            p_user_id: supplier.profile_id,
            p_title: `Connection Request ${action === 'approved' ? 'Approved' : 'Rejected'}`,
            p_message: `Your connection request has been ${action} by the buyer.`,
            p_type: 'connection_response',
            p_reference_id: connectionId
          });

          if (notificationError) {
            console.error('Error creating notification:', notificationError);
          } else {
            console.log('Notification created successfully');
          }
        }
      }

      toast({
        title: "Success",
        description: `Connection request ${action} successfully`,
      });

      // Refresh the data to confirm changes
      console.log('Refreshing connection requests data');
      await fetchConnectionRequests();

    } catch (error) {
      console.error('Unexpected error in handleConnectionResponse:', error);
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Pending</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Approved</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Rejected</Badge>;
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
                      onClick={() => handleConnectionResponse(request.id, 'approved')}
                      className="flex items-center gap-2"
                      size="sm"
                      disabled={processingIds.has(request.id)}
                    >
                      <Check className="w-4 h-4" />
                      {processingIds.has(request.id) ? 'Processing...' : 'Approve'}
                    </Button>
                    <Button
                      onClick={() => handleConnectionResponse(request.id, 'rejected')}
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
    </div>
  );
};

export default BuyerConnectionRequests;