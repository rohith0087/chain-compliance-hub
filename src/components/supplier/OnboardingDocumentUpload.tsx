import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, CheckCircle, X, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface OnboardingDocumentUploadProps {
  request: any;
  documentRequirements: any[];
  onComplete: () => void;
  isCompleted: boolean;
}

interface DocumentSubmission {
  id: string;
  requirement_id: string;
  document_name: string;
  file_path: string;
  file_name: string;
  file_size: number;
  created_at: string;
}

export const OnboardingDocumentUpload: React.FC<OnboardingDocumentUploadProps> = ({
  request,
  documentRequirements,
  onComplete,
  isCompleted
}) => {
  const [submissions, setSubmissions] = useState<DocumentSubmission[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchExistingSubmissions();
  }, [request.id]);

  const fetchExistingSubmissions = async () => {
    try {
      const { data, error } = await supabase
        .from('onboarding_document_submissions')
        .select('*')
        .eq('onboarding_request_id', request.id);

      if (error) {
        console.error('Error fetching submissions:', error);
        return;
      }

      setSubmissions(data || []);
    } catch (error) {
      console.error('Error in fetchExistingSubmissions:', error);
    }
  };

  const handleFileUpload = async (requirementId: string, documentName: string, file: File) => {
    if (!file) {
      console.error('No file selected');
      return;
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast({
        title: "File Too Large",
        description: "File size must be less than 10MB",
        variant: "destructive"
      });
      return;
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png', 'text/plain'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid File Type",
        description: "Only PDF, DOC, DOCX, JPG, PNG, and TXT files are allowed",
        variant: "destructive"
      });
      return;
    }

    console.log('Starting file upload:', { requirementId, documentName, fileName: file.name, fileSize: file.size, fileType: file.type });

    const fileExt = file.name.split('.').pop();
    const fileName = `${request.id}/${requirementId}/${Date.now()}.${fileExt}`;

    setUploading(requirementId);
    setUploadProgress({ ...uploadProgress, [requirementId]: 0 });

    try {
      // Upload file to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('compliance-documents')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });
      
      setUploadProgress({ ...uploadProgress, [requirementId]: 100 });

      if (uploadError) {
        console.error('Error uploading file:', uploadError);
        toast({
          title: "Upload Error",
          description: uploadError.message || "Failed to upload file",
          variant: "destructive"
        });
        return;
      }

      // Save submission record
      const { error: insertError } = await supabase
        .from('onboarding_document_submissions')
        .insert({
          onboarding_request_id: request.id,
          requirement_id: requirementId,
          document_name: documentName,
          file_path: uploadData.path,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          submitted_by: user?.id
        });

      if (insertError) {
        console.error('Error saving submission:', insertError);
        // Clean up uploaded file
        await supabase.storage.from('compliance-documents').remove([uploadData.path]);
        toast({
          title: "Save Error",
          description: insertError.message || "Failed to save submission record",
          variant: "destructive"
        });
        return;
      }

      await fetchExistingSubmissions();
      
      toast({
        title: "Success",
        description: `${documentName} uploaded successfully`
      });

      // Check if all required documents are uploaded
      const requiredDocs = documentRequirements.filter(req => req.is_required);
      const currentSubmissions = await fetchCurrentSubmissions();
      const submittedRequiredDocs = currentSubmissions.filter(sub => 
        requiredDocs.some(req => req.id === sub.requirement_id)
      );

      if (submittedRequiredDocs.length >= requiredDocs.length) {
        onComplete();
      }
    } catch (error) {
      console.error('Error in handleFileUpload:', error);
      toast({
        title: "Error",
        description: "Failed to upload document",
        variant: "destructive"
      });
    } finally {
      setUploading(null);
      setUploadProgress({ ...uploadProgress, [requirementId]: 0 });
    }
  };

  const fetchCurrentSubmissions = async () => {
    const { data, error } = await supabase
      .from('onboarding_document_submissions')
      .select('*')
      .eq('onboarding_request_id', request.id);
    
    if (error) {
      console.error('Error fetching current submissions:', error);
      return [];
    }
    
    return data || [];
  };

  const getSubmissionForRequirement = (requirementId: string) => {
    return submissions.find(sub => sub.requirement_id === requirementId);
  };

  const requiredSubmissions = documentRequirements.filter(req => req.is_required);
  const completedRequired = requiredSubmissions.filter(req => getSubmissionForRequirement(req.id));
  const allRequiredCompleted = completedRequired.length === requiredSubmissions.length;

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Upload the required documents. All required documents must be submitted to complete this step.
      </div>

      <div className="text-sm">
        <span className="font-medium">Progress: </span>
        {completedRequired.length} of {requiredSubmissions.length} required documents uploaded
      </div>

      <div className="space-y-4">
        {documentRequirements.map((requirement) => {
          const submission = getSubmissionForRequirement(requirement.id);
          const isUploading = uploading === requirement.id;
          const progress = uploadProgress[requirement.id] || 0;

          return (
            <Card key={requirement.id}>
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{requirement.document_name}</h4>
                        {requirement.is_required && (
                          <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                            Required
                          </span>
                        )}
                        {submission && (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        )}
                      </div>
                      {requirement.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {requirement.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {submission ? (
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-green-600" />
                        <div>
                          <div className="text-sm font-medium">{submission.file_name}</div>
                          <div className="text-xs text-muted-foreground">
                            Uploaded on {new Date(submission.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-2"
                          onClick={async () => {
                            try {
                              const { data, error } = await supabase.storage
                                .from('compliance-documents')
                                .createSignedUrl(submission.file_path, 300);
                              if (error) {
                                throw error;
                              }
                              window.open(data.signedUrl, '_blank');
                            } catch (err: any) {
                              console.error('Error opening file:', err);
                              toast({ title: 'Error', description: err.message || 'Unable to open file', variant: 'destructive' });
                            }
                          }}
                        >
                          <Download className="w-3 h-3" />
                          View
                        </Button>
                        {!isCompleted && (
                          <Label htmlFor={`file-${requirement.id}`} className="cursor-pointer">
                            <Button variant="outline" size="sm" asChild>
                              <span>Replace</span>
                            </Button>
                          </Label>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {isUploading && (
                        <div className="space-y-2">
                          <Progress value={progress} className="w-full" />
                          <div className="text-xs text-muted-foreground">
                            Uploading... {progress}%
                          </div>
                        </div>
                      )}
                      
                      {!isCompleted && (
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                          <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                          <Label htmlFor={`file-${requirement.id}`} className="cursor-pointer">
                            <Button variant="outline" disabled={isUploading}>
                              {isUploading ? 'Uploading...' : 'Choose File'}
                            </Button>
                          </Label>
                          <p className="text-xs text-muted-foreground mt-2">
                            Supported formats: PDF, DOC, DOCX, JPG, PNG (Max 10MB)
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {!isCompleted && (
                    <Input
                      id={`file-${requirement.id}`}
                      type="file"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          console.log('File selected:', file.name, file.type, file.size);
                          handleFileUpload(requirement.id, requirement.document_name, file);
                        } else {
                          console.log('No file selected');
                        }
                        // Reset the input to allow selecting the same file again
                        e.target.value = '';
                      }}
                      disabled={isUploading}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {allRequiredCompleted && !isCompleted && (
        <div className="flex items-center gap-2 text-green-600 pt-4">
          <CheckCircle className="w-4 h-4" />
          <span className="text-sm">All required documents uploaded</span>
        </div>
      )}

      {isCompleted && (
        <div className="flex items-center gap-2 text-green-600 pt-4">
          <CheckCircle className="w-4 h-4" />
          <span className="text-sm">Document upload completed</span>
        </div>
      )}
    </div>
  );
};