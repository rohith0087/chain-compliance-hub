import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, FileText, AlertTriangle, CheckCircle, Upload, Download, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import FileUploadZone from '@/components/uploads/FileUploadZone';
import RequestsListEmpty from './RequestsListEmpty';

type RequestStatus = 'pending' | 'submitted' | 'approved' | 'rejected' | 'expired';

const RequestsList = () => {
  const [requests, setRequests] = useState<any[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { user, profile } = useAuth();

  useEffect(() => {
    if (!user) return;

    const fetchRequests = async () => {
      try {
        // Determine the query based on user role
        const isSupplier = profile?.roles?.includes('supplier');
        const isBuyer = profile?.roles?.includes('buyer');
        
        let query = supabase
          .from('document_requests')
          .select(`
            *,
            suppliers (company_name, contact_email),
            profiles!document_requests_requester_id_fkey (full_name),
            document_uploads (*)
          `)
          .order('created_at', { ascending: false });

        // If user is only a supplier, show requests for their supplier profile
        if (isSupplier && !isBuyer) {
          const { data: supplierData } = await supabase
            .from('suppliers')
            .select('id')
            .eq('profile_id', user.id)
            .single();
          
          if (supplierData) {
            query = query.eq('supplier_id', supplierData.id);
          }
        } 
        // If user is only a buyer, show their created requests
        else if (isBuyer && !isSupplier) {
          query = query.eq('requester_id', user.id);
        }
        // If user has both roles, show all relevant requests
        else if (isBuyer && isSupplier) {
          const { data: supplierData } = await supabase
            .from('suppliers')
            .select('id')
            .eq('profile_id', user.id)
            .single();
          
          if (supplierData) {
            query = query.or(`requester_id.eq.${user.id},supplier_id.eq.${supplierData.id}`);
          } else {
            query = query.eq('requester_id', user.id);
          }
        }

        const { data, error } = await query;

        if (error) {
          console.error('Error fetching requests:', error);
        } else {
          setRequests(data || []);
        }
      } catch (error) {
        console.error('Error in fetchRequests:', error);
      } finally {
        setLoading(false);
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
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'document_uploads'
        },
        () => {
          fetchRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, profile]);

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

  const handleUpdateStatus = async (requestId: string, newStatus: RequestStatus) => {
    try {
      const { error } = await supabase
        .from('document_requests')
        .update({ status: newStatus })
        .eq('id', requestId);

      if (error) {
        console.error('Error updating status:', error);
      }
    } catch (error) {
      console.error('Error in handleUpdateStatus:', error);
    }
  };

  const downloadFile = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('compliance-documents')
        .download(filePath);

      if (error) {
        console.error('Error downloading file:', error);
        return;
      }

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error in downloadFile:', error);
    }
  };

  const isSupplier = profile?.roles?.includes('supplier');
  const isBuyer = profile?.roles?.includes('buyer');

  if (loading) {
    return <div className="text-center py-8">Loading requests...</div>;
  }

  if (requests.length === 0) {
    return <RequestsListEmpty />;
  }

  return (
    <div className="space-y-4">
      {requests.map((request) => {
        const hasUploads = request.document_uploads && request.document_uploads.length > 0;
        const canUpload = isSupplier && request.status === 'pending';
        const canReview = isBuyer && request.requester_id === user?.id && request.status === 'submitted';
        
        return (
          <Card key={request.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-4">
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
                  
                  <div className="flex items-center space-x-4 text-sm text-gray-500 mb-2">
                    <span>Type: {request.document_type}</span>
                    <span>Category: {request.category}</span>
                    {request.suppliers && (
                      <span>Supplier: {request.suppliers.company_name}</span>
                    )}
                    {request.profiles && (
                      <span>Requested by: {request.profiles.full_name}</span>
                    )}
                    {request.due_date && (
                      <span>Due: {new Date(request.due_date).toLocaleDateString()}</span>
                    )}
                  </div>
                  
                  <div className="text-xs text-gray-400">
                    Created {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {hasUploads && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {request.document_uploads.length} files
                    </Badge>
                  )}
                  
                  {canUpload && (
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
                  
                  {hasUploads && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedRequest(
                        selectedRequest === request.id ? null : request.id
                      )}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View Files
                    </Button>
                  )}
                  
                  {canReview && (
                    <div className="flex space-x-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-600 border-green-600 hover:bg-green-50"
                        onClick={() => handleUpdateStatus(request.id, 'approved')}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-600 hover:bg-red-50"
                        onClick={() => handleUpdateStatus(request.id, 'rejected')}
                      >
                        <AlertTriangle className="w-4 h-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              
              {selectedRequest === request.id && (
                <div className="mt-4 pt-4 border-t">
                  {canUpload ? (
                    <FileUploadZone 
                      requestId={request.id} 
                      onUploadComplete={() => {
                        // Update the request status to submitted after upload
                        handleUpdateStatus(request.id, 'submitted');
                        setSelectedRequest(null);
                      }}
                    />
                  ) : hasUploads ? (
                    <div className="space-y-2">
                      <h4 className="font-medium">Uploaded Documents:</h4>
                      {request.document_uploads.map((upload: any) => (
                        <div key={upload.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div className="flex items-center space-x-2">
                            <FileText className="w-4 h-4 text-gray-500" />
                            <span className="text-sm">{upload.file_name}</span>
                            <span className="text-xs text-gray-400">
                              ({(upload.file_size / 1024 / 1024).toFixed(2)} MB)
                            </span>
                            <Badge variant="outline" className={getStatusColor(upload.status || 'pending')}>
                              {upload.status || 'pending'}
                            </Badge>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => downloadFile(upload.file_path, upload.file_name)}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default RequestsList;
