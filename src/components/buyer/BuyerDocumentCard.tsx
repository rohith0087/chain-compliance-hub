import { useState } from 'react';
import { format } from 'date-fns';
import { Download, Eye, Trash2, AlertCircle, FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { BUYER_DOCUMENT_TYPES } from '@/config/buyerDocumentTypes';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface BuyerDocumentCardProps {
  document: {
    id: string;
    document_name: string;
    document_type: string;
    file_path: string;
    file_size?: number;
    created_at: string;
    expiration_date?: string;
    description?: string;
  };
  onDelete: () => void;
}

const BuyerDocumentCard = ({ document, onDelete }: BuyerDocumentCardProps) => {
  const { toast } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const docType = BUYER_DOCUMENT_TYPES[document.document_type as keyof typeof BUYER_DOCUMENT_TYPES] || BUYER_DOCUMENT_TYPES.OTHER;
  const IconComponent = docType.icon;

  const isExpiringSoon = document.expiration_date && 
    new Date(document.expiration_date) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  
  const isExpired = document.expiration_date && new Date(document.expiration_date) < new Date();

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    const kb = bytes / 1024;
    const mb = kb / 1024;
    return mb > 1 ? `${mb.toFixed(2)} MB` : `${kb.toFixed(2)} KB`;
  };

  const handleView = async () => {
    try {
      const { data, error } = await supabase.storage
        .from('compliance-documents')
        .createSignedUrl(document.file_path, 3600);

      if (error) throw error;

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      console.error('Error viewing document:', error);
      toast({
        title: 'Error',
        description: 'Failed to open document',
        variant: 'destructive',
      });
    }
  };

  const handleDownload = async () => {
    try {
      const { data, error } = await supabase.storage
        .from('compliance-documents')
        .createSignedUrl(document.file_path, 60);

      if (error) throw error;

      if (data?.signedUrl) {
        const link = window.document.createElement('a');
        link.href = data.signedUrl;
        link.download = document.document_name;
        window.document.body.appendChild(link);
        link.click();
        window.document.body.removeChild(link);

        toast({
          title: 'Success',
          description: 'Document downloaded successfully',
        });
      }
    } catch (error) {
      console.error('Error downloading document:', error);
      toast({
        title: 'Error',
        description: 'Failed to download document',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('compliance-documents')
        .remove([document.file_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('buyer_document_library')
        .delete()
        .eq('id', document.id);

      if (dbError) throw dbError;

      toast({
        title: 'Success',
        description: 'Document deleted successfully',
      });

      onDelete();
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete document',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <>
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg bg-${docType.color}-100 dark:bg-${docType.color}-900/20`}>
              <IconComponent className={`h-5 w-5 text-${docType.color}-600 dark:text-${docType.color}-400`} />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm truncate">{document.document_name}</h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="secondary" className="text-xs">
                      {docType.label}
                    </Badge>
                    {isExpired && (
                      <Badge variant="destructive" className="text-xs">
                        Expired
                      </Badge>
                    )}
                    {isExpiringSoon && !isExpired && (
                      <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-600">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Expiring Soon
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {document.description && (
                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                  {document.description}
                </p>
              )}

              <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                <span>{format(new Date(document.created_at), 'MMM d, yyyy')}</span>
                <span>{formatFileSize(document.file_size)}</span>
                {document.expiration_date && (
                  <span className={isExpired ? 'text-destructive' : ''}>
                    Expires: {format(new Date(document.expiration_date), 'MMM d, yyyy')}
                  </span>
                )}
              </div>

              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleView}
                  className="h-8 text-xs"
                >
                  <Eye className="h-3 w-3 mr-1" />
                  View
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDownload}
                  className="h-8 text-xs"
                >
                  <Download className="h-3 w-3 mr-1" />
                  Download
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowDeleteDialog(true)}
                  className="h-8 text-xs text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Delete
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{document.document_name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default BuyerDocumentCard;
