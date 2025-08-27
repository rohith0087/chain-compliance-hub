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
import { Upload, X, FileText, Loader2, Sparkles, CheckCircle, XCircle } from 'lucide-react';
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

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  supplierId,
  onClose,
  onUploadComplete
}) => {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [formData, setFormData] = useState({
    document_name: '',
    document_type: '',
    category: '',
    description: '',
    expiration_date: '',
    tags: [] as string[]
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState<any>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const analyzeDocument = async (file: File) => {
    setAnalyzing(true);
    try {
      const formDataForAnalysis = new FormData();
      formDataForAnalysis.append('file', file);
      formDataForAnalysis.append('supplierId', supplierId);

      const { data, error } = await supabase.functions.invoke('document-analyzer', {
        body: formDataForAnalysis
      });

      if (error) throw error;

      if (data.success) {
        setAiSuggestions(data.analysis);
        setShowSuggestions(true);
        
        // Auto-populate form with AI suggestions
        setFormData(prev => ({
          ...prev,
          document_name: data.analysis.cleanedName || prev.document_name,
          category: data.analysis.suggestedCategory || prev.category,
          description: data.analysis.suggestedDescription || prev.description,
          expiration_date: data.analysis.potentialExpirationDate || prev.expiration_date,
        }));
        
        if (data.analysis.suggestedTags) {
          setFormData(prev => ({
            ...prev,
            tags: data.analysis.suggestedTags
          }));
        }
        
        toast.success('Document analyzed successfully! Review and edit the suggestions.');
      }
    } catch (error) {
      console.error('Document analysis failed:', error);
      toast.error('Document analysis failed, but you can still upload manually');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFileSelect = (file: File) => {
    if (file.size > 50 * 1024 * 1024) {
      toast.error('File size must be less than 50MB');
      return;
    }

    const allowedTypes = Object.keys(ACCEPTED_FILE_TYPES);
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only PDF, TXT, DOC, DOCX, JPG, PNG, and GIF files are allowed');
      return;
    }

    setSelectedFile(file);
    
    // Auto-fill document type
    const fileExtension = file.name.split('.').pop()?.toUpperCase() || '';
    setFormData(prev => ({
      ...prev,
      document_type: fileExtension
    }));

    // Analyze document with AI
    analyzeDocument(file);
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
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }));
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    }
  };

  const applySuggestion = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleUpload = async () => {
    if (!selectedFile || !formData.document_name.trim() || !formData.category) {
      toast.error('Please fill in all required fields and select a file');
      return;
    }

    if (!user) {
      toast.error('You must be logged in to upload documents');
      return;
    }

    try {
      setUploading(true);

      // Generate unique file path
      const fileExtension = selectedFile.name.split('.').pop();
      const fileName = `${supplierId}/${Date.now()}-${formData.document_name.replace(/[^a-zA-Z0-9]/g, '_')}.${fileExtension}`;

      // Upload file to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('compliance-documents')
        .upload(fileName, selectedFile);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        toast.error('Failed to upload file');
        return;
      }

      // Save document metadata to database
      const { data: documentData, error: dbError } = await supabase
        .from('supplier_document_library')
        .insert({
          supplier_id: supplierId,
          document_name: formData.document_name.trim(),
          document_type: formData.document_type,
          file_path: uploadData.path,
          file_size: selectedFile.size,
          mime_type: selectedFile.type,
          category: formData.category,
          tags: formData.tags.length > 0 ? formData.tags : null,
          description: formData.description.trim() || null,
          uploaded_by: user.id,
          extraction_status: 'pending',
          expiration_date: formData.expiration_date || null,
          ai_suggested_tags: aiSuggestions?.suggestedTags || null,
          ai_suggested_description: aiSuggestions?.suggestedDescription || null,
        })
        .select()
        .single();

      if (dbError) {
        console.error('Database error:', dbError);
        // Clean up uploaded file
        await supabase.storage.from('compliance-documents').remove([uploadData.path]);
        toast.error('Failed to save document metadata');
        return;
      }

      // Trigger content extraction
      try {
        const { error: functionError } = await supabase.functions.invoke('document-content-extractor', {
          body: {
            document_id: documentData.id,
            file_path: uploadData.path
          }
        });

        if (functionError) {
          console.error('Content extraction error:', functionError);
        }
      } catch (extractionError) {
        console.error('Content extraction failed:', extractionError);
      }

      toast.success('Document uploaded successfully! Content extraction is in progress.');
      onUploadComplete();

    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Document to Library
          </DialogTitle>
          <DialogDescription>
            Upload PDF, DOC, TXT, or image files. AI will help suggest categories, tags, and extract key information.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* File Upload Area */}
          <div className="space-y-2">
            <Label>Document File *</Label>
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                dragActive ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-gray-400'
              } ${analyzing ? 'pointer-events-none opacity-50' : ''}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => !analyzing && document.getElementById('file-input')?.click()}
            >
              {selectedFile ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-center space-x-2">
                    <FileText className="h-8 w-8 text-primary" />
                    <div>
                      <p className="font-medium">{selectedFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  {analyzing && (
                    <div className="flex items-center justify-center gap-2 text-blue-600">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Analyzing document with AI...</span>
                    </div>
                  )}
                  {!analyzing && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                        setAiSuggestions(null);
                        setShowSuggestions(false);
                        setFormData({
                          document_name: '',
                          document_type: '',
                          category: '',
                          description: '',
                          expiration_date: '',
                          tags: []
                        });
                      }}
                    >
                      Choose Different File
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-8 w-8 text-muted-foreground mx-auto" />
                  <div>
                    <p className="font-medium">Click to upload or drag and drop</p>
                    <p className="text-sm text-muted-foreground">
                      PDF, TXT, DOC, DOCX, JPG, PNG, GIF files up to 50MB
                    </p>
                  </div>
                </div>
              )}
            </div>
            <input
              id="file-input"
              type="file"
              className="hidden"
              accept={Object.values(ACCEPTED_FILE_TYPES).flat().join(',')}
              onChange={(e) => e.target.files && handleFileSelect(e.target.files[0])}
            />
          </div>

          {/* AI Suggestions */}
          {showSuggestions && aiSuggestions && (
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-700">AI Suggestions</span>
                <Badge variant="secondary" className="text-xs">
                  {Math.round((aiSuggestions.confidence || 0) * 100)}% confident
                </Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-blue-600 font-medium">Category:</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => applySuggestion('category', aiSuggestions.suggestedCategory)}
                      className="h-6 px-2 text-xs"
                    >
                      Use
                    </Button>
                  </div>
                  <p className="text-blue-700">{aiSuggestions.suggestedCategory}</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-blue-600 font-medium">Tags:</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => applySuggestion('tags', aiSuggestions.suggestedTags)}
                      className="h-6 px-2 text-xs"
                    >
                      Use
                    </Button>
                  </div>
                  <p className="text-blue-700">{aiSuggestions.suggestedTags?.join(', ')}</p>
                </div>
                {aiSuggestions.potentialExpirationDate && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-blue-600 font-medium">Expiry Date:</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => applySuggestion('expiration_date', aiSuggestions.potentialExpirationDate)}
                        className="h-6 px-2 text-xs"
                      >
                        Use
                      </Button>
                    </div>
                    <p className="text-blue-700">{aiSuggestions.potentialExpirationDate}</p>
                  </div>
                )}
                <div className="space-y-2 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <span className="text-blue-600 font-medium">Description:</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => applySuggestion('description', aiSuggestions.suggestedDescription)}
                      className="h-6 px-2 text-xs"
                    >
                      Use
                    </Button>
                  </div>
                  <p className="text-blue-700">{aiSuggestions.suggestedDescription}</p>
                </div>
              </div>
            </div>
          )}

          {/* Document Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="document_name">Document Name *</Label>
              <Input
                id="document_name"
                value={formData.document_name}
                onChange={(e) => setFormData(prev => ({ ...prev, document_name: e.target.value }))}
                placeholder="Enter document name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}>
                <SelectTrigger>
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

            <div className="space-y-2">
              <Label htmlFor="document_type">Document Type</Label>
              <Input
                id="document_type"
                value={formData.document_type}
                onChange={(e) => setFormData(prev => ({ ...prev, document_type: e.target.value }))}
                placeholder="e.g., PDF, Certificate"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expiration_date">Expiration Date</Label>
              <Input
                id="expiration_date"
                type="date"
                value={formData.expiration_date}
                onChange={(e) => setFormData(prev => ({ ...prev, expiration_date: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description of the document..."
              rows={3}
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="tags">Tags</Label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  id="tags"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Add tags (press Enter or comma to add)"
                  className="flex-1"
                />
                <Button type="button" variant="outline" onClick={addTag}>
                  Add
                </Button>
              </div>
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      {tag}
                      <X
                        className="h-3 w-3 cursor-pointer hover:text-destructive"
                        onClick={() => removeTag(tag)}
                      />
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose} disabled={uploading || analyzing}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpload} 
              disabled={uploading || analyzing || !selectedFile || !formData.document_name.trim() || !formData.category}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : analyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
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