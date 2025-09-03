import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileText, X } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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
  const [formData, setFormData] = useState({
    templateName: '',
    description: '',
    documentType: '',
    category: '',
    requiredFields: '',
    expiresAt: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    },
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        setSelectedFile(acceptedFiles[0]);
      }
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFile || !user) {
      toast.error('Please select a file and ensure you are logged in');
      return;
    }

    if (!formData.templateName || !formData.category || !formData.documentType) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsUploading(true);

    try {
      // Get buyer profile
      const { data: buyerData, error: buyerError } = await supabase
        .from('buyers')
        .select('id')
        .eq('profile_id', user.id)
        .single();

      if (buyerError || !buyerData) {
        throw new Error('Buyer profile not found');
      }

      // Upload file to storage
      const fileName = `${Date.now()}-${selectedFile.name}`;
      const filePath = `custom-templates/${buyerData.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('compliance-documents')
        .upload(filePath, selectedFile);

      if (uploadError) {
        throw uploadError;
      }

      // Parse required fields if provided
      let requiredFieldsArray = [];
      if (formData.requiredFields.trim()) {
        requiredFieldsArray = formData.requiredFields
          .split(',')
          .map(field => field.trim())
          .filter(field => field.length > 0);
      }

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
          required_fields: requiredFieldsArray,
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
      console.error('Error uploading template:', error);
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
      requiredFields: '',
      expiresAt: ''
    });
    setSelectedFile(null);
  };

  const removeFile = () => {
    setSelectedFile(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Custom Template</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="templateName">Template Name *</Label>
              <Input
                id="templateName"
                value={formData.templateName}
                onChange={(e) => setFormData({ ...formData, templateName: e.target.value })}
                placeholder="Enter template name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="documentType">Document Type *</Label>
              <Input
                id="documentType"
                value={formData.documentType}
                onChange={(e) => setFormData({ ...formData, documentType: e.target.value })}
                placeholder="e.g., Questionnaire, Checklist"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category *</Label>
            <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {templateCategories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the purpose and requirements of this template"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="requiredFields">Required Fields (comma-separated)</Label>
            <Input
              id="requiredFields"
              value={formData.requiredFields}
              onChange={(e) => setFormData({ ...formData, requiredFields: e.target.value })}
              placeholder="e.g., Company Name, License Number, Expiry Date"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expiresAt">Template Expiry Date (optional)</Label>
            <Input
              id="expiresAt"
              type="date"
              value={formData.expiresAt}
              onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Template File *</Label>
            {!selectedFile ? (
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  isDragActive ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-primary'
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-lg font-medium text-gray-900 mb-2">
                  {isDragActive ? 'Drop your file here' : 'Upload template file'}
                </p>
                <p className="text-sm text-gray-500">
                  Supports PDF, DOC, DOCX, XLS, XLSX files up to 10MB
                </p>
              </div>
            ) : (
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <FileText className="h-8 w-8 text-blue-500" />
                    <div>
                      <p className="font-medium text-gray-900">{selectedFile.name}</p>
                      <p className="text-sm text-gray-500">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={removeFile}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isUploading}>
              {isUploading ? 'Uploading...' : 'Upload Template'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};