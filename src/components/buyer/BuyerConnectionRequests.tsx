import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock, Building2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

const BuyerConnectionRequests = () => {
  const [requests, setRequests] = useState<any[]>([]);
  const [buyerProfile, setBuyerProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchData();
      
      // Set up real-time subscription for connection request updates
      const channel = supabase
        .channel('buyer_connection_requests')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'buyer_supplier_connections'
          },
          (payload) => {
            console.log('New connection request received:', payload);
            fetchData(); // Refresh data when new request comes in
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'buyer_supplier_connections'
          },
          (payload) => {
            console.log('Connection request updated:', payload);
            fetchData(); // Refresh data when request is updated
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Fetching buyer data for user:', user?.id);
      
      // Get buyer profile
      const { data: buyer, error: buyerError } = await supabase
        .from('buyers')
        .select('*')
        .eq('profile_id', user?.id)
        .single();

      if (buyerError) {
        console.error('Error fetching buyer profile:', buyerError);
        setError('Failed to load buyer profile. Please try refreshing the page.');
        return;
      }

      console.log('Buyer profile:', buyer);
      setBuyerProfile(buyer);

      if (buyer) {
        // Fetch connection requests
        const { data: requestsData, error: requestsError } = await supabase
          .from('buyer_supplier_connections')
          .select('*')
          .eq('buyer_id', buyer.id)
          .order('requested_at', { ascending: false });

        if (requestsError) {
          console.error('Error fetching connection requests:', requestsError);
          setError('Failed to load connection requests. Please try refreshing the page.');
          return;
        }

        console.log('Connection requests:', requestsData);
        
        // Fetch supplier information for each request
        if (requestsData && requestsData.length > 0) {
          const requestsWithSupplierInfo = await Promise.all(
            requestsData.map(async (request) => {
              if (!request.supplier_id) {
                return {
                  ...request,
                  suppliers: null
                };
              }

              const { data: supplierData, error: supplierError } = await supabase
                .from('suppliers')
                .select('*')
                .eq('id', request.supplier_id)
                .single();

              if (supplierError) {
                console.error('Error fetching supplier data for request:', request.id, supplierError);
                return {
                  ...request,
                  suppliers: null
                };
              }

              return {
                ...request,
                suppliers: supplierData
              };
            })
          );

          console.log('Connection requests with supplier data:', requestsWithSupplierInfo);
          setRequests(requestsWithSupplierInfo);
        } else {
          setRequests([]);
        }
      }
    } catch (error) {
      console.error('Error in fetchData:', error);
      setError('An unexpected error occurred. Please try refreshing the page.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestResponse = async (requestId: string, status: 'approved' | 'rejected') => {
    try {
      console.log(`${status === 'approved' ? 'Approving' : 'Rejecting'} request:`, requestId);
      
      const { error } = await supabase
        .from('buyer_supplier_connections')
        .update({ 
          status,
          responded_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (error) throw error;

      // Find the request to get supplier information
      const request = requests.find(r => r.id === requestId);
      console.log('Request found for notification:', request);
      
      if (request?.suppliers?.profile_id) {
        console.log('Creating notification for supplier:', request.suppliers.profile_id);
        
        try {
          const { data: notificationId, error: notificationError } = await supabase.rpc('create_notification', {
            p_user_id: request.suppliers.profile_id,
            p_title: status === 'approved' ? 'Connection Approved' : 'Connection Rejected',
            p_message: `${buyerProfile.company_name} has ${status} your connection request.`,
            p_type: 'connection_response',
            p_reference_id: requestId
          });

          if (notificationError) {
            console.error('Error creating notification:', notificationError);
          } else {
            console.log('Notification created successfully:', notificationId);
          }
        } catch (notifError) {
          console.error('Failed to create notification:', notifError);
        }
      }

      toast({
        title: status === 'approved' ? "Request Approved" : "Request Rejected",
        description: `Connection request has been ${status}.`,
      });

      fetchData(); // Refresh data
    } catch (error: any) {
      console.error('Error responding to request:', error);
      toast({
        title: "Error",
        description: error.message || 'Failed to update connection request',
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-orange-500" />;
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-orange-100 text-orange-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading connection requests...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2 text-red-600">Error Loading Requests</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={fetchData} variant="outline">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!buyerProfile) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Buyer Profile Required</h3>
          <p className="text-gray-600">Please complete your buyer profile to receive connection requests.</p>
        </CardContent>
      </Card>
    );
  }

  if (requests.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Connection Requests</CardTitle>
        </CardHeader>
        <CardContent className="p-6 text-center">
          <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Connection Requests</h3>
          <p className="text-gray-600">You haven't received any connection requests yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Connection Requests 
            <div className="flex gap-2">
              {pendingCount > 0 && (
                <Badge variant="destructive">{pendingCount} Pending</Badge>
              )}
              <Badge variant="outline">{requests.length} Total</Badge>
            </div>
          </CardTitle>
        </CardHeader>
      </Card>
      
      {requests.map((request) => {
        const supplierInfo = request.suppliers;
        const companyName = supplierInfo?.company_name || 'Unknown Company';
        const industry = supplierInfo?.industry || 'Industry not specified';
        const description = supplierInfo?.description || 'No description provided';
        const contactEmail = supplierInfo?.contact_email || 'Email not provided';
        const phone = supplierInfo?.phone;
        const address = supplierInfo?.address;

        return (
          <Card key={request.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {getStatusIcon(request.status)}
                    {companyName}
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-1">{industry}</p>
                </div>
                <Badge className={getStatusColor(request.status)}>
                  {request.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {description && (
                  <div className="p-3 bg-gray-50 rounded text-sm">
                    <strong>About the Supplier:</strong> 
                    <p className="mt-1 text-gray-700">{description}</p>
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong>Contact Email:</strong> 
                    <p className="text-gray-600">{contactEmail}</p>
                  </div>
                  {phone && (
                    <div>
                      <strong>Phone:</strong> 
                      <p className="text-gray-600">{phone}</p>
                    </div>
                  )}
                  {address && (
                    <div className="md:col-span-2">
                      <strong>Address:</strong> 
                      <p className="text-gray-600">{address}</p>
                    </div>
                  )}
                </div>

                <div className="text-xs text-gray-400 border-t pt-3">
                  Requested {formatDistanceToNow(new Date(request.requested_at), { addSuffix: true })}
                  {request.responded_at && (
                    <span> • Responded {formatDistanceToNow(new Date(request.responded_at), { addSuffix: true })}</span>
                  )}
                </div>

                {request.notes && (
                  <div className="p-3 bg-blue-50 rounded text-sm">
                    <strong>Request Notes:</strong> 
                    <p className="mt-1 text-gray-700">{request.notes}</p>
                  </div>
                )}

                {request.status === 'pending' && (
                  <div className="flex gap-2 pt-2 border-t">
                    <Button
                      size="sm"
                      onClick={() => handleRequestResponse(request.id, 'approved')}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRequestResponse(request.id, 'rejected')}
                      className="border-red-600 text-red-600 hover:bg-red-50"
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default BuyerConnectionRequests;