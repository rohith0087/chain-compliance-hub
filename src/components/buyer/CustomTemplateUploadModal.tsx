import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, X, Plus, Trash2 } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useBuyerSetup } from '@/hooks/useBuyerSetup';
import { toast } from 'sonner';

interface CustomTemplateUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const templateCategories = [
  'Risk Control',
  'Traceability', 
  'Onboarding/Approval',
  'Ethical Sourcing',
  'Audit Readiness',
  'Quality Management',
  'Health & Safety',
  'Environmental',
  'Financial',
  'Other'
];

export const CustomTemplateUploadModal = ({ isOpen, onClose, onSuccess }: CustomTemplateUploadModalProps) => {
  const { user } = useAuth();
  const { getBuyerProfile } = useBuyerSetup();
  const [formData, setFormData] = useState({
    templateName: '',
    description: '',
    documentType: '',
    category: '',
    expiresAt: ''
  });
  const [requiredFields, setRequiredFields] = useState<string[]>(['']);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB limit
    onDrop: (acceptedFiles, rejectedFiles) => {
      if (rejectedFiles.length > 0) {
        const rejection = rejectedFiles[0];
        if (rejection.errors.some(e => e.code === 'file-too-large')) {
          setErrors({ ...errors, file: 'File size must be less than 10MB' });
        } else if (rejection.errors.some(e => e.code === 'file-invalid-type')) {
          setErrors({ ...errors, file: 'Invalid file type. Please upload PDF, DOC, DOCX, XLS, or XLSX files' });
        }
        return;
      }
      
      if (acceptedFiles.length > 0) {
        setSelectedFile(acceptedFiles[0]);
        setErrors({ ...errors, file: '' });
      }
    }
  });

  const addRequiredField = () => {
    setRequiredFields([...requiredFields, '']);
  };

  const removeRequiredField = (index: number) => {
    if (requiredFields.length > 1) {
      setRequiredFields(requiredFields.filter((_, i) => i !== index));
    }
  };

  const updateRequiredField = (index: number, value: string) => {
    const updated = [...requiredFields];
    updated[index] = value;
    setRequiredFields(updated);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.templateName.trim()) {
      newErrors.templateName = 'Template title is required';
    }
    
    if (!formData.documentType.trim()) {
      newErrors.documentType = 'Document category type is required';
    }
    
    if (!formData.category) {
      newErrors.category = 'Please select a category';
    }
    
    if (!selectedFile) {
      newErrors.file = 'Please select a template file';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Please fix the errors before submitting');
      return;
    }

    if (!user) {
      toast.error('Please ensure you are logged in');
      return;
    }

    setIsUploading(true);

    try {
      // Get buyer profile using the hook
      const buyerData = await getBuyerProfile();

      if (!buyerData) {
        throw new Error('Buyer profile not found. Please complete your buyer profile setup first.');
      }

      // Upload file to storage
      const fileName = `${Date.now()}-${selectedFile.name}`;
      const filePath = `custom-templates/${buyerData.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('compliance-documents')
        .upload(filePath, selectedFile);

      if (uploadError) {
        console.error('Storage upload error:', { uploadError, message: uploadError.message });
        throw uploadError;
      }

      // Filter out empty required fields
      const filteredRequiredFields = requiredFields
        .map(field => field.trim())
        .filter(field => field.length > 0);

      // Save template metadata to database
      const { error: dbError } = await supabase
        .from('custom_document_templates')
        .insert({
          buyer_id: buyerData.id,
          template_name: formData.templateName,
          description: formData.description,
          document_type: formData.documentType,
          category: formData.category,
          file_path: filePath,
          file_name: selectedFile.name,
          file_size: selectedFile.size,
          mime_type: selectedFile.type,
          required_fields: filteredRequiredFields,
          created_by: user.id,
          expires_at: formData.expiresAt ? new Date(formData.expiresAt).toISOString() : null
        });

      if (dbError) {
        // Clean up uploaded file if database insert fails
        await supabase.storage
          .from('compliance-documents')
          .remove([filePath]);
        throw dbError;
      }

      toast.success('Custom template uploaded successfully');
      onSuccess();
      onClose();
      resetForm();
    } catch (error: any) {
      console.error('Error uploading template:', { error, message: error?.message });
      toast.error(error.message || 'Failed to upload template');
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      templateName: '',
      description: '',
      documentType: '',
      category: '',
      expiresAt: ''
    });
    setRequiredFields(['']);
    setSelectedFile(null);
    setErrors({});
  };

  const removeFile = () => {
    setSelectedFile(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Create Custom Template</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Upload a custom document template for your suppliers to complete
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Template Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-foreground">Template Information</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="templateName" className="text-sm font-medium">
                  Template Title *
                </Label>
                <Input
                  id="templateName"
                  value={formData.templateName}
                  onChange={(e) => setFormData({ ...formData, templateName: e.target.value })}
                  placeholder="e.g., Supplier Quality Assessment"
                  className={errors.templateName ? 'border-destructive' : ''}
                />
                {errors.templateName && (
                  <p className="text-sm text-destructive">{errors.templateName}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="documentType" className="text-sm font-medium">
                  Document Category Type *
                </Label>
                <Input
                  id="documentType"
                  value={formData.documentType}
                  onChange={(e) => setFormData({ ...formData, documentType: e.target.value })}
                  placeholder="e.g., Questionnaire, Checklist, Assessment"
                  className={errors.documentType ? 'border-destructive' : ''}
                />
                {errors.documentType && (
                  <p className="text-sm text-destructive">{errors.documentType}</p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category" className="text-sm font-medium">
              Template Category *
            </Label>
            <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
              <SelectTrigger className={errors.category ? 'border-destructive' : ''}>
                <SelectValue placeholder="Choose the compliance category" />
              </SelectTrigger>
              <SelectContent>
                {templateCategories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.category && (
              <p className="text-sm text-destructive">{errors.category}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium">
              Template Description
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the purpose, requirements, and what suppliers need to provide"
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Required Information Fields */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-foreground">Required Information Fields</h3>
            <p className="text-sm text-muted-foreground">
              Specify what information suppliers must provide when completing this template
            </p>
            
            <div className="space-y-3">
              {requiredFields.map((field, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={field}
                    onChange={(e) => updateRequiredField(index, e.target.value)}
                    placeholder={`Required field ${index + 1} (e.g., Company Registration Number)`}
                    className="flex-1"
                  />
                  {requiredFields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeRequiredField(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addRequiredField}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Another Required Field
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expiresAt" className="text-sm font-medium">
              Template Valid Until (Optional)
            </Label>
            <Input
              id="expiresAt"
              type="date"
              value={formData.expiresAt}
              onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
              min={new Date().toISOString().split('T')[0]}
            />
            <p className="text-xs text-muted-foreground">
              Leave empty if this template should never expire
            </p>
          </div>

          {/* File Upload Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-foreground">Template File</h3>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Upload Template File *</Label>
              {!selectedFile ? (
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200 ${
                    isDragActive 
                      ? 'border-primary bg-primary/5 scale-105' 
                      : errors.file 
                      ? 'border-destructive bg-destructive/5'
                      : 'border-muted-foreground/25 hover:border-primary hover:bg-primary/5'
                  }`}
                >
                  <input {...getInputProps()} />
                  <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium text-foreground mb-2">
                    {isDragActive ? 'Drop your template file here' : 'Upload Template File'}
                  </p>
                  <p className="text-sm text-muted-foreground mb-2">
                    Drag & drop or click to browse
                  </p>
                  <div className="flex flex-wrap justify-center gap-1 text-xs text-muted-foreground">
                    <Badge variant="secondary">PDF</Badge>
                    <Badge variant="secondary">DOC</Badge>
                    <Badge variant="secondary">DOCX</Badge>
                    <Badge variant="secondary">XLS</Badge>
                    <Badge variant="secondary">XLSX</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Maximum file size: 10MB
                  </p>
                </div>
              ) : (
                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <FileText className="h-8 w-8 text-primary" />
                      <div>
                        <p className="font-medium text-foreground">{selectedFile.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={removeFile}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
              
              {errors.file && (
                <p className="text-sm text-destructive">{errors.file}</p>
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={isUploading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isUploading} className="min-w-[140px]">
              {isUploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Creating...
                </>
              ) : (
                'Create Template'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};