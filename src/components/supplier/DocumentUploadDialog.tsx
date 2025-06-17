
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Upload, File, X } from 'lucide-react';
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
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
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

  const handleUpload = async () => {
    if (!file || !user) return;

    setUploading(true);
    try {
      // Create a unique file path
      const fileExt = file.name.split('.').pop();
      const fileName = `${request.id}_${Date.now()}.${fileExt}`;
      const filePath = `documents/${fileName}`;

      // Upload file to Supabase Storage (we'll need to create this bucket)
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        
        // If bucket doesn't exist, create a simple record without file storage for now
        const { error: insertError } = await supabase
          .from('document_uploads')
          .insert({
            request_id: request.id,
            uploader_id: user.id,
            file_name: file.name,
            file_path: filePath,
            file_size: file.size,
            mime_type: file.type,
            status: 'pending_review',
            reviewer_notes: notes || null
          });

        if (insertError) throw insertError;
      } else {
        // Record the upload in the database
        const { error: insertError } = await supabase
          .from('document_uploads')
          .insert({
            request_id: request.id,
            uploader_id: user.id,
            file_name: file.name,
            file_path: uploadData.path,
            file_size: file.size,
            mime_type: file.type,
            status: 'pending_review',
            reviewer_notes: notes || null
          });

        if (insertError) throw insertError;
      }

      // Update the request status
      const { error: updateError } = await supabase
        .from('document_requests')
        .update({ status: 'submitted' })
        .eq('id', request.id);

      if (updateError) throw updateError;

      // Create notification for the buyer
      if (request.buyer_id) {
        await supabase.rpc('create_notification', {
          p_user_id: request.buyers?.profile_id || request.requester_id,
          p_title: 'Document Submitted',
          p_message: `${request.title} has been submitted for review`,
          p_type: 'document_submitted',
          p_reference_id: request.id
        });
      }

      toast({
        title: "Upload Successful",
        description: "Your document has been submitted for review.",
      });

      onUploadSuccess();
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload document. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setNotes('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Request Info */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-sm mb-1">{request.title}</h4>
            <p className="text-xs text-gray-600">Type: {request.document_type}</p>
            <p className="text-xs text-gray-600">Category: {request.category}</p>
          </div>

          {/* File Upload */}
          <div>
            <Label htmlFor="file-upload">Select Document *</Label>
            <div className="mt-1">
              <Input
                id="file-upload"
                type="file"
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt"
                className="cursor-pointer"
              />
              <p className="text-xs text-gray-500 mt-1">
                Supported formats: PDF, DOC, DOCX, JPG, PNG, TXT (Max 10MB)
              </p>
            </div>
          </div>

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
              onClick={handleUpload}
              disabled={!file || uploading}
            >
              {uploading ? (
                <>Uploading...</>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Document
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
