
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

const ConnectionRequests = () => {
  const [requests, setRequests] = useState<any[]>([]);
  const [supplierProfile, setSupplierProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      // Get supplier profile
      const { data: supplier } = await supabase
        .from('suppliers')
        .select('*')
        .eq('profile_id', user?.id)
        .single();

      setSupplierProfile(supplier);

      if (supplier) {
        // Fetch connection requests
        const { data: requestsData } = await supabase
          .from('buyer_supplier_connections')
          .select(`
            *,
            buyers (
              company_name,
              contact_email,
              industry,
              phone,
              address
            )
          `)
          .eq('supplier_id', supplier.id)
          .order('requested_at', { ascending: false });

        if (requestsData) {
          setRequests(requestsData);
        }
      }
    } catch (error) {
      console.error('Error fetching connection requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestResponse = async (requestId: string, status: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('buyer_supplier_connections')
        .update({ 
          status,
          responded_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (error) throw error;

      // Create notification for buyer
      const request = requests.find(r => r.id === requestId);
      if (request?.buyers) {
        await supabase.rpc('create_notification', {
          p_user_id: request.buyer_id, // This should be the buyer's profile_id
          p_title: status === 'approved' ? 'Connection Approved' : 'Connection Rejected',
          p_message: `${supplierProfile.company_name} has ${status} your connection request.`,
          p_type: 'connection_response',
          p_reference_id: requestId
        });
      }

      toast({
        title: status === 'approved' ? "Request Approved" : "Request Rejected",
        description: `Connection request has been ${status}.`,
      });

      fetchData(); // Refresh data
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
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

  if (loading) {
    return <div className="text-center py-8">Loading connection requests...</div>;
  }

  if (!supplierProfile) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Supplier Profile Required</h3>
          <p className="text-gray-600">Please complete your supplier profile to receive connection requests.</p>
        </CardContent>
      </Card>
    );
  }

  if (requests.length === 0) {
    return (
      <Card>
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
      {requests.map((request) => (
        <Card key={request.id} className="hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  {getStatusIcon(request.status)}
                  {request.buyers?.company_name}
                </CardTitle>
                <p className="text-sm text-gray-600">{request.buyers?.industry}</p>
              </div>
              <Badge className={getStatusColor(request.status)}>
                {request.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>Contact Email:</strong> {request.buyers?.contact_email}
                </div>
                {request.buyers?.phone && (
                  <div>
                    <strong>Phone:</strong> {request.buyers.phone}
                  </div>
                )}
                {request.buyers?.address && (
                  <div className="md:col-span-2">
                    <strong>Address:</strong> {request.buyers.address}
                  </div>
                )}
              </div>

              <div className="text-xs text-gray-400">
                Requested {formatDistanceToNow(new Date(request.requested_at), { addSuffix: true })}
                {request.responded_at && (
                  <span> • Responded {formatDistanceToNow(new Date(request.responded_at), { addSuffix: true })}</span>
                )}
              </div>

              {request.notes && (
                <div className="p-3 bg-gray-50 rounded text-sm">
                  <strong>Notes:</strong> {request.notes}
                </div>
              )}

              {request.status === 'pending' && (
                <div className="flex gap-2 pt-2">
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
      ))}
    </div>
  );
};

export default ConnectionRequests;
