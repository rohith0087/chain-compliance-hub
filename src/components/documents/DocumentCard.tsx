import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Calendar, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Download,
  Eye,
  Upload,
  ThumbsUp,
  ThumbsDown,
  Link,
  MapPin,
  RefreshCw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ITEM_CATEGORIES } from '@/hooks/useSupplierItems';
import DocumentVersionHistory from './DocumentVersionHistory';
import DocumentRenewalDialog from '@/components/supplier/DocumentRenewalDialog';
import { getDocumentExpiryStatus, isExpired, isExpiringSoon } from '@/utils/documentExpiry';

interface DocumentUpload {
  id: string;
  file_name: string;
  file_path: string;
  file_size?: number;
  status: string;
  created_at: string;
  expiration_date?: string;
  reviewer_notes?: string;
  version?: number;
  uploader?: {
    full_name: string;
  };
}

interface DocumentCardProps {
  document: {
    id: string;
    title?: string;
    document_type: string;
    category: string;
    status: string;
    created_at: string;
    due_date?: string;
    expiration_date?: string;
    file_name?: string;
    file_size?: number;
    linked_item_ids?: string[];
    supplier_id?: string;
    document_uploads?: DocumentUpload[];
    branch?: {
      id: string;
      branch_name: string;
      location?: string;
      address?: string;
    };
    uploader?: {
      full_name: string;
    };
    supplier?: {
      company_name: string;
    };
    buyer?: {
      company_name: string;
    };
  };
  onView?: () => void;
  onDownload?: () => void;
  onUpload?: () => void;
  onApprove?: () => void;
  onDecline?: () => void;
  onCreateLink?: () => void;
  onRenewalSuccess?: () => void;
  showActions?: boolean;
  userRole?: 'buyer' | 'supplier';
  approveLoading?: boolean;
  declineLoading?: boolean;
  downloadLoading?: boolean;
  isHighlighted?: boolean;
}

