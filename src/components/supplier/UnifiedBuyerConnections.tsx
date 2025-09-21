import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Building2, 
  AlertCircle,
  Users,
  Mail,
  Phone,
  MapPin
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ConnectWithBuyerModal } from './ConnectWithBuyerModal';
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
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchData();
      
      // Set up real-time subscription for connection changes
      const channel = supabase
        .channel('buyer_connections')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'buyer_supplier_connections'
          },
          (payload) => {
            console.log('Connection update received:', payload);
            fetchData(); // Refresh data when connections change
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
      console.log('Fetching connection data for user:', user?.id);
      
      // Get supplier profile
      const { data: supplier, error: supplierError } = await supabase
        .from('suppliers')
        .select('*')
        .eq('profile_id', user?.id)
        .maybeSingle();

      if (supplierError) {
        console.error('Error fetching supplier profile:', supplierError);
        setError('Failed to load supplier profile. Please try refreshing the page.');
        return;
      }

      if (!supplier) {
        console.log('No supplier profile found for user');
        setError('Supplier profile not found. Please complete your profile setup.');
        return;
      }

      console.log('Supplier profile:', supplier);
      setSupplierProfile(supplier);

      // Fetch all connection requests
      const { data: requestsData, error: requestsError } = await supabase
        .from('buyer_supplier_connections')
        .select('*')
        .eq('supplier_id', supplier.id)
        .order('requested_at', { ascending: false });

      if (requestsError) {
        console.error('Error fetching connection requests:', requestsError);
        setError('Failed to load connection requests. Please try refreshing the page.');
        return;
      }

      console.log('Connection requests:', requestsData);
      
      // Fetch buyer information for each request
      if (requestsData && requestsData.length > 0) {
        const requestsWithBuyerInfo = await Promise.all(
          requestsData.map(async (request) => {
            if (!request.buyer_id) {
              return {
                ...request,
                buyers: null
              };
            }

            const { data: buyerData, error: buyerError } = await supabase
              .from('buyers')
              .select('*')
              .eq('id', request.buyer_id)
              .maybeSingle();

            if (buyerError) {
              console.error('Error fetching buyer data for request:', request.id, buyerError);
              return {
                ...request,
                buyers: null
              };
            }

            return {
              ...request,
              buyers: buyerData
            };
          })
        );

        console.log('Connection requests with buyer data:', requestsWithBuyerInfo);
        
        // Separate pending requests and connected buyers
        const pendingRequests = requestsWithBuyerInfo.filter(req => req.status === 'pending');
        const connectedBuyersData = requestsWithBuyerInfo.filter(req => req.status === 'approved');
        
        setRequests(pendingRequests);
        setConnectedBuyers(connectedBuyersData);
      } else {
        setRequests([]);
        setConnectedBuyers([]);
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

      // Find the request to get buyer information for notification
      const request = requests.find(r => r.id === requestId);
      console.log('Request found for notification:', request);
      
      if (request?.buyers?.profile_id) {
        console.log('Creating notification for buyer:', request.buyers.profile_id);
        
        try {
          const { data: notificationId, error: notificationError } = await supabase.rpc('create_notification', {
            p_user_id: request.buyers.profile_id,
            p_title: status === 'approved' ? 'Connection Approved' : 'Connection Rejected',
            p_message: `${supplierProfile.company_name} has ${status} your connection request.`,
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

  const renderBuyerCard = (connection: any, showActions = false) => {
    const buyerInfo = connection.buyers;
    const companyName = buyerInfo?.company_name || 'Unknown Company';
    const industry = buyerInfo?.industry || 'Industry not specified';
    const contactEmail = buyerInfo?.contact_email || 'Email not provided';
    const phone = buyerInfo?.phone;
    const address = buyerInfo?.address;
    const connectedDate = connection.responded_at || connection.requested_at;

    return (
      <Card key={connection.id} className="hover:shadow-md transition-shadow">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-start space-x-4 flex-1">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Building2 className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  {getStatusIcon(connection.status)}
                  <h3 className="font-semibold text-lg text-gray-900">{companyName}</h3>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center text-sm text-gray-600">
                    <Users className="w-4 h-4 mr-2 text-gray-400" />
                    <span>{industry}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Mail className="w-4 h-4 mr-2 text-gray-400" />
                    <span className="truncate">{contactEmail}</span>
                  </div>
                  {phone && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Phone className="w-4 h-4 mr-2 text-gray-400" />
                      <span>{phone}</span>
                    </div>
                  )}
                  {connectedDate && (
                    <p className="text-xs text-gray-400">
                      {connection.status === 'pending' ? 'Requested' : 'Connected'}: {formatDistanceToNow(new Date(connectedDate), { addSuffix: true })}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4 flex-shrink-0">
              <Badge className={getStatusColor(connection.status)}>
                {connection.status === 'approved' ? 'Connected' : connection.status}
              </Badge>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    View Details
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Building2 className="w-5 h-5" />
                      {companyName}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-6">
                    {/* Company Information */}
                    <div>
                      <h4 className="font-semibold mb-3 text-gray-900">Company Information</h4>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-500" />
                          <div>
                            <p className="text-sm font-medium">Company Name</p>
                            <p className="text-sm text-gray-600">{companyName}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-gray-500" />
                          <div>
                            <p className="text-sm font-medium">Industry</p>
                            <p className="text-sm text-gray-600">{industry}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Contact Information */}
                    <div>
                      <h4 className="font-semibold mb-3 text-gray-900">Contact Information</h4>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-gray-500" />
                          <div>
                            <p className="text-sm font-medium">Email</p>
                            <p className="text-sm text-gray-600">{contactEmail}</p>
                          </div>
                        </div>
                        {phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-gray-500" />
                            <div>
                              <p className="text-sm font-medium">Phone</p>
                              <p className="text-sm text-gray-600">{phone}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Address */}
                    {address && (
                      <div>
                        <h4 className="font-semibold mb-3 text-gray-900">Address</h4>
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-gray-500 mt-0.5" />
                          <p className="text-sm text-gray-600">{address}</p>
                        </div>
                      </div>
                    )}

                    {/* Connection Details */}
                    <div>
                      <h4 className="font-semibold mb-3 text-gray-900">Connection Details</h4>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium">Status</p>
                          <Badge className={getStatusColor(connection.status)} variant="outline">
                            {connection.status === 'approved' ? 'Connected' : connection.status}
                          </Badge>
                        </div>
                        {connectedDate && (
                          <div>
                            <p className="text-sm font-medium">
                              {connection.status === 'pending' ? 'Requested Date' : 'Connected Date'}
                            </p>
                            <p className="text-sm text-gray-600">
                              {new Date(connectedDate).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Connection Notes */}
                    {connection.notes && (
                      <div>
                        <h4 className="font-semibold mb-3 text-gray-900">Connection Notes</h4>
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-700">{connection.notes}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Action buttons for pending requests */}
          {showActions && connection.status === 'pending' && (
            <div className="flex gap-2 pt-4 border-t mt-4">
              <Button
                size="sm"
                onClick={() => handleRequestResponse(connection.id, 'approved')}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                Approve Connection
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleRequestResponse(connection.id, 'rejected')}
                className="border-red-600 text-red-600 hover:bg-red-50"
              >
                <XCircle className="w-4 h-4 mr-1" />
                Reject
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading buyer connections...</p>
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
          <h3 className="text-lg font-semibold mb-2 text-red-600">Error Loading Connections</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={fetchData} variant="outline">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!supplierProfile) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Supplier Profile Required</h3>
          <p className="text-gray-600">Please complete your supplier profile to manage buyer connections.</p>
        </CardContent>
      </Card>
    );
  }

  const totalConnections = connectedBuyers.length + requests.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Buyer Connections</h2>
        <div className="flex items-center gap-4">
          <Badge variant="outline">{totalConnections} Total</Badge>
          <ConnectWithBuyerModal onConnectionRequest={onConnectionRequest || (() => {})} />
        </div>
      </div>

      <Tabs defaultValue="connected" className="space-y-6">
        <TabsList>
          <TabsTrigger value="connected">
            Connected Buyers 
            {connectedBuyers.length > 0 && <Badge variant="secondary" className="ml-2">{connectedBuyers.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="requests">
            Pending Requests 
            {requests.length > 0 && <Badge variant="secondary" className="ml-2">{requests.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="connected">
          {connectedBuyers.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Connected Buyers</h3>
                <p className="text-gray-500 mb-6">You haven't connected with any buyers yet.</p>
                <p className="text-sm text-gray-400">
                  Buyers will appear here once you approve their connection requests, or you can connect directly using a buyer ID.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {connectedBuyers.map((connection) => renderBuyerCard(connection, false))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="requests">
          {requests.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Pending Requests</h3>
                <p className="text-gray-500">You haven't received any connection requests yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg border border-blue-200">
                <strong>Approve or reject connection requests below.</strong> Approved connections will appear in the Connected Buyers tab.
              </div>
              {requests.map((connection) => renderBuyerCard(connection, true))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default UnifiedBuyerConnections;