
import { useState, useEffect } from 'react';
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
  Calendar,
  AlertCircle,
  Eye,
  RefreshCw
} from 'lucide-react';
import { CompanyLogo } from '@/components/ui/CompanyLogo';
import DocumentUploadDialog from './DocumentUploadDialog';
import DocumentPreview from './DocumentPreview';
import CustomTemplateResponse from './CustomTemplateResponse';
import DocumentRenewalDialog from './DocumentRenewalDialog';
import { getDocumentExpiryStatus, ExpiryResult } from '@/utils/documentExpiry';
import SupplierEvidenceReusePanel from './SupplierEvidenceReusePanel';

interface DocumentRequestCardProps {
  request: any;
  onUploadSuccess: () => void;
}

const DocumentRequestCard = ({ request, onUploadSuccess }: DocumentRequestCardProps) => {
  const [showUpload, setShowUpload] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showTemplateResponse, setShowTemplateResponse] = useState(false);
  const [showRenewalUpload, setShowRenewalUpload] = useState(false);
  const [isHighlighted, setIsHighlighted] = useState(false);

  const isCustomTemplate = request.template_type === 'custom' && request.custom_template_id;

  // Helper to get the latest upload (sorted by created_at descending)
  const getLatestUpload = () => {
    if (!request.document_uploads?.length) return null;
    return [...request.document_uploads].sort(
      (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];
  };

  // Check if document is expiring or expired (for approved documents) using shared utility
  const getExpiryStatus = (): { status: 'expired' | 'expiring_soon'; days: number } | null => {
    if (request.status !== 'approved' || !request.document_uploads?.length) return null;
    
    const latestUpload = getLatestUpload();
    if (!latestUpload?.expiration_date) return null;
    
    // Only show renewal if latest approved upload is expiring
    if (latestUpload.status !== 'approved') return null;
    
    const result = getDocumentExpiryStatus(latestUpload.expiration_date);
    if (result && (result.status === 'expired' || result.status === 'expiring_soon')) {
      return { status: result.status, days: result.days };
    }
    return null;
  };

  const expiryStatus = getExpiryStatus();

  // Check for deep-link highlight
  useEffect(() => {
    const highlightId = sessionStorage.getItem('highlight_request_id');
    if (highlightId && highlightId === request.id) {
      setIsHighlighted(true);
      sessionStorage.removeItem('highlight_request_id');
      // Scroll into view
      setTimeout(() => {
        const element = document.getElementById(`request-card-${request.id}`);
        element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      // Remove highlight after animation
      setTimeout(() => setIsHighlighted(false), 3000);
    }
  }, [request.id]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-success/15 text-success';
      case 'pending': return 'bg-warning/15 text-warning';
      case 'submitted': return 'bg-primary/15 text-primary';
      case 'rejected': return 'bg-danger/15 text-danger';
      default: return 'bg-muted text-foreground';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-danger/15 text-danger border-danger/30';
      case 'high': return 'bg-warning/15 text-warning border-warning/30';
      case 'medium': return 'bg-warning/15 text-warning border-warning/30';
      case 'low': return 'bg-success/15 text-success border-success/30';
      default: return 'bg-muted text-foreground border-border';
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
      <Card 
        id={`request-card-${request.id}`}
        className={`transition-all duration-500 ${
          isHighlighted 
            ? 'ring-2 ring-primary ring-offset-2 bg-primary/5' 
            : ''
        }`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <FileCheck className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">{request.title}</CardTitle>
                {request.public_reference&&<p className="mt-0.5 font-mono text-xs text-muted-foreground">{request.public_reference}</p>}
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
                      <h4 className="font-semibold mb-3 text-foreground">Request Information</h4>
                      <div className="grid md:grid-cols-2 gap-4">
                       <div>
                         <p className="text-sm font-medium text-muted-foreground">Document Type</p>
                         <p className="text-sm capitalize">{request.document_type}</p>
                         {isCustomTemplate && (
                           <Badge variant="outline" className="mt-1 bg-secondary text-secondary-foreground border-border">
                             Custom Template
                           </Badge>
                         )}
                       </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Category</p>
                          <p className="text-sm capitalize">{request.category}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Priority</p>
                          <Badge className={getPriorityColor(request.priority || 'medium')} variant="outline">
                            {request.priority || 'medium'}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Status</p>
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
                        <h4 className="font-semibold mb-3 text-foreground">Description</h4>
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="text-sm text-foreground/80">{request.description}</p>
                        </div>
                      </div>
                    )}

                    {/* Buyer Information */}
                    {request.buyers && (
                      <div>
                        <h4 className="font-semibold mb-3 text-foreground">Requested By</h4>
                        <div className="flex items-center gap-3 p-3 border rounded-lg">
                          <CompanyLogo 
                            logoUrl={request.buyers.company_logo_url}
                            companyName={request.buyers.company_name}
                            size="md"
                          />
                          <div>
                            <p className="font-medium">{request.buyers.company_name}</p>
                            <p className="text-sm text-muted-foreground">{request.buyers.industry}</p>
                            <p className="text-sm text-muted-foreground">{request.buyers.contact_email}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Timeline */}
                    <div>
                      <h4 className="font-semibold mb-3 text-foreground">Timeline</h4>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">Created</p>
                            <p className="text-sm text-muted-foreground">
                              {formatDate(request.created_at)}
                            </p>
                          </div>
                        </div>
                        {request.due_date && (
                          <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-warning" />
                            <div>
                              <p className="text-sm font-medium">Due Date</p>
                              <p className="text-sm text-muted-foreground">
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
                        <h4 className="font-semibold mb-3 text-foreground">Additional Notes</h4>
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="text-sm text-foreground/80">{request.notes}</p>
                        </div>
                      </div>
                    )}

                    {/* Rejection Feedback - Show for rejected status */}
                    {request.status === 'rejected' && request.document_uploads && request.document_uploads.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-3 text-danger">Rejection Feedback</h4>
                        <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-danger mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-danger mb-1">Document was rejected</p>
                              {request.document_uploads[0]?.reviewer_notes ? (
                                <p className="text-sm text-danger">{request.document_uploads[0].reviewer_notes}</p>
                              ) : (
                                <p className="text-sm text-danger">No specific feedback provided. Please review and resubmit with corrections.</p>
                              )}
                              <p className="mt-2 text-xs text-danger">Reply to the correction email with the updated document, or use Resubmit below. Your previous version remains in the audit history.</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {request.document_uploads?.length>1&&<div><h4 className="mb-3 font-semibold text-foreground">Version history</h4><div className="space-y-2">{[...request.document_uploads].sort((a:any,b:any)=>Number(b.version||0)-Number(a.version||0)).map((upload:any)=><div key={upload.id} className="flex items-center justify-between rounded-md border p-2 text-sm"><span>Version {upload.version||1} · {upload.file_name}</span><Badge className={getStatusColor(upload.status)}>{upload.status}</Badge></div>)}</div></div>}
                  </div>
                </DialogContent>
              </Dialog>
              
              {/* Show preview button for submitted/approved documents */}
              {(request.status === 'submitted' || request.status === 'approved') && (
                <Button 
                  variant="outline"
                  size="sm" 
                  onClick={() => setShowPreview(true)}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Preview
                </Button>
              )}
              
              {/* Show upload button for pending documents only */}
              {request.status === 'pending' && !isCustomTemplate && (
                <Button 
                  size="sm" 
                  onClick={() => setShowUpload(true)}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload
                </Button>
              )}

              {/* Show template response button for custom template requests */}
              {(request.status === 'pending' || request.status === 'rejected') && isCustomTemplate && (
                <Button 
                  size="sm" 
                  onClick={() => setShowTemplateResponse(true)}
                  className="bg-primary hover:bg-primary/90"
                >
                  <FileCheck className="w-4 h-4 mr-2" />
                  {request.status === 'rejected' ? 'Resubmit Template' : 'Complete Template'}
                </Button>
              )}
              
              {/* Show resubmit button only for rejected standard documents */}
              {request.status === 'rejected' && !isCustomTemplate && (
                <Button 
                  size="sm" 
                  onClick={() => setShowUpload(true)}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Resubmit
                </Button>
              )}

              {/* Show renewal button for expiring/expired approved documents */}
              {expiryStatus && (
                <Button 
                  size="sm" 
                  onClick={() => setShowRenewalUpload(true)}
                  className={expiryStatus.status === 'expired' 
                    ? 'bg-danger hover:bg-danger/90 text-danger-foreground' 
                    : 'bg-warning hover:bg-warning/90 text-warning-foreground'
                  }
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  {expiryStatus.status === 'expired' 
                    ? `Renew (${expiryStatus.days}d overdue)` 
                    : `Renew (${expiryStatus.days}d left)`
                  }
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <SupplierEvidenceReusePanel
          request={request}
          onResolved={onUploadSuccess}
          onUploadNew={() => setShowUpload(true)}
        />
        
        <CardContent className="pt-0">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
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
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <CompanyLogo 
                  logoUrl={request.buyers.company_logo_url}
                  companyName={request.buyers.company_name}
                  size="sm"
                />
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

      <DocumentPreview
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        request={request}
      />

      <CustomTemplateResponse
        isOpen={showTemplateResponse}
        onClose={() => setShowTemplateResponse(false)}
        request={request}
        onSubmissionComplete={() => {
          setShowTemplateResponse(false);
          onUploadSuccess();
        }}
      />

      {expiryStatus && (
        <DocumentRenewalDialog
          isOpen={showRenewalUpload}
          onClose={() => setShowRenewalUpload(false)}
          request={request}
          expiryStatus={expiryStatus}
          onRenewalSuccess={() => {
            setShowRenewalUpload(false);
            onUploadSuccess();
          }}
        />
      )}
    </>
  );
};

export default DocumentRequestCard;
