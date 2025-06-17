
import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, FileText, AlertTriangle, CheckCircle, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import FileUploadZone from '@/components/uploads/FileUploadZone';

const RequestsList = () => {
  const [requests, setRequests] = useState<any[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const fetchRequests = async () => {
      const { data } = await supabase
        .from('document_requests')
        .select(`
          *,
          suppliers (company_name),
          profiles (full_name),
          document_uploads (*)
        `)
        .or(`requester_id.eq.${user.id},supplier_id.in.(select id from suppliers where profile_id = ${user.id})`)
        .order('created_at', { ascending: false });

      if (data) {
        setRequests(data);
      }
    };

    fetchRequests();

    // Set up real-time subscription
    const channel = supabase
      .channel('requests-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'document_requests'
        },
        () => {
          fetchRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-orange-500" />;
      case 'submitted':
        return <FileText className="w-4 h-4 text-blue-500" />;
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'rejected':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-orange-100 text-orange-800';
      case 'submitted':
        return 'bg-blue-100 text-blue-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-4">
      {requests.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No document requests found
        </div>
      ) : (
        requests.map((request) => (
          <Card key={request.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    {getStatusIcon(request.status)}
                    <h3 className="font-semibold">{request.title}</h3>
                    <Badge className={getStatusColor(request.status)}>
                      {request.status}
                    </Badge>
                    <Badge className={getPriorityColor(request.priority)}>
                      {request.priority}
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-2">{request.description}</p>
                  
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span>Type: {request.document_type}</span>
                    <span>Category: {request.category}</span>
                    {request.suppliers && (
                      <span>Supplier: {request.suppliers.company_name}</span>
                    )}
                    {request.due_date && (
                      <span>Due: {new Date(request.due_date).toLocaleDateString()}</span>
                    )}
                  </div>
                  
                  <div className="mt-2 text-xs text-gray-400">
                    Created {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {request.document_uploads && request.document_uploads.length > 0 && (
                    <Badge variant="outline">
                      {request.document_uploads.length} files
                    </Badge>
                  )}
                  
                  {request.status === 'pending' && request.supplier_id && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedRequest(
                        selectedRequest === request.id ? null : request.id
                      )}
                    >
                      <Upload className="w-4 h-4 mr-1" />
                      Upload
                    </Button>
                  )}
                </div>
              </div>
              
              {selectedRequest === request.id && (
                <div className="mt-4 pt-4 border-t">
                  <FileUploadZone requestId={request.id} />
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
};

export default RequestsList;
