import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Upload, AlertTriangle, Calendar, FileText, Clock } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface DocumentRenewalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  request: any;
  expiryStatus: { status: 'expired' | 'expiring_soon'; days: number };
  onRenewalSuccess: () => void;
}

const DocumentRenewalDialog = ({
  isOpen,
  onClose,
  request,
  expiryStatus,
  onRenewalSuccess
}: DocumentRenewalDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [expirationDate, setExpirationDate] = useState('');
  const [uploading, setUploading] = useState(false);

  // Get current version number
  const currentVersion = request.document_uploads?.length || 0;
  const newVersion = currentVersion + 1;

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024 // 10MB
  });

  const handleRenewal = async () => {
    if (!file || !user) {
      toast({
        title: "Missing Information",
        description: "Please select a file to upload.",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);

    try {
      // Upload file to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${request.id}_v${newVersion}_${Date.now()}.${fileExt}`;
      const filePath = `compliance-documents/${request.supplier_id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('compliance-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Create new document upload record (as new version)
      const { error: insertError } = await supabase
        .from('document_uploads')
        .insert({
          request_id: request.id,
          uploader_id: user.id,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type,
          status: 'pending_review', // New version goes to review
          version: newVersion,
          expiration_date: expirationDate || null,
          document_name: request.title
        });

      if (insertError) throw insertError;

      // Log activity
      await supabase.from('document_activity_logs').insert({
        document_request_id: request.id,
        user_id: user.id,
        action_type: 'renewed',
        notes: `Document renewed - Version ${newVersion}`,
        metadata: { 
          version: newVersion,
          expiry_status: expiryStatus.status,
          days_overdue_or_remaining: expiryStatus.days
        }
      });

      // Update request status back to submitted for review
      await supabase
        .from('document_requests')
        .update({ status: 'submitted', updated_at: new Date().toISOString() })
        .eq('id', request.id);

      toast({
        title: "Document Renewed",
        description: `Version ${newVersion} uploaded successfully and is pending review.`
      });

      onRenewalSuccess();
    } catch (error: any) {
      console.error('Renewal error:', error);
      toast({
        title: "Renewal Failed",
        description: error.message || "Failed to upload renewal document.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setExpirationDate('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Renew Document
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Expiry Alert */}
          <div className={`p-3 rounded-lg border ${
            expiryStatus.status === 'expired'
              ? 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900'
              : 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900'
          }`}>
            <div className="flex items-center gap-2">
              <AlertTriangle className={`w-4 h-4 ${
                expiryStatus.status === 'expired' ? 'text-red-600' : 'text-amber-600'
              }`} />
              <span className={`text-sm font-medium ${
                expiryStatus.status === 'expired' 
                  ? 'text-red-800 dark:text-red-300' 
                  : 'text-amber-800 dark:text-amber-300'
              }`}>
                {expiryStatus.status === 'expired'
                  ? `Document expired ${expiryStatus.days} day${expiryStatus.days !== 1 ? 's' : ''} ago`
                  : `Document expires in ${expiryStatus.days} day${expiryStatus.days !== 1 ? 's' : ''}`
                }
              </span>
            </div>
          </div>

          {/* Document Info */}
          <div className="p-3 bg-muted/50 rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">{request.title}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>Current version: V{currentVersion}</span>
              <Badge variant="outline" className="ml-2">
                New: V{newVersion}
              </Badge>
            </div>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label>Upload Renewed Document</Label>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                isDragActive 
                  ? 'border-primary bg-primary/5' 
                  : file 
                    ? 'border-green-500 bg-green-50 dark:bg-green-950/30' 
                    : 'border-border hover:border-primary/50'
              }`}
            >
              <input {...getInputProps()} />
              {file ? (
                <div className="flex items-center justify-center gap-2 text-green-600">
                  <FileText className="w-5 h-5" />
                  <span className="font-medium">{file.name}</span>
                </div>
              ) : isDragActive ? (
                <p className="text-primary">Drop the file here...</p>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Drag & drop or click to select file
                  </p>
                  <p className="text-xs text-muted-foreground">
                    PDF, DOC, DOCX, PNG, JPG (max 10MB)
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* New Expiration Date */}
          <div className="space-y-2">
            <Label htmlFor="expiration-date" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              New Expiration Date (optional)
            </Label>
            <Input
              id="expiration-date"
              type="date"
              value={expirationDate}
              onChange={(e) => setExpirationDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={handleClose} disabled={uploading}>
              Cancel
            </Button>
            <Button 
              onClick={handleRenewal} 
              disabled={!file || uploading}
              className={expiryStatus.status === 'expired' 
                ? 'bg-red-600 hover:bg-red-700' 
                : 'bg-amber-600 hover:bg-amber-700'
              }
            >
              {uploading ? (
                <>
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload V{newVersion}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DocumentRenewalDialog;