const DocumentCard = ({ 
  document, 
  onView, 
  onDownload, 
  onUpload, 
  onApprove,
  onDecline,
  onCreateLink,
  onRenewalSuccess,
  showActions = true,
  userRole = 'supplier',
  approveLoading = false,
  declineLoading = false,
  downloadLoading = false,
  isHighlighted = false
}: DocumentCardProps) => {
  const [showRenewalDialog, setShowRenewalDialog] = useState(false);
  const [linkedItems, setLinkedItems] = useState<any[]>([]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'submitted': return 'bg-blue-100 text-blue-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'expired': return 'bg-muted text-foreground';
      default: return 'bg-muted text-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="w-4 h-4" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'submitted': return <FileText className="w-4 h-4" />;
      case 'rejected': return <AlertTriangle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  // Get expiry status for approved documents
  const getExpiryStatusForRenewal = () => {
    if (document.status !== 'approved') return null;
    
    // Check latest upload's expiration date first
    const latestUpload = document.document_uploads?.[0];
    const expirationDate = latestUpload?.expiration_date || document.expiration_date;
    
    if (!expirationDate) return null;
    
    const result = getDocumentExpiryStatus(expirationDate);
    if (result && (result.status === 'expired' || result.status === 'expiring_soon')) {
      return result;
    }
    return null;
  };

  const expiryStatus = getExpiryStatusForRenewal();
  const canRenew = userRole === 'supplier' && expiryStatus !== null;

  useEffect(() => {
    if (document.linked_item_ids && document.linked_item_ids.length > 0) {
      fetchLinkedItems();
    }
  }, [document.linked_item_ids]);

  const fetchLinkedItems = async () => {
    const { data, error } = await supabase
      .from('supplier_items')
      .select('id, item_name, item_category')
      .in('id', document.linked_item_ids || []);
    
    if (!error && data) {
      setLinkedItems(data);
    }
  };

  const getCategoryIcon = (category: string) => {
    const categoryItem = ITEM_CATEGORIES.find(c => c.value === category);
    return categoryItem?.icon || '📋';
  };

  // Show approve/decline buttons for buyers when document is submitted and has a file
  // Also show for custom template documents (file is in template_submissions)
  const canApproveOrDecline = userRole === 'buyer' && 
    document.status === 'submitted' && 
    (document.file_name || (document as any).template_type === 'custom' || (document as any).has_template_submission);

  // Show create link button for buyers when document is approved
  const canCreateLink = userRole === 'buyer' && 
    document.status === 'approved' && 
    (document.file_name || (document as any).template_type === 'custom' || (document as any).has_template_submission) && 
    onCreateLink;

  return (
    <>
      <Card className={`hover:shadow-md transition-shadow ${isHighlighted ? 'ring-2 ring-primary ring-offset-2 bg-primary/5 animate-pulse' : ''}`} id={`doc-card-${document.id}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-lg">{document.title || document.document_type}</CardTitle>
                <div className="flex items-center space-x-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {document.document_type}
                  </Badge>
                <Badge variant="outline" className="text-xs">
                  {document.category}
                </Badge>
                <Badge className={getStatusColor(document.status)} variant="secondary">
                  {getStatusIcon(document.status)}
                  <span className="ml-1 capitalize">{document.status}</span>
                </Badge>
                {document.branch && (
                  <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800">
                    <MapPin className="w-3 h-3 mr-1" />
                    {document.branch.branch_name}
                  </Badge>
                )}
                </div>
              </div>
            </div>
            {showActions && (
              <div className="flex items-center space-x-2">
                {onView && (
                  <Button variant="outline" size="sm" onClick={onView}>
                    <Eye className="w-4 h-4 mr-2" />
                    View
                  </Button>
                )}
                {onDownload && document.file_name && (
                  <Button variant="outline" size="sm" onClick={onDownload} disabled={downloadLoading}>
                    {downloadLoading ? (
                      <>
                        <Clock className="w-4 h-4 mr-2 animate-spin" />
                        Downloading...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </>
                    )}
                  </Button>
                )}
                {onUpload && document.status === 'pending' && userRole === 'supplier' && (
                  <Button size="sm" onClick={onUpload}>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload
                  </Button>
                )}
                {canApproveOrDecline && onApprove && onDecline && (
                  <>
                    <Button 
                      size="sm" 
                      variant="default" 
                      className="bg-green-600 hover:bg-green-700"
                      onClick={onApprove}
                      disabled={approveLoading || declineLoading}
                    >
                      {approveLoading ? (
                        <>
                          <Clock className="w-4 h-4 mr-2 animate-spin" />
                          Approving...
                        </>
                      ) : (
                        <>
                          <ThumbsUp className="w-4 h-4 mr-2" />
                          Approve
                        </>
                      )}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="border-red-300 text-red-600 hover:bg-red-50"
                      onClick={onDecline}
                      disabled={approveLoading || declineLoading}
                    >
                      {declineLoading ? (
                        <>
                          <Clock className="w-4 h-4 mr-2 animate-spin" />
                          Declining...
                        </>
                      ) : (
                        <>
                          <ThumbsDown className="w-4 h-4 mr-2" />
                          Decline
                        </>
                      )}
                    </Button>
                  </>
                )}
                {canCreateLink && (
                  <Button size="sm" variant="outline" onClick={onCreateLink}>
                    <Link className="w-4 h-4 mr-2" />
                    Create Link
                  </Button>
                )}
                {/* Renewal button for expiring/expired approved documents */}
                {canRenew && expiryStatus && (
                  <Button 
                    size="sm" 
                    onClick={() => setShowRenewalDialog(true)}
                    className={expiryStatus.status === 'expired' 
                      ? 'bg-red-600 hover:bg-red-700' 
                      : 'bg-amber-600 hover:bg-amber-700'
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
            )}
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          <div className="space-y-3">
            {/* Linked Items */}
            {linkedItems.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap mb-3">
                <span className="text-xs text-muted-foreground">Applies to:</span>
                {linkedItems.map(item => (
                  <Badge
                    key={item.id}
                    variant="outline"
                    className="text-xs cursor-default"
                  >
                    {getCategoryIcon(item.item_category)} {item.item_name}
                  </Badge>
                ))}
              </div>
            )}

            {/* File Information */}
            {document.file_name && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">File: {document.file_name}</span>
                <div className="flex items-center gap-2">
                  {document.file_size && (
                    <span className="text-muted-foreground">{formatFileSize(document.file_size)}</span>
                  )}
                  {/* Version History Button */}
                  {document.document_uploads && document.document_uploads.length > 1 && (
                    <DocumentVersionHistory
                      documentTitle={document.title || document.document_type}
                      uploads={document.document_uploads}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Created</p>
                <p className="text-foreground">{formatDate(document.created_at)}</p>
              </div>
              {document.due_date && (
                <div>
                  <p className="text-muted-foreground">Due Date</p>
                  <p className="text-foreground">{formatDate(document.due_date)}</p>
                </div>
              )}
            </div>

            {/* Expiration Date (for suppliers) */}
            {document.expiration_date && userRole === 'supplier' && (
              <div className="p-3 rounded-lg border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Expires:</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm">{formatDate(document.expiration_date)}</span>
                    {isExpired(document.expiration_date) && (
                      <Badge variant="destructive" className="text-xs">
                        Expired
                      </Badge>
                    )}
                    {isExpiringSoon(document.expiration_date) && !isExpired(document.expiration_date) && (
                      <Badge variant="outline" className="text-xs bg-orange-100 text-orange-800">
                        Expires Soon
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Expiration Date (for buyers) */}
            {document.expiration_date && userRole === 'buyer' && (
              <div className="p-3 rounded-lg border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Document Expires:</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm">{formatDate(document.expiration_date)}</span>
                    {isExpired(document.expiration_date) && (
                      <Badge variant="destructive" className="text-xs">
                        Expired
                      </Badge>
                    )}
                    {isExpiringSoon(document.expiration_date) && !isExpired(document.expiration_date) && (
                      <Badge variant="outline" className="text-xs bg-orange-100 text-orange-800">
                        Expires Soon
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Company Information */}
            <div className="pt-3 border-t">
              <div className="text-sm text-muted-foreground">
                {userRole === 'buyer' && document.supplier && (
                  <span>Supplier: {document.supplier.company_name}</span>
                )}
                {userRole === 'supplier' && document.buyer && (
                  <span>Requested by: {document.buyer.company_name}</span>
                )}
                {document.uploader && (
                  <span className="ml-4">Uploaded by: {document.uploader.full_name}</span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Renewal Dialog */}
      {canRenew && expiryStatus && (expiryStatus.status === 'expired' || expiryStatus.status === 'expiring_soon') && (
        <DocumentRenewalDialog
          isOpen={showRenewalDialog}
          onClose={() => setShowRenewalDialog(false)}
          request={{
            id: document.id,
            title: document.title || document.document_type,
            document_uploads: document.document_uploads
          }}
          expiryStatus={{ status: expiryStatus.status, days: expiryStatus.days }}
          onRenewalSuccess={() => {
            setShowRenewalDialog(false);
            onRenewalSuccess?.();
          }}
        />
      )}
    </>
  );
};

export default DocumentCard;
