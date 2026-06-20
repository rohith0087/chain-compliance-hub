import { useState } from 'react';
import { Card } from '@/components/ui/card';
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
  Ban,
  MessageSquare,
  MoreVertical,
  Sparkles
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
    notes?: string;
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
  onEditNotes?: () => void;
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
  onEditNotes,
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
      className={`relative hover:shadow-elegant transition-all duration-300 border-l-4 overflow-hidden ${
        isExpired(document.expiration_date) || document.status === 'rejected' ? 'border-l-red-500' :
        isExpiringSoon(document.expiration_date) ? 'border-l-amber-500' :
        document.status === 'pending' ? 'border-l-blue-500' :
        document.status === 'approved' ? 'border-l-green-500' :
        getCategoryColor(document.category)
      } ${isSelected ? 'ring-2 ring-[hsl(var(--blue-accent))] shadow-[0_0_20px_hsl(var(--blue-accent)/0.3)]' : ''} ${
        isClickable ? 'cursor-pointer hover:ring-1 hover:ring-[#003f88]/50' : ''
      }`}
      onClick={handleCardClick}
    >
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_120px] gap-4 items-center p-4">
        
        {/* 1. DOCUMENT */}
        <div className="flex items-start gap-3 min-w-0">
          {showSelection && onSelectionChange && (
            <div className="pt-0.5">
              <Checkbox
                checked={isSelected}
                onCheckedChange={onSelectionChange}
                className="data-[state=checked]:bg-[hsl(var(--blue-accent))] data-[state=checked]:border-[hsl(var(--blue-accent))]"
              />
            </div>
          )}
          <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <FileText className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold truncate text-foreground pr-2">
              {document.title || document.document_type}
            </h3>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground whitespace-nowrap">
                {document.document_type}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground whitespace-nowrap">
                {document.category}
              </span>
            </div>
          </div>
        </div>

        {/* 2. CATEGORY & STATUS */}
        <div className="flex flex-col items-start min-w-0 gap-1.5">
          <div className="flex items-center gap-2">
            <Badge 
              variant="secondary" 
              className={`text-[10px] font-medium border px-1.5 py-0 rounded-md ${
                isExpired(document.expiration_date) ? 'bg-red-50 text-red-600 border-red-200' :
                isExpiringSoon(document.expiration_date) ? 'bg-amber-50 text-amber-600 border-amber-200' :
                document.status === 'pending' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                document.status === 'approved' ? 'bg-green-50 text-green-600 border-green-200' :
                'bg-muted text-muted-foreground border-border/50'
              }`}
            >
              {isExpired(document.expiration_date) ? (
                <><AlertTriangle className="w-3 h-3 mr-1" /> Expired</>
              ) : isExpiringSoon(document.expiration_date) ? (
                <><Clock className="w-3 h-3 mr-1" /> Expires Soon</>
              ) : document.status === 'approved' ? (
                <><CheckCircle className="w-3 h-3 mr-1" /> Approved</>
              ) : document.status === 'pending' ? (
                <><Clock className="w-3 h-3 mr-1" /> Pending</>
              ) : (
                <><FileText className="w-3 h-3 mr-1" /> <span className="capitalize">{document.status}</span></>
              )}
            </Badge>

            {/* AI Summary Popover placeholder */}
            <Popover>
              <PopoverTrigger asChild>
                <button 
                  className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md font-medium border transition-colors ${
                    isExpired(document.expiration_date) || document.status === 'rejected' ? 'bg-red-50/50 text-red-600 border-red-200/50 hover:bg-red-50' :
                    isExpiringSoon(document.expiration_date) || document.status === 'pending' ? 'bg-amber-50/50 text-amber-600 border-amber-200/50 hover:bg-amber-50' :
                    'bg-primary/5 text-primary border-primary/10 hover:bg-primary/10'
                  }`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Sparkles className="w-3 h-3" />
                  {isExpired(document.expiration_date) ? 'AI: High priority' : 
                   isExpiringSoon(document.expiration_date) ? 'AI: Renew now' : 
                   document.status === 'pending' ? 'AI: Follow up' : 
                   'AI: Summary'}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-3 text-xs" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-primary mt-0.5" />
                  <div>
                    <p className="font-semibold mb-1">AI Document Analysis</p>
                    <p className="text-muted-foreground leading-relaxed">
                      {isExpired(document.expiration_date) 
                        ? "This document is highly overdue. Recommend requesting renewal immediately from the supplier to maintain compliance."
                        : isExpiringSoon(document.expiration_date)
                        ? `This document expires on ${formatDate(document.expiration_date)}. Recommended action: send renewal request to supplier now.`
                        : document.status === 'pending'
                        ? "This document is pending approval. Please review the contents to verify they meet your compliance requirements."
                        : `This ${document.document_type} is approved and linked to ${document.supplier?.company_name || 'the supplier'}. No immediate action is required.`
                      }
                    </p>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <span className={`text-[10px] ${
            isExpired(document.expiration_date) ? 'text-red-500 font-medium' :
            isExpiringSoon(document.expiration_date) ? 'text-amber-500 font-medium' :
            'text-muted-foreground'
          }`}>
            {isExpired(document.expiration_date) 
              ? `Expired ${formatDate(document.expiration_date)}`
              : isExpiringSoon(document.expiration_date)
              ? `Expires ${formatDate(document.expiration_date)}`
              : document.status === 'approved'
              ? `Approved on ${formatDate(document.created_at)}`
              : 'Action required'}
          </span>
        </div>

        {/* 3. DETAILS */}
        <div className="flex flex-col min-w-0 text-[10px] text-muted-foreground gap-1 justify-center">
          <div className="flex items-center gap-1.5 flex-wrap">
            {userRole === 'buyer' && document.supplier && (
              <span className="truncate flex items-center gap-1">
                Supplier: <span className="font-medium text-foreground truncate max-w-[120px]">{document.supplier.company_name}</span>
              </span>
            )}
            {document.uploader && (
              <>
                <span>&bull;</span>
                <span className="truncate flex items-center gap-1">
                  Uploaded by: <span className="font-medium text-foreground truncate max-w-[80px]">{document.uploader.full_name}</span>
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span>Created: <span className="text-foreground">{formatDate(document.created_at)}</span></span>
            {document.due_date && (
              <>
                <span>&bull;</span>
                <span>Due: <span className="text-foreground">{formatDate(document.due_date)}</span></span>
              </>
            )}
            {document.file_size && (
              <>
                <span>&bull;</span>
                <span>Size: <span className="text-foreground">{formatFileSize(document.file_size)}</span></span>
              </>
            )}
          </div>
        </div>

        {/* 4. ACTIONS */}
        <div className="flex items-center justify-end gap-1">
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 text-xs px-3"
            onClick={(e) => {
              e.stopPropagation();
              onView?.();
            }}
          >
            <Eye className="w-3.5 h-3.5 mr-1.5" />
            View
          </Button>
          
          {(onDownload || onApprove || onDecline || onWithdraw || onCreateLink || onEditNotes) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
                {onDownload && (
                  <DropdownMenuItem onClick={onDownload}>
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </DropdownMenuItem>
                )}
                {onEditNotes && (
                  <DropdownMenuItem onClick={onEditNotes}>
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Notes
                  </DropdownMenuItem>
                )}
                {canCreateLink && (
                  <DropdownMenuItem onClick={onCreateLink}>
                    <Link className="mr-2 h-4 w-4" />
                    Create Link
                  </DropdownMenuItem>
                )}
                
                {canWithdraw && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={onWithdraw} 
                      className="text-amber-600 focus:text-amber-600 focus:bg-amber-50"
                    >
                      <Ban className="mr-2 h-4 w-4" />
                      Withdraw
                    </DropdownMenuItem>
                  </>
                )}

                {canApproveOrDecline && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={onApprove} 
                      className="text-green-600 focus:text-green-600 focus:bg-green-50"
                    >
                      <ThumbsUp className="mr-2 h-4 w-4" />
                      Approve
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={onDecline} 
                      className="text-red-600 focus:text-red-600 focus:bg-red-50"
                    >
                      <ThumbsDown className="mr-2 h-4 w-4" />
                      Decline
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

      </div>
    </Card>
  );
};

export default DocumentCardWithSelection;