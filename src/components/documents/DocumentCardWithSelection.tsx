import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
  Ban
} from 'lucide-react';
import DocumentVersionHistory from './DocumentVersionHistory';

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

interface DocumentCardWithSelectionProps {
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
    supplier_id?: string;
    document_uploads?: DocumentUpload[];
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
  onWithdraw?: () => void;
  onOpenSummary?: () => void;
  showActions?: boolean;
  userRole?: 'buyer' | 'supplier';
  approveLoading?: boolean;
  declineLoading?: boolean;
  downloadLoading?: boolean;
  withdrawLoading?: boolean;
  isSelected?: boolean;
  onSelectionChange?: (selected: boolean) => void;
  showSelection?: boolean;
}

const DocumentCardWithSelection = ({ 
  document, 
  onView, 
  onDownload, 
  onUpload, 
  onApprove,
  onDecline,
  onCreateLink,
  onWithdraw,
  onOpenSummary,
  showActions = true,
  userRole = 'buyer',
  approveLoading = false,
  declineLoading = false,
  downloadLoading = false,
  withdrawLoading = false,
  isSelected = false,
  onSelectionChange,
  showSelection = false
}: DocumentCardWithSelectionProps) => {
  // Check if card should be clickable (approved documents for buyer)
  const isClickable = userRole === 'buyer' && document.status === 'approved' && onOpenSummary;

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger if clicking on action buttons, checkbox, or version history
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('[role="checkbox"]') ||
      target.closest('[data-version-history]')
    ) {
      return;
    }
    
    if (isClickable) {
      onOpenSummary();
    }
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-gradient-to-r from-[hsl(var(--green-accent))] to-[hsl(var(--emerald-accent))] text-white border-0';
      case 'pending': return 'bg-gradient-to-r from-[hsl(var(--orange-accent))] to-amber-500 text-white border-0';
      case 'submitted': return 'bg-gradient-to-r from-[hsl(var(--blue-accent))] to-[hsl(var(--accent))] text-white border-0';
      case 'rejected': return 'bg-gradient-to-r from-destructive to-red-600 text-white border-0';
      case 'expired': return 'bg-gradient-to-r from-gray-400 to-gray-500 text-white border-0';
      case 'withdrawn': return 'bg-gradient-to-r from-gray-400 to-gray-500 text-white border-0';
      default: return 'bg-gradient-to-r from-[hsl(var(--teal-accent))] to-cyan-600 text-white border-0';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="w-4 h-4" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'submitted': return <FileText className="w-4 h-4" />;
      case 'rejected': return <AlertTriangle className="w-4 h-4" />;
      case 'withdrawn': return <Ban className="w-4 h-4" />;
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

  const isExpiringSoon = (expirationDate?: string) => {
    if (!expirationDate) return false;
    const expDate = new Date(expirationDate);
    const today = new Date();
    const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    return expDate <= thirtyDaysFromNow && expDate >= today;
  };

  const isExpired = (expirationDate?: string) => {
    if (!expirationDate) return false;
    return new Date(expirationDate) < new Date();
  };

  // Show approve/decline buttons for buyers when document is submitted and has a file
  // Also show for custom template documents (file is in template_submissions)
  const canApproveOrDecline = userRole === 'buyer' && 
    document.status === 'submitted' && 
    (document.file_name || (document as any).template_type === 'custom' || (document as any).has_template_submission);

  const canCreateLink = userRole === 'buyer' && 
    document.status === 'approved' && 
    (document.file_name || (document as any).template_type === 'custom' || (document as any).has_template_submission) && 
    onCreateLink;

  // Show withdraw button for buyers when document is pending
  const canWithdraw = userRole === 'buyer' && 
    document.status === 'pending' && 
    onWithdraw;

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      compliance: 'border-l-[hsl(var(--blue-accent))]',
      certification: 'border-l-[hsl(var(--green-accent))]',
      insurance: 'border-l-[hsl(var(--orange-accent))]',
      quality: 'border-l-[hsl(var(--pink-accent))]',
      safety: 'border-l-[hsl(var(--teal-accent))]',
      financial: 'border-l-[hsl(var(--steel-accent))]',
    };
    return colors[category.toLowerCase()] || 'border-l-[hsl(var(--accent))]';
  };

  return (
    <Card 
      className={`hover:shadow-elegant transition-all duration-300 border-l-4 ${getCategoryColor(document.category)} ${isSelected ? 'ring-2 ring-[hsl(var(--blue-accent))] shadow-[0_0_20px_hsl(var(--blue-accent)/0.3)]' : ''} ${isClickable ? 'cursor-pointer hover:ring-1 hover:ring-[#003f88]/50' : ''}`}
      onClick={handleCardClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            {showSelection && onSelectionChange && (
              <Checkbox
                checked={isSelected}
                onCheckedChange={onSelectionChange}
                className="mt-1 data-[state=checked]:bg-[hsl(var(--blue-accent))] data-[state=checked]:border-[hsl(var(--blue-accent))]"
              />
            )}
            <div className="w-10 h-10 bg-gradient-to-br from-[hsl(var(--blue-accent))]/20 to-[hsl(var(--accent))]/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
              <FileText className="w-5 h-5 text-[hsl(var(--blue-accent))]" />
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
                    className="bg-success hover:bg-success/90"
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
                    className="border-destructive text-destructive hover:bg-destructive/10"
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
              {canWithdraw && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="border-amber-500 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                  onClick={onWithdraw}
                  disabled={withdrawLoading}
                >
                  {withdrawLoading ? (
                    <>
                      <Clock className="w-4 h-4 mr-2 animate-spin" />
                      Withdrawing...
                    </>
                  ) : (
                    <>
                      <Ban className="w-4 h-4 mr-2" />
                      Withdraw
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="space-y-3">
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

          {/* Expiration Date */}
          {document.expiration_date && (
            <div className={`p-3 rounded-lg backdrop-blur-sm ${
              isExpired(document.expiration_date) 
                ? 'bg-gradient-to-r from-red-500/10 to-red-600/10 border border-red-500/30' 
                : isExpiringSoon(document.expiration_date)
                ? 'bg-gradient-to-r from-[hsl(var(--orange-accent))]/10 to-amber-500/10 border border-[hsl(var(--orange-accent))]/30'
                : 'bg-gradient-to-r from-[hsl(var(--green-accent))]/10 to-[hsl(var(--emerald-accent))]/10 border border-[hsl(var(--green-accent))]/30'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Calendar className={`w-4 h-4 ${
                    isExpired(document.expiration_date) ? 'text-red-600' :
                    isExpiringSoon(document.expiration_date) ? 'text-[hsl(var(--orange-accent))]' :
                    'text-[hsl(var(--green-accent))]'
                  }`} />
                  <span className="text-sm font-medium">
                    {userRole === 'buyer' ? 'Document Expires:' : 'Expires:'}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-semibold">{formatDate(document.expiration_date)}</span>
                  {isExpired(document.expiration_date) && (
                    <Badge className="text-xs bg-gradient-to-r from-red-500 to-red-600 text-white border-0">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Expired
                    </Badge>
                  )}
                  {isExpiringSoon(document.expiration_date) && !isExpired(document.expiration_date) && (
                    <Badge className="text-xs bg-gradient-to-r from-[hsl(var(--orange-accent))] to-amber-500 text-white border-0">
                      <Clock className="w-3 h-3 mr-1" />
                      Expires Soon
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Company Information */}
          <div className="pt-3 border-t">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div>
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
              {isClickable && (
                <span className="text-xs text-[#003f88] font-medium">
                  Click to view summary →
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DocumentCardWithSelection;