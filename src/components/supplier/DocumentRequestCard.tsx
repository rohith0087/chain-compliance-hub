
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  FileCheck, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  Upload,
  Building2,
  User,
  Calendar,
  AlertCircle
} from 'lucide-react';
import DocumentUploadDialog from './DocumentUploadDialog';

interface DocumentRequestCardProps {
  request: any;
  onUploadSuccess: () => void;
}

const DocumentRequestCard = ({ request, onUploadSuccess }: DocumentRequestCardProps) => {
  const [showUpload, setShowUpload] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'submitted': return 'bg-blue-100 text-blue-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="w-4 h-4" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'submitted': return <FileCheck className="w-4 h-4" />;
      case 'rejected': return <AlertTriangle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'No due date';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <>
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileCheck className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-lg">{request.title}</CardTitle>
                <div className="flex items-center space-x-2 mt-1">
                  <Badge variant="outline" className={getPriorityColor(request.priority || 'medium')}>
                    {request.priority || 'medium'} priority
                  </Badge>
                  <Badge className={getStatusColor(request.status)} variant="secondary">
                    {getStatusIcon(request.status)}
                    <span className="ml-1 capitalize">{request.status}</span>
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    View Details
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <FileCheck className="w-5 h-5" />
                      {request.title}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-6">
                    {/* Request Information */}
                    <div>
                      <h4 className="font-semibold mb-3 text-gray-900">Request Information</h4>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium text-gray-500">Document Type</p>
                          <p className="text-sm capitalize">{request.document_type}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-500">Category</p>
                          <p className="text-sm capitalize">{request.category}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-500">Priority</p>
                          <Badge className={getPriorityColor(request.priority || 'medium')} variant="outline">
                            {request.priority || 'medium'}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-500">Status</p>
                          <Badge className={getStatusColor(request.status)} variant="secondary">
                            {getStatusIcon(request.status)}
                            <span className="ml-1 capitalize">{request.status}</span>
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    {request.description && (
                      <div>
                        <h4 className="font-semibold mb-3 text-gray-900">Description</h4>
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-700">{request.description}</p>
                        </div>
                      </div>
                    )}

                    {/* Buyer Information */}
                    {request.buyers && (
                      <div>
                        <h4 className="font-semibold mb-3 text-gray-900">Requested By</h4>
                        <div className="flex items-center gap-3 p-3 border rounded-lg">
                          <Building2 className="w-8 h-8 text-blue-500" />
                          <div>
                            <p className="font-medium">{request.buyers.company_name}</p>
                            <p className="text-sm text-gray-600">{request.buyers.industry}</p>
                            <p className="text-sm text-gray-500">{request.buyers.contact_email}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Timeline */}
                    <div>
                      <h4 className="font-semibold mb-3 text-gray-900">Timeline</h4>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-500" />
                          <div>
                            <p className="text-sm font-medium">Created</p>
                            <p className="text-sm text-gray-600">
                              {formatDate(request.created_at)}
                            </p>
                          </div>
                        </div>
                        {request.due_date && (
                          <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-orange-500" />
                            <div>
                              <p className="text-sm font-medium">Due Date</p>
                              <p className="text-sm text-gray-600">
                                {formatDate(request.due_date)}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Notes */}
                    {request.notes && (
                      <div>
                        <h4 className="font-semibold mb-3 text-gray-900">Additional Notes</h4>
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-700">{request.notes}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
              
              {request.status === 'pending' && (
                <Button 
                  size="sm" 
                  onClick={() => setShowUpload(true)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center space-x-4">
              <span>Type: {request.document_type}</span>
              <span>Category: {request.category}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4" />
              <span>Due: {formatDate(request.due_date)}</span>
            </div>
          </div>
          
          {request.buyers && (
            <div className="mt-3 pt-3 border-t">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Building2 className="w-4 h-4" />
                <span>Requested by: {request.buyers.company_name}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <DocumentUploadDialog
        isOpen={showUpload}
        onClose={() => setShowUpload(false)}
        request={request}
        onUploadSuccess={() => {
          setShowUpload(false);
          onUploadSuccess();
        }}
      />
    </>
  );
};

export default DocumentRequestCard;
