import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Eye, Upload, FileText, Calendar, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useDropzone } from 'react-dropzone';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface CustomTemplate {
  id: string;
  template_name: string;
  description: string;
  document_type: string;
  category: string;
  file_path: string;
  file_name: string;
  required_fields: string[];
}

interface DocumentRequest {
  id: string;
  title: string;
  description: string;
  due_date: string;
  status: string;
  custom_template_id: string;
  template: CustomTemplate;
}

interface TemplateSubmission {
  id: string;
  status: string;
  submission_file_path?: string;
  submission_file_name?: string;
  submitted_at?: string;
  reviewer_notes?: string;
}

interface CustomTemplateResponseProps {
  request: DocumentRequest;
  onSubmissionComplete: () => void;
}

export const CustomTemplateResponse = ({ request, onSubmissionComplete }: CustomTemplateResponseProps) => {
  const { user } = useAuth();
  const [submission, setSubmission] = useState<TemplateSubmission | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [submissionNotes, setSubmissionNotes] = useState('');

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'image/*': ['.png', '.jpg', '.jpeg']
    },
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        setSelectedFile(acceptedFiles[0]);
      }
    }
  });

  useEffect(() => {
    if (request.custom_template_id) {
      fetchExistingSubmission();
    }
  }, [request.custom_template_id]);

  const fetchExistingSubmission = async () => {
    try {
      setIsLoading(true);

      // Get supplier ID
      const { data: supplierData, error: supplierError } = await supabase
        .from('suppliers')
        .select('id')
        .eq('profile_id', user?.id)
        .single();

      if (supplierError || !supplierData) {
        throw new Error('Supplier profile not found');
      }

      // Check for existing submission
      const { data, error } = await supabase
        .from('template_submissions')
        .select('*')
        .eq('request_id', request.id)
        .eq('supplier_id', supplierData.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setSubmission(data);
    } catch (error: any) {
      console.error('Error fetching submission:', error);
      toast.error('Failed to fetch submission status');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const { data, error } = await supabase.storage
        .from('compliance-documents')
        .download(request.template.file_path);

      if (error) {
        throw error;
      }

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = request.template.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Template downloaded');
    } catch (error: any) {
      console.error('Error downloading template:', error);
      toast.error('Failed to download template');
    }
  };

  const handlePreviewTemplate = async () => {
    try {
      const { data, error } = await supabase.storage
        .from('compliance-documents')
        .createSignedUrl(request.template.file_path, 60);

      if (error) {
        throw error;
      }

      window.open(data.signedUrl, '_blank');
    } catch (error: any) {
      console.error('Error previewing template:', error);
      toast.error('Failed to preview template');
    }
  };

  const handleSubmitResponse = async () => {
    if (!selectedFile || !user) {
      toast.error('Please select a file to upload');
      return;
    }

    setIsSubmitting(true);

    try {
      // Get supplier ID
      const { data: supplierData, error: supplierError } = await supabase
        .from('suppliers')
        .select('id')
        .eq('profile_id', user.id)
        .single();

      if (supplierError || !supplierData) {
        throw new Error('Supplier profile not found');
      }

      // Upload response file
      const fileName = `${Date.now()}-${selectedFile.name}`;
      const filePath = `template-submissions/${request.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('compliance-documents')
        .upload(filePath, selectedFile);

      if (uploadError) {
        throw uploadError;
      }

      // Create or update submission record
      const submissionData = {
        template_id: request.custom_template_id,
        request_id: request.id,
        supplier_id: supplierData.id,
        submission_file_path: filePath,
        submission_file_name: selectedFile.name,
        submission_file_size: selectedFile.size,
        submission_mime_type: selectedFile.type,
        submission_type: 'upload',
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        form_data: submissionNotes ? { notes: submissionNotes } : {}
      };

      if (submission) {
        // Update existing submission
        const { error: updateError } = await supabase
          .from('template_submissions')
          .update(submissionData)
          .eq('id', submission.id);

        if (updateError) {
          throw updateError;
        }
      } else {
        // Create new submission
        const { error: insertError } = await supabase
          .from('template_submissions')
          .insert(submissionData);

        if (insertError) {
          throw insertError;
        }
      }

      // Update document request status
      await supabase
        .from('document_requests')
        .update({ status: 'submitted' })
        .eq('id', request.id);

      toast.success('Response submitted successfully');
      onSubmissionComplete();
      setIsUploadModalOpen(false);
      setSelectedFile(null);
      setSubmissionNotes('');
      fetchExistingSubmission();
    } catch (error: any) {
      console.error('Error submitting response:', error);
      toast.error(error.message || 'Failed to submit response');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted':
        return 'bg-blue-100 text-blue-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'revision_requested':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const isOverdue = new Date(request.due_date) < new Date();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {request.template.template_name}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Custom template: {request.template.document_type}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{request.template.category}</Badge>
              {submission && (
                <Badge className={getStatusColor(submission.status)}>
                  {submission.status.replace('_', ' ').toUpperCase()}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {request.template.description && (
            <p className="text-sm text-muted-foreground">
              {request.template.description}
            </p>
          )}

          {request.template.required_fields && request.template.required_fields.length > 0 && (
            <div>
              <Label className="text-sm font-medium">Required Information:</Label>
              <ul className="text-sm text-muted-foreground mt-1 list-disc list-inside">
                {request.template.required_fields.map((field, index) => (
                  <li key={index}>{field}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>Due: {new Date(request.due_date).toLocaleDateString()}</span>
            {isOverdue && (
              <Badge variant="destructive" className="ml-2">
                <AlertCircle className="h-3 w-3 mr-1" />
                Overdue
              </Badge>
            )}
          </div>

          {submission && submission.reviewer_notes && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <Label className="text-sm font-medium text-yellow-800">Reviewer Notes:</Label>
              <p className="text-sm text-yellow-700 mt-1">{submission.reviewer_notes}</p>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePreviewTemplate}>
              <Eye className="h-4 w-4 mr-2" />
              Preview Template
            </Button>
            <Button variant="outline" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
            <Button
              onClick={() => setIsUploadModalOpen(true)}
              disabled={submission?.status === 'approved'}
            >
              <Upload className="h-4 w-4 mr-2" />
              {submission ? 'Update Response' : 'Submit Response'}
            </Button>
          </div>

          {submission && submission.submitted_at && (
            <p className="text-xs text-muted-foreground">
              {submission.status === 'submitted' ? 'Submitted' : 'Last updated'}: {' '}
              {new Date(submission.submitted_at).toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {submission ? 'Update Response' : 'Submit Response'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Upload your completed document</Label>
              {!selectedFile ? (
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                    isDragActive ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-primary'
                  }`}
                >
                  <input {...getInputProps()} />
                  <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-sm font-medium text-gray-900 mb-1">
                    {isDragActive ? 'Drop your file here' : 'Upload completed document'}
                  </p>
                  <p className="text-xs text-gray-500">
                    PDF, DOC, DOCX, XLS, XLSX, or image files
                  </p>
                </div>
              ) : (
                <div className="border rounded-lg p-3">
                  <div className="flex items-center space-x-3">
                    <FileText className="h-6 w-6 text-blue-500" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                      <p className="text-xs text-gray-500">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedFile(null)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes (optional)</Label>
              <Textarea
                id="notes"
                value={submissionNotes}
                onChange={(e) => setSubmissionNotes(e.target.value)}
                placeholder="Add any additional information or notes about your submission"
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsUploadModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitResponse}
                disabled={!selectedFile || isSubmitting}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Response'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};