
import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, File, X, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface FileUploadZoneProps {
  requestId?: string;
  onUploadComplete?: () => void;
}

const FileUploadZone = ({ requestId, onUploadComplete }: FileUploadZoneProps) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const { user } = useAuth();
  const { toast } = useToast();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setSelectedFiles(prev => [...prev, ...acceptedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'image/*': ['.png', '.jpg', '.jpeg'],
      'text/plain': ['.txt'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const removeFile = (index: number) => {
    setSelectedFiles(files => files.filter((_, i) => i !== index));
  };

  const uploadFiles = async () => {
    if (!user || selectedFiles.length === 0) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}_${file.name}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('compliance-documents')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        // Save file metadata to database
        const { error: dbError } = await supabase
          .from('document_uploads')
          .insert({
            request_id: requestId,
            uploader_id: user.id,
            file_name: file.name,
            file_path: fileName,
            file_size: file.size,
            mime_type: file.type,
          });

        if (dbError) throw dbError;

        // Update progress
        setUploadProgress(((i + 1) / selectedFiles.length) * 100);

        // Create notification if this is for a specific request
        if (requestId) {
          const { data: request } = await supabase
            .from('document_requests')
            .select('requester_id, title')
            .eq('id', requestId)
            .single();

          if (request && request.requester_id !== user.id) {
            await supabase.rpc('create_notification', {
              p_user_id: request.requester_id,
              p_title: 'Document Uploaded',
              p_message: `A document has been uploaded for request: ${request.title}`,
              p_type: 'document_uploaded',
              p_reference_id: requestId
            });
          }
        }
      }

      toast({
        title: "Upload Successful",
        description: `${selectedFiles.length} file(s) uploaded successfully.`,
      });

      setSelectedFiles([]);
      onUploadComplete?.();
    } catch (error: any) {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-6">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-lg font-medium text-gray-900 mb-2">
              {isDragActive ? 'Drop files here' : 'Upload documents'}
            </p>
            <p className="text-sm text-gray-500">
              Drag and drop files here, or click to select files
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Supported formats: PDF, DOC, DOCX, PNG, JPG, TXT (Max 10MB each)
            </p>
          </div>
        </CardContent>
      </Card>

      {selectedFiles.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h4 className="font-medium mb-3">Selected Files ({selectedFiles.length})</h4>
            <div className="space-y-2 mb-4">
              {selectedFiles.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex items-center space-x-2">
                    <File className="w-4 h-4 text-gray-500" />
                    <span className="text-sm">{file.name}</span>
                    <span className="text-xs text-gray-400">
                      ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeFile(index)}
                    disabled={uploading}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>

            {uploading && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm">Uploading...</span>
                  <span className="text-sm">{Math.round(uploadProgress)}%</span>
                </div>
                <Progress value={uploadProgress} />
              </div>
            )}

            <Button 
              onClick={uploadFiles} 
              disabled={uploading || selectedFiles.length === 0}
              className="w-full"
            >
              {uploading ? 'Uploading...' : `Upload ${selectedFiles.length} file(s)`}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FileUploadZone;
