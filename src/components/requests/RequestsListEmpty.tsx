
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Users, ArrowRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const RequestsListEmpty = () => {
  const [hasConnections, setHasConnections] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user, profile } = useAuth();

  useEffect(() => {
    const checkConnections = async () => {
      if (!user) return;

      try {
        // Check if user is a buyer and has connections
        const { data: buyer } = await supabase
          .from('buyers')
          .select('id')
          .eq('profile_id', user.id)
          .single();

        if (buyer) {
          const { data: connections } = await supabase
            .from('buyer_supplier_connections')
            .select('id')
            .eq('buyer_id', buyer.id)
            .eq('status', 'approved')
            .limit(1);

          setHasConnections(connections && connections.length > 0);
        }
      } catch (error) {
        console.error('Error checking connections:', error);
      } finally {
        setLoading(false);
      }
    };

    checkConnections();
  }, [user]);

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  const isBuyer = profile?.roles?.includes('buyer');
  const isSupplier = profile?.roles?.includes('supplier');

  if (isBuyer && !hasConnections) {
    return (
      <Card className="text-center py-12">
        <CardHeader>
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-blue-600" />
          </div>
          <CardTitle>Connect with Suppliers First</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-600 max-w-md mx-auto">
            Before you can request documents, you need to connect with suppliers. 
            Browse and connect with suppliers to start requesting compliance documents.
          </p>
          <Button className="flex items-center gap-2 mx-auto">
            <Users className="w-4 h-4" />
            Find Suppliers
            <ArrowRight className="w-4 h-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="text-center py-12">
      <CardHeader>
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <FileText className="w-8 h-8 text-gray-400" />
        </div>
        <CardTitle>
          {isBuyer ? 'No Document Requests Yet' : 'No Requests Received'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-gray-600 mb-6">
          {isBuyer 
            ? "You haven't created any document requests yet. Start by requesting compliance documents from your connected suppliers."
            : "You haven't received any document requests yet. Buyers will send you requests for compliance documents."
          }
        </p>
        {isBuyer && (
          <Button>Create Your First Request</Button>
        )}
      </CardContent>
    </Card>
  );
};

export default RequestsListEmpty;
