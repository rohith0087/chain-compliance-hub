import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, X, FileText, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface DocumentUploadModalProps {
  supplierId: string;
  onClose: () => void;
  onUploadComplete: () => void;
}

const DOCUMENT_CATEGORIES = [
  'Certificate',
  'Insurance',
  'Financial',
  'Legal',
  'Quality',
  'Safety',
  'Environmental',
  'Compliance',
  'Training',
  'Policy',
  'Technical',
  'Other'
];

const ACCEPTED_FILE_TYPES = {
  'application/pdf': ['.pdf'],
  'text/plain': ['.txt'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif']
};

interface FileEntry {
  id: string;
  file: File;
  document_name: string;
  document_type: string;
  category: string;
  description: string;
  expiration_date: string;
  tags: string[];
  tagInput: string;
}

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  supplierId,
  onClose,
  onUploadComplete
}) => {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [dragActive, setDragActive] = useState(false);

  const cleanFileName = (fileName: string): string => {
    return fileName
      .replace(/\.[^/.]+$/, '')
      .replace(/[_-]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  const handleFilesSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;

    const allowedTypes = Object.keys(ACCEPTED_FILE_TYPES);
    const newFiles: FileEntry[] = [];

    Array.from(selectedFiles).forEach(file => {
      if (file.size > 50 * 1024 * 1024) {
        toast.error(`${file.name}: File size must be less than 50MB`);
        return;
      }

      if (!allowedTypes.includes(file.type)) {
        toast.error(`${file.name}: Only PDF, TXT, DOC, DOCX, JPG, PNG, and GIF files are allowed`);
        return;
      }

      const fileExtension = file.name.split('.').pop()?.toUpperCase() || '';
      
      newFiles.push({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        document_name: cleanFileName(file.name),
        document_type: fileExtension,
        category: '',
        description: '',
        expiration_date: '',
        tags: [],
        tagInput: ''
      });
    });

    if (newFiles.length > 0) {
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files) {
      handleFilesSelect(e.dataTransfer.files);
    }
  };

  const updateFileEntry = (id: string, updates: Partial<FileEntry>) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const addTag = (fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (!file || !file.tagInput.trim()) return;

    if (!file.tags.includes(file.tagInput.trim())) {
      updateFileEntry(fileId, {
        tags: [...file.tags, file.tagInput.trim()],
        tagInput: ''
      });
    } else {
      updateFileEntry(fileId, { tagInput: '' });
    }
  };

  const removeTag = (fileId: string, tagToRemove: string) => {
    const file = files.find(f => f.id === fileId);
    if (!file) return;

    updateFileEntry(fileId, {
      tags: file.tags.filter(tag => tag !== tagToRemove)
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent, fileId: string) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(fileId);
    }
  };

  const handleUploadAll = async () => {
    // Validate all files have required fields
    const invalidFiles = files.filter(f => !f.document_name.trim() || !f.category);
    if (invalidFiles.length > 0) {
      toast.error('Please fill in document name and category for all files');
      return;
    }

    if (!user) {
      toast.error('You must be logged in to upload documents');
      return;
    }

    try {
      setUploading(true);
      let successCount = 0;
      let errorCount = 0;

      for (const fileEntry of files) {
        try {
          // Generate unique file path
          const fileExtension = fileEntry.file.name.split('.').pop();
          const fileName = `${supplierId}/${Date.now()}-${fileEntry.document_name.replace(/[^a-zA-Z0-9]/g, '_')}.${fileExtension}`;

          // Upload file to storage
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('compliance-documents')
            .upload(fileName, fileEntry.file);

          if (uploadError) {
            console.error('Upload error:', uploadError);
            errorCount++;
            continue;
          }

          // Save document metadata to database
          const { error: dbError } = await supabase
            .from('supplier_document_library')
            .insert({
              supplier_id: supplierId,
              document_name: fileEntry.document_name.trim(),
              document_type: fileEntry.document_type,
              file_path: uploadData.path,
              file_size: fileEntry.file.size,
              mime_type: fileEntry.file.type,
              category: fileEntry.category,
              tags: fileEntry.tags.length > 0 ? fileEntry.tags : null,
              description: fileEntry.description.trim() || null,
              uploaded_by: user.id,
              extraction_status: 'completed',
              expiration_date: fileEntry.expiration_date || null
            });

          if (dbError) {
            console.error('Database error:', dbError);
            // Clean up uploaded file
            await supabase.storage.from('compliance-documents').remove([uploadData.path]);
            errorCount++;
            continue;
          }

          successCount++;
        } catch (error) {
          console.error('Error uploading file:', error);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully uploaded ${successCount} document${successCount > 1 ? 's' : ''}`);
      }
      if (errorCount > 0) {
        toast.error(`Failed to upload ${errorCount} document${errorCount > 1 ? 's' : ''}`);
      }

      if (successCount > 0) {
        onUploadComplete();
      }

    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload documents');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Documents to Library
          </DialogTitle>
          <DialogDescription>
            Upload multiple documents at once. Add category, tags, and expiration dates for each file.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col space-y-4">
          {/* File Upload Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
              dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => document.getElementById('multi-file-input')?.click()}
          >
            <div className="space-y-2">
              <Upload className="h-8 w-8 text-muted-foreground mx-auto" />
              <div>
                <p className="font-medium">Click to upload or drag and drop</p>
                <p className="text-sm text-muted-foreground">
                  PDF, TXT, DOC, DOCX, JPG, PNG, GIF files up to 50MB each
                </p>
              </div>
            </div>
          </div>
          <input
            id="multi-file-input"
            type="file"
            className="hidden"
            multiple
            accept={Object.values(ACCEPTED_FILE_TYPES).flat().join(',')}
            onChange={(e) => handleFilesSelect(e.target.files)}
          />

          {/* Selected Files List */}
          {files.length > 0 && (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-4 pr-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Selected Files ({files.length})</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFiles([])}
                    className="text-destructive hover:text-destructive"
                  >
                    Clear All
                  </Button>
                </div>

                {files.map((fileEntry) => (
                  <div key={fileEntry.id} className="border rounded-lg p-4 space-y-3 bg-card">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary shrink-0" />
                        <div>
                          <p className="font-medium text-sm">{fileEntry.file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(fileEntry.file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => removeFile(fileEntry.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Document Name *</Label>
                        <Input
                          value={fileEntry.document_name}
                          onChange={(e) => updateFileEntry(fileEntry.id, { document_name: e.target.value })}
                          placeholder="Enter document name"
                          className="h-9"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Category *</Label>
                        <Select
                          value={fileEntry.category}
                          onValueChange={(value) => updateFileEntry(fileEntry.id, { category: value })}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {DOCUMENT_CATEGORIES.map(category => (
                              <SelectItem key={category} value={category}>
                                {category}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Expiration Date</Label>
                        <Input
                          type="date"
                          value={fileEntry.expiration_date}
                          onChange={(e) => updateFileEntry(fileEntry.id, { expiration_date: e.target.value })}
                          className="h-9"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Document Type</Label>
                        <Input
                          value={fileEntry.document_type}
                          onChange={(e) => updateFileEntry(fileEntry.id, { document_type: e.target.value })}
                          placeholder="e.g., PDF, Certificate"
                          className="h-9"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Tags</Label>
                      <div className="flex gap-2">
                        <Input
                          value={fileEntry.tagInput}
                          onChange={(e) => updateFileEntry(fileEntry.id, { tagInput: e.target.value })}
                          onKeyPress={(e) => handleKeyPress(e, fileEntry.id)}
                          placeholder="Add tags (press Enter)"
                          className="flex-1 h-9"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addTag(fileEntry.id)}
                          className="h-9"
                        >
                          Add
                        </Button>
                      </div>
                      {fileEntry.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {fileEntry.tags.map((tag, index) => (
                            <Badge key={index} variant="secondary" className="text-xs flex items-center gap-1">
                              {tag}
                              <X
                                className="h-3 w-3 cursor-pointer hover:text-destructive"
                                onClick={() => removeTag(fileEntry.id, tag)}
                              />
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Description</Label>
                      <Textarea
                        value={fileEntry.description}
                        onChange={(e) => updateFileEntry(fileEntry.id, { description: e.target.value })}
                        placeholder="Brief description..."
                        rows={2}
                        className="text-sm"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose} disabled={uploading}>
              Cancel
            </Button>
            <Button 
              onClick={handleUploadAll} 
              disabled={uploading || files.length === 0}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload {files.length > 0 ? `${files.length} Document${files.length > 1 ? 's' : ''}` : 'Documents'}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
