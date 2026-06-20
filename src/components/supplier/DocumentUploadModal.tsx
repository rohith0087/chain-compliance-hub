import React, { useState, useEffect } from 'react';
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
import { Upload, X, FileText, Loader2, Trash2, FolderOpen, Calendar, Tag, Info } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspaceProfile } from '@/hooks/useWorkspaceProfile';
import { cn } from '@/lib/utils';
import { useCanonicalEvidenceFeature } from '@/hooks/useCanonicalEvidenceFeature';

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

const DOCUMENT_TYPES = [
  ['sds', 'Safety Data Sheet (SDS)'], ['iso_certificate', 'ISO Certificate'],
  ['insurance_certificate', 'Insurance Certificate'], ['coa', 'Certificate of Analysis (COA)'],
  ['business_license', 'Business License'], ['test_report', 'Test Report'], ['generic_evidence', 'Other Evidence'],
] as const;

function inferDocumentType(fileName: string): string {
  const value = fileName.toLowerCase();
  if (value.includes('sds') || value.includes('safety data') || value.includes('msds')) return 'sds';
  if (value.includes('iso')) return 'iso_certificate';
  if (value.includes('insurance') || value.includes('coi')) return 'insurance_certificate';
  if (value.includes('coa') || value.includes('analysis')) return 'coa';
  if (value.includes('business') && value.includes('license')) return 'business_license';
  if (value.includes('test') && value.includes('report')) return 'test_report';
  return '';
}

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
  no_expiration: boolean;
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
  const [supplierCompanyName, setSupplierCompanyName] = useState<string>('');
  const { t: wsT } = useWorkspaceProfile();
  const { enabled: canonicalEvidenceEnabled } = useCanonicalEvidenceFeature(supplierId, 'supplier');

  // Fetch supplier company name for default document names
  useEffect(() => {
    const fetchSupplierName = async () => {
      if (!supplierId) return;
      
      const { data, error } = await supabase
        .from('suppliers')
        .select('company_name')
        .eq('id', supplierId)
        .single();
      
      if (!error && data) {
        setSupplierCompanyName(data.company_name || '');
      }
    };
    
    fetchSupplierName();
  }, [supplierId]);

  const generateDefaultName = (fileName: string): string => {
    const cleanName = fileName
      .replace(/\.[^/.]+$/, '')
      .replace(/[_-]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
    
    const currentYear = new Date().getFullYear();
    
    if (supplierCompanyName) {
      return `${supplierCompanyName} - ${cleanName} - ${currentYear}`;
    }
    
    return cleanName;
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

      newFiles.push({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        document_name: generateDefaultName(file.name),
        document_type: inferDocumentType(file.name),
        category: '',
        description: '',
        expiration_date: '',
        no_expiration: false,
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
    const invalidFiles = files.filter(f => !f.document_name.trim() || !f.category || !f.document_type);
    if (invalidFiles.length > 0) {
      toast.error('Please fill in document name, document type, and category for all files');
      return;
    }

    // Validate expiration date is set OR no-expiration checkbox is checked for all files
    const missingExpiration = files.filter(f => !f.expiration_date && !f.no_expiration);
    if (missingExpiration.length > 0) {
      toast.error('Please set an expiration date or mark as "no expiration" for all files');
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
          const { data: libraryRow, error: dbError } = await supabase
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
              expiration_date: fileEntry.no_expiration ? null : (fileEntry.expiration_date || null)
            })
            .select('id')
            .single();

          if (dbError) {
            console.error('Database error:', dbError);
            // Clean up uploaded file
            await supabase.storage.from('compliance-documents').remove([uploadData.path]);
            errorCount++;
            continue;
          }

          if (canonicalEvidenceEnabled && libraryRow) {
            const { error: finalizeError } = await supabase.functions.invoke('finalize-canonical-upload-v1', {
              body: {
                source_type: 'supplier_library', source_id: libraryRow.id,
                document_type: fileEntry.document_type, display_name: fileEntry.document_name.trim(),
                logical_identity_key: null, fields: [],
                metadata: { expiry_date: fileEntry.no_expiration ? null : fileEntry.expiration_date, schema_version: 1 },
              },
            });
            if (finalizeError) console.error('Canonical evidence finalization failed:', finalizeError);
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Upload className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold">
                Upload Documents to Library
              </DialogTitle>
              <DialogDescription className="text-sm">
                Upload multiple documents at once. Add category, tags, and expiration dates for each file.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col px-6 py-4">
          {/* File Upload Area */}
          <div
            className={cn(
              "border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer mb-4",
              dragActive 
                ? 'border-primary bg-primary/5 shadow-inner' 
                : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'
            )}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => document.getElementById('multi-file-input')?.click()}
          >
            <div className="space-y-2">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
                <Upload className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Click to upload or drag and drop</p>
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
            <ScrollArea className="flex-1">
              <div className="space-y-4 pr-4">
                <div className="flex items-center justify-between sticky top-0 bg-background py-2 z-10">
                  <span className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 text-primary" />
                    Selected Files ({files.length})
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFiles([])}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Clear All
                  </Button>
                </div>

                {files.map((fileEntry) => (
                  <div 
                    key={fileEntry.id} 
                    className="rounded-xl border border-slate-200/60 bg-slate-50/40 p-4 space-y-4 shadow-sm"
                  >
                    {/* File Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-foreground truncate max-w-[300px]" title={fileEntry.file.name}>
                            {fileEntry.file.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {(fileEntry.file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => removeFile(fileEntry.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Document Details Section */}
                    <div className="rounded-lg border border-amber-200/50 bg-amber-50/30 p-3 space-y-3">
                      <div className="flex items-center gap-2">
                        <Info className="h-3.5 w-3.5 text-amber-600" />
                        <span className="text-xs font-semibold text-amber-900 uppercase tracking-wide">Document Details</span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs font-medium">Document Name *</Label>
                          <Input
                            value={fileEntry.document_name}
                            onChange={(e) => updateFileEntry(fileEntry.id, { document_name: e.target.value })}
                            placeholder={`${supplierCompanyName || wsT.supplier} - Document - ${new Date().getFullYear()}`}
                            className="h-9 bg-background"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs font-medium">Category *</Label>
                          <Select
                            value={fileEntry.category}
                            onValueChange={(value) => updateFileEntry(fileEntry.id, { category: value })}
                          >
                            <SelectTrigger className="h-9 bg-background">
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
                          <Label className="text-xs font-medium flex items-center gap-1.5">
                            <Calendar className="h-3 w-3 text-amber-600" />
                            Expiration Date <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            type="date"
                            value={fileEntry.expiration_date}
                            onChange={(e) => updateFileEntry(fileEntry.id, { expiration_date: e.target.value, no_expiration: false })}
                            disabled={fileEntry.no_expiration}
                            className={cn("h-9 bg-background", fileEntry.no_expiration && "opacity-50 cursor-not-allowed")}
                          />
                          <div className="flex items-center space-x-2 pt-1">
                            <input
                              type="checkbox"
                              id={`no-expiration-${fileEntry.id}`}
                              checked={fileEntry.no_expiration}
                              onChange={(e) => updateFileEntry(fileEntry.id, { 
                                no_expiration: e.target.checked,
                                expiration_date: e.target.checked ? '' : fileEntry.expiration_date
                              })}
                              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <label
                              htmlFor={`no-expiration-${fileEntry.id}`}
                              className="text-xs text-muted-foreground cursor-pointer"
                            >
                              No expiration
                            </label>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs font-medium">Document Type *</Label>
                          <Select value={fileEntry.document_type} onValueChange={(value) => updateFileEntry(fileEntry.id, { document_type: value })}>
                            <SelectTrigger className="h-9 bg-background"><SelectValue placeholder="Select the evidence type" /></SelectTrigger>
                            <SelectContent>{DOCUMENT_TYPES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    {/* Tags Section */}
                    <div className="rounded-lg border border-slate-200/60 bg-muted/30 p-3 space-y-2">
                      <Label className="text-xs font-medium flex items-center gap-1.5">
                        <Tag className="h-3 w-3 text-slate-500" />
                        Tags
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          value={fileEntry.tagInput}
                          onChange={(e) => updateFileEntry(fileEntry.id, { tagInput: e.target.value })}
                          onKeyPress={(e) => handleKeyPress(e, fileEntry.id)}
                          placeholder="Add tags (press Enter)"
                          className="flex-1 h-9 bg-background"
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
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {fileEntry.tags.map((tag, index) => (
                            <Badge key={index} variant="secondary" className="text-xs flex items-center gap-1 px-2 py-0.5">
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

                    {/* Description */}
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Description</Label>
                      <Textarea
                        value={fileEntry.description}
                        onChange={(e) => updateFileEntry(fileEntry.id, { description: e.target.value })}
                        placeholder="Brief description of this document..."
                        rows={2}
                        className="text-sm bg-background resize-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* Empty State */}
          {files.length === 0 && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No files selected yet</p>
                <p className="text-xs">Click the upload area above or drag and drop files</p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-muted/30">
          <Button variant="outline" onClick={onClose} disabled={uploading} className="px-5">
            Cancel
          </Button>
          <Button 
            onClick={handleUploadAll} 
            disabled={uploading || files.length === 0}
            className="px-5"
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
      </DialogContent>
    </Dialog>
  );
};
