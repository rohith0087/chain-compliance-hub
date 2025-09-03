
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Upload, File, X, Calendar, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface DocumentUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  request: any;
  onUploadSuccess: () => void;
}

const DocumentUploadDialog = ({ isOpen, onClose, request, onUploadSuccess }: DocumentUploadDialogProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [uploading, setUploading] = useState(false);
  const [updateMetadataOnly, setUpdateMetadataOnly] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const isResubmission = request.status === 'rejected';
  const latestUpload = request.document_uploads?.[0]; // Get the latest upload for rejected documents

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.info('[UploadDialog] File input change', {
      filesLength: e.target.files?.length,
      fromMobile: /Mobi|Android/i.test(navigator.userAgent)
    });
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      console.info('[UploadDialog] Selected file', { name: selectedFile.name, size: selectedFile.size, type: selectedFile.type });
      // Check file size (10MB limit)
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Please select a file smaller than 10MB.",
          variant: "destructive",
        });
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!user) return;
    
    // For resubmission, either file or metadata update is required
    if (isResubmission && !file && !updateMetadataOnly) {
      toast({
        title: "Action Required",
        description: "Please either upload a new document or update the metadata (expiration date/notes).",
        variant: "destructive",
      });
      return;
    }
    
    // For new uploads, file is required
    if (!isResubmission && !file) {
      toast({
        title: "File Required",
        description: "Please select a document to upload.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      let uploadData = null;
      let filePath = latestUpload?.file_path;
      let fileName = latestUpload?.file_name;
      let fileSize = latestUpload?.file_size;
      let mimeType = latestUpload?.mime_type;

// If uploading a new file
if (file) {
  const fileExt = file.name.split('.').pop();
  const generatedName = `${request.id}_${Date.now()}.${fileExt}`;
  fileName = generatedName;

  // Resolve supplier ID (prefer from request, fallback to lookup by profile_id)
  let resolvedSupplierId: string | null = request?.supplier_id || null;
  if (!resolvedSupplierId) {
    const { data: supplierRow, error: supplierLookupError } = await supabase
      .from('suppliers')
      .select('id')
      .eq('profile_id', user.id)
      .single();
    if (supplierLookupError || !supplierRow) {
      console.error('Supplier lookup failed:', supplierLookupError);
      throw new Error('Supplier profile not found');
    }
    resolvedSupplierId = supplierRow.id;
  }

  // Store key without bucket prefix under supplier namespace to satisfy RLS
  const fileKey = `${resolvedSupplierId}/${generatedName}`;
  filePath = fileKey;
  fileSize = file.size;
  mimeType = file.type;

  // Upload file to Supabase Storage
  const { data, error: uploadError } = await supabase.storage
    .from('compliance-documents')
    .upload(fileKey, file);

  if (uploadError) {
    console.error('Upload error:', uploadError);
    throw uploadError; // Do not create DB record if storage upload failed
  } else {
    uploadData = data;
  }
}

      // Determine version number for new upload
      let version = 1;
      if (isResubmission && latestUpload) {
        version = (latestUpload.version || 1) + 1;
      }

      // Handle metadata-only updates vs new file uploads
      if (updateMetadataOnly && latestUpload) {
        // Update existing upload record for metadata-only changes
        const { error: updateError } = await supabase
          .from('document_uploads')
          .update({
            reviewer_notes: notes || null,
            expiration_date: expirationDate || null,
            status: 'pending_review'
          })
          .eq('id', latestUpload.id);

        if (updateError) throw updateError;
      } else {
        // Create new upload record for new file uploads
        const { error: insertError } = await supabase
          .from('document_uploads')
          .insert({
            request_id: request.id,
            uploader_id: user.id,
            file_name: fileName,
            file_path: filePath,
            file_size: fileSize,
            mime_type: mimeType,
            status: 'pending_review',
            reviewer_notes: notes || null,
            expiration_date: expirationDate || null,
            version: version
          });

        if (insertError) throw insertError;
      }

      // Update the request status back to submitted
      const { error: updateError } = await supabase
        .from('document_requests')
        .update({ status: 'submitted' })
        .eq('id', request.id);

      if (updateError) throw updateError;

      // Create notification for the buyer
      const notificationTitle = isResubmission ? 'Document Resubmitted' : 'Document Submitted';
      const notificationMessage = isResubmission 
        ? `${request.title} has been resubmitted after corrections` 
        : `${request.title} has been submitted for review`;

      if (request.buyer_id) {
        await supabase.rpc('create_notification', {
          p_user_id: request.buyers?.profile_id || request.requester_id,
          p_title: notificationTitle,
          p_message: notificationMessage,
          p_type: isResubmission ? 'document_resubmitted' : 'document_submitted',
          p_reference_id: request.id
        });
      }

      // Trigger buyer agent to process newly uploaded documents
      try {
        console.info('Triggering buyer agent for supplier upload...');
        const { data: agentData, error: agentError } = await supabase.functions.invoke('agent-coordinator', {
          body: { action: 'trigger_buyer' }
        });
        if (agentError) {
          console.error('Agent coordinator error:', agentError);
        } else {
          console.info('Agent coordinator response:', agentData);
        }
      } catch (err) {
        console.error('Error invoking agent coordinator:', err);
      }

      toast({
        title: isResubmission ? "Resubmission Successful" : "Upload Successful",
        description: isResubmission 
          ? "Your document has been resubmitted for review." 
          : "Your document has been submitted for review.",
      });

      onUploadSuccess();
    } catch (error: any) {
      console.error('Submit error:', error);
      toast({
        title: isResubmission ? "Resubmission Failed" : "Upload Failed",
        description: error.message || "Failed to process document. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setNotes('');
    setExpirationDate('');
    setUpdateMetadataOnly(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isResubmission ? 'Resubmit Document' : 'Upload Document'}
          </DialogTitle>
          <DialogDescription id="upload-dialog-desc">
            Provide or update the requested document and optional metadata.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Request Info */}
          <div className={`p-3 rounded-lg ${isResubmission ? 'bg-orange-50 border border-orange-200' : 'bg-gray-50'}`}>
            <h4 className="font-medium text-sm mb-1">{request.title}</h4>
            <p className="text-xs text-gray-600">Type: {request.document_type}</p>
            <p className="text-xs text-gray-600">Category: {request.category}</p>
            {isResubmission && (
              <p className="text-xs text-orange-700 mt-2 font-medium">
                Document was rejected - please review feedback and resubmit
              </p>
            )}
          </div>

          {/* Rejection Feedback */}
          {isResubmission && latestUpload?.reviewer_notes && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800 mb-1">Rejection Feedback:</p>
                  <p className="text-sm text-red-700">{latestUpload.reviewer_notes}</p>
                </div>
              </div>
            </div>
          )}

          {/* Resubmission Options */}
          {isResubmission && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm font-medium text-blue-800 mb-2">Resubmission Options:</p>
              <div className="space-y-2">
                <label className="flex items-center space-x-2 text-sm">
                  <input
                    type="radio"
                    name="resubmit-type"
                    checked={!updateMetadataOnly}
                    onChange={() => setUpdateMetadataOnly(false)}
                    className="text-blue-600"
                  />
                  <span>Upload new document file</span>
                </label>
                <label className="flex items-center space-x-2 text-sm">
                  <input
                    type="radio"
                    name="resubmit-type"
                    checked={updateMetadataOnly}
                    onChange={() => setUpdateMetadataOnly(true)}
                    className="text-blue-600"
                  />
                  <span>Update expiration date and notes only</span>
                </label>
              </div>
            </div>
          )}

          {/* File Upload */}
          {(!isResubmission || !updateMetadataOnly) && (
            <div>
              <Label htmlFor="file-upload">
                {isResubmission ? 'Select New Document' : 'Select Document *'}
              </Label>
              <div className="mt-1">
                <Input
                  id="file-upload"
                  type="file"
                  onClick={(e) => e.stopPropagation()}
                  onChange={handleFileChange}
                  accept="image/*,application/pdf,.doc,.docx,.jpg,.jpeg,.png,.txt"
                  multiple={false}
                  className="cursor-pointer"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Supported formats: PDF, DOC, DOCX, JPG, PNG, TXT (Max 10MB)
                </p>
              </div>
            </div>
          )}

          {/* Current Document Info for Resubmission */}
          {isResubmission && updateMetadataOnly && latestUpload && (
            <div className="p-3 bg-gray-50 border rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-1">Current Document:</p>
              <div className="flex items-center space-x-2">
                <File className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-600">{latestUpload.file_name}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                You are updating metadata for this document without replacing the file
              </p>
            </div>
          )}

          {/* Selected File Display */}
          {file && (
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <File className="w-4 h-4 text-blue-600" />
                <div>
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-gray-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFile(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Expiration Date */}
          <div>
            <Label htmlFor="expiration-date" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Document Expiration Date (Optional)
            </Label>
            <Input
              id="expiration-date"
              type="date"
              value={expirationDate}
              onChange={(e) => setExpirationDate(e.target.value)}
              className="mt-1"
              min={new Date().toISOString().split('T')[0]}
            />
            <p className="text-xs text-gray-500 mt-1">
              Set when this document expires (e.g., certificate expiry, license renewal date)
            </p>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Additional Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional information about this document..."
              rows={3}
              className="mt-1"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              type="button"
              onClick={(e) => {
                e.preventDefault();
                handleSubmit(e);
              }}
              disabled={(!file && !isResubmission) || (isResubmission && !file && !updateMetadataOnly) || uploading}
            >
              {uploading ? (
                <>{isResubmission ? 'Resubmitting...' : 'Uploading...'}</>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  {isResubmission ? 'Resubmit Document' : 'Upload Document'}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DocumentUploadDialog;
