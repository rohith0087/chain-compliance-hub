import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Upload, FileText, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface SampleTemplate {
  id: string;
  buyer_id: string;
  document_type: string;
  sample_file_path: string;
  sample_file_name: string;
  sample_file_size: number | null;
  sample_mime_type: string | null;
  notes: string | null;
  display_name?: string | null;
}

interface SampleTemplateUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  buyerId: string;
  documentType: string;
  existingTemplate?: SampleTemplate | null;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = {
  'application/pdf': ['.pdf'],
  'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
};

export function SampleTemplateUploadModal({
  isOpen,
  onClose,
  onSuccess,
  buyerId,
  documentType,
  existingTemplate,
}: SampleTemplateUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState(existingTemplate?.notes || '');
  const [displayName, setDisplayName] = useState(existingTemplate?.display_name || '');
  const [uploading, setUploading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // Auto-populate display name when a new file is selected
  useEffect(() => {
    if (file && !displayName) {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
      setDisplayName(nameWithoutExt);
    }
  }, [file]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const selectedFile = acceptedFiles[0];
      if (selectedFile.size > MAX_FILE_SIZE) {
        toast({
          title: 'File too large',
          description: 'Maximum file size is 10MB',
          variant: 'destructive',
        });
        return;
      }
      setFile(selectedFile);
    }
  }, [toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxFiles: 1,
    multiple: false,
  });

  const handleSubmit = async () => {
    if (!file && !existingTemplate) {
      toast({
        title: 'No file selected',
        description: 'Please select a file to upload',
        variant: 'destructive',
      });
      return;
    }

    if (!user) return;

    setUploading(true);
    try {
      let filePath = existingTemplate?.sample_file_path;
      let fileName = existingTemplate?.sample_file_name;
      let fileSize = existingTemplate?.sample_file_size;
      let mimeType = existingTemplate?.sample_mime_type;

      // Upload new file if provided
      if (file) {
        const fileExt = file.name.split('.').pop();
        const sanitizedDocType = documentType.replace(/[^a-zA-Z0-9]/g, '_');
        const uniqueId = crypto.randomUUID();
        filePath = `${buyerId}/templates/${sanitizedDocType}_${uniqueId}.${fileExt}`;

        // Delete old file if replacing
        if (existingTemplate?.sample_file_path) {
          await supabase.storage
            .from('sample-documents')
            .remove([existingTemplate.sample_file_path]);
        }

        // Upload new file
        const { error: uploadError } = await supabase.storage
          .from('sample-documents')
          .upload(filePath, file);

        if (uploadError) {
          throw new Error('Failed to upload file: ' + uploadError.message);
        }

        fileName = file.name;
        fileSize = file.size;
        mimeType = file.type;
      }

      // Upsert database record
      const templateData = {
        buyer_id: buyerId,
        document_type: documentType,
        sample_file_path: filePath,
        sample_file_name: fileName,
        sample_file_size: fileSize,
        sample_mime_type: mimeType,
        notes: notes.trim() || null,
        display_name: displayName.trim() || null,
        uploaded_by: user.id,
        updated_at: new Date().toISOString(),
      };

      if (existingTemplate) {
        // Update existing
        const { error } = await supabase
          .from('buyer_sample_templates')
          .update(templateData)
          .eq('id', existingTemplate.id);

        if (error) throw error;

        toast({
          title: 'Template Updated',
          description: `Sample template for "${documentType}" has been updated.`,
        });
      } else {
        // Insert new
        const { error } = await supabase
          .from('buyer_sample_templates')
          .insert(templateData);

        if (error) throw error;

        toast({
          title: 'Template Uploaded',
          description: `Sample template for "${documentType}" has been saved.`,
        });
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error saving template:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save sample template',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setNotes(existingTemplate?.notes || '');
    setDisplayName(existingTemplate?.display_name || '');
    onClose();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {existingTemplate ? 'Update Sample Template' : 'Upload Sample Template'}
          </DialogTitle>
          <DialogDescription>
            {existingTemplate 
              ? `Replace or update the sample for "${documentType}"`
              : `Upload a reference document for "${documentType}" that suppliers can use as a guide.`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Upload Zone */}
          <div>
            <Label className="mb-2 block">Sample Document</Label>
          {file ? (
              <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50 overflow-hidden">
                <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
                  <FileText className="h-8 w-8 text-primary flex-shrink-0" />
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <p className="font-medium truncate max-w-[250px]" title={file.name}>{file.name}</p>
                    <p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setFile(null); setDisplayName(''); }}
                  className="flex-shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : existingTemplate && !file ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 border rounded-lg bg-success/5 border-success/20 overflow-hidden">
                  <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
                    <FileText className="h-8 w-8 text-success flex-shrink-0" />
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <p className="font-medium truncate max-w-[250px]" title={existingTemplate.sample_file_name}>
                        {existingTemplate.display_name || existingTemplate.sample_file_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatFileSize(existingTemplate.sample_file_size || 0)} • Current file
                      </p>
                    </div>
                  </div>
                </div>
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                    isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary'
                  }`}
                >
                  <input {...getInputProps()} />
                  <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Drop a new file here or click to replace
                  </p>
                </div>
              </div>
            ) : (
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary'
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="font-medium">
                  {isDragActive ? 'Drop your file here' : 'Drag & drop or click to upload'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  PDF, Word, Excel, or images up to 10MB
                </p>
              </div>
            )}
          </div>

          {/* Display Name */}
          <div>
            <Label htmlFor="displayName" className="mb-2 block">
              Display Name (Optional)
            </Label>
            <Input
              id="displayName"
              placeholder="Enter a friendly name for this template..."
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              A custom name to display instead of the original file name.
            </p>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes" className="mb-2 block">
              Guidance Notes (Optional)
            </Label>
            <Textarea
              id="notes"
              placeholder="Add instructions or requirements for suppliers..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground mt-1">
              These notes will be shown to suppliers alongside the sample document.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={uploading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={uploading || (!file && !existingTemplate)}>
            {uploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {existingTemplate ? 'Update Template' : 'Upload Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
