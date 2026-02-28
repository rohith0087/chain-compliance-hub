import React, { useState, useEffect, useRef } from 'react';
import logger from '@/utils/logger';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, CheckCircle, X, Download, AlertCircle, XCircle } from 'lucide-react';
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
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  is_document_available: boolean;
  unavailability_reason: string | null;
  created_at: string;
  status: string;
  rejection_reason: string | null;
  version: number;
  previous_submission_id: string | null;
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
  const [documentNotAvailable, setDocumentNotAvailable] = useState<{ [key: string]: boolean }>({});
  const [unavailabilityReasons, setUnavailabilityReasons] = useState<{ [key: string]: string }>({});
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Create refs for file inputs to trigger programmatically
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  useEffect(() => {
    fetchExistingSubmissions();
  }, [request.id]);

  // Effect to check completion when submissions change
  useEffect(() => {
    if (!isCompleted && documentRequirements.length > 0 && submissions.length > 0) {
      checkCompletion();
    }
  }, [submissions, documentRequirements, isCompleted]);

  const checkCompletion = () => {
    const requiredDocs = documentRequirements.filter(req => req.is_required);
    // Only count submissions that are NOT rejected
    const submittedRequiredDocs = submissions.filter(sub => 
      requiredDocs.some(req => req.id === sub.requirement_id) &&
      sub.status !== 'rejected'
    );

    logger.debug('Checking completion:', {
      requiredDocs: requiredDocs.length,
      submittedRequiredDocs: submittedRequiredDocs.length,
      allRequiredCompleted: submittedRequiredDocs.length >= requiredDocs.length
    });

    if (submittedRequiredDocs.length >= requiredDocs.length && submittedRequiredDocs.length > 0) {
      logger.debug('All documents completed, calling onComplete()');
      onComplete();
    }
  };

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

  // Function to trigger file selection
  const triggerFileSelect = (requirementId: string) => {
    logger.debug(`triggerFileSelect called for requirement ${requirementId}`);
    const input = fileInputRefs.current[requirementId];
    if (input) {
      logger.debug('Found input element, calling click()');
      input.click();
    } else {
      console.error(`🔴 DEBUG: No input found for requirement ${requirementId}`);
      logger.debug('Available refs:', Object.keys(fileInputRefs.current));
    }
  };

  const handleFileUpload = async (requirementId: string, documentName: string, file: File) => {
    logger.debug('handleFileUpload called', { requirementId, documentName, fileName: file?.name });
    
    if (!file) {
      console.error('🔴 DEBUG: No file selected');
      toast({
        title: "No File Selected",
        description: "Please select a file to upload",
        variant: "destructive"
      });
      return;
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      console.error(`🔴 DEBUG: File too large: ${file.size} bytes`);
      toast({
        title: "File Too Large",
        description: "File size must be less than 10MB",
        variant: "destructive"
      });
      return;
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf', 
      'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg', 
      'image/png', 
      'text/plain'
    ];
    if (!allowedTypes.includes(file.type)) {
      console.error(`🔴 DEBUG: Invalid file type: ${file.type}`);
      toast({
        title: "Invalid File Type",
        description: "Only PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, and TXT files are allowed",
        variant: "destructive"
      });
      return;
    }

    logger.debug('Starting file upload:', { 
      requirementId, 
      documentName, 
      fileName: file.name, 
      fileSize: file.size, 
      fileType: file.type,
      requestId: request.id
    });

    const fileExt = file.name.split('.').pop();
    const fileName = `${request.id}/${requirementId}/${Date.now()}.${fileExt}`;
    logger.debug(`Upload path will be: ${fileName}`);

    setUploading(requirementId);
    setUploadProgress({ ...uploadProgress, [requirementId]: 0 });

    try {
      logger.debug(`About to upload to storage with bucket: compliance-documents, path: ${fileName}`);
      
      // Upload file to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('compliance-documents')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });
      
      logger.debug('Storage upload result:', { uploadData, uploadError });
      setUploadProgress({ ...uploadProgress, [requirementId]: 100 });

      if (uploadError) {
        console.error('🔴 DEBUG: Storage upload failed:', uploadError);
        toast({
          title: "Upload Error",
          description: `Storage upload failed: ${uploadError.message}. This might be a permissions issue.`,
          variant: "destructive"
        });
        return;
      }

      logger.debug('Storage upload successful, saving to database...');
      
      // Check if this is a resubmission (replacing a rejected doc)
      const existingSubmission = submissions.find(s => s.requirement_id === requirementId);
      const isResubmission = existingSubmission && existingSubmission.status === 'rejected';
      
      const submissionData = {
        onboarding_request_id: request.id,
        requirement_id: requirementId,
        document_name: documentName,
        file_path: uploadData.path,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        submitted_by: user?.id,
        status: isResubmission ? 'resubmitted' : 'pending',
        version: isResubmission ? (existingSubmission.version || 1) + 1 : 1,
        previous_submission_id: isResubmission ? existingSubmission.id : null
      };
      logger.debug('Submission data:', submissionData);

      // If resubmission, we insert new record (to keep history)
      const { error: insertError } = await supabase
        .from('onboarding_document_submissions')
        .insert(submissionData);

      logger.debug('Database insert result:', { insertError });

      if (insertError) {
        console.error('🔴 DEBUG: Database insert failed:', insertError);
        // Clean up uploaded file
        await supabase.storage.from('compliance-documents').remove([uploadData.path]);
        toast({
          title: "Save Error", 
          description: `Database save failed: ${insertError.message}. This might be an RLS policy issue.`,
          variant: "destructive"
        });
        return;
      }

      // If resubmission, update request status back to under_review and clear rejection reason
      if (isResubmission) {
        await supabase
          .from('supplier_onboarding_requests')
          .update({ 
            status: 'under_review',
            rejection_reason: null 
          })
          .eq('id', request.id);
      }

      logger.debug('Success! Refreshing submissions...');
      await fetchExistingSubmissions();
      
      toast({
        title: "Success",
        description: `${documentName} uploaded successfully`
      });

      // Completion check will be handled by the useEffect
    } catch (error) {
      console.error('🔴 DEBUG: Unexpected error in handleFileUpload:', error);
      toast({
        title: "Error",
        description: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
    // Get the latest submission for this requirement
    const subs = submissions.filter(sub => sub.requirement_id === requirementId);
    if (subs.length === 0) return null;
    return subs.reduce((latest, current) => 
      new Date(current.created_at) > new Date(latest.created_at) ? current : latest
    );
  };

  const getDocStatusInfo = (submission: DocumentSubmission | null) => {
    if (!submission) return { color: 'gray', label: 'Not Uploaded', canResubmit: false };
    // Allow resubmit for rejected unavailable documents too
    if (submission.is_document_available === false) {
      return { color: 'orange', label: 'Unavailable', canResubmit: submission.status === 'rejected' };
    }
    
    switch (submission.status) {
      case 'approved': return { color: 'green', label: 'Approved', canResubmit: false };
      case 'rejected': return { color: 'red', label: 'Rejected', canResubmit: true };
      case 'resubmitted': return { color: 'blue', label: 'Resubmitted', canResubmit: false };
      default: return { color: 'amber', label: 'Pending Review', canResubmit: false };
    }
  };

  const handleDocumentUnavailable = async (requirementId: string, documentName: string) => {
    const reason = unavailabilityReasons[requirementId];
    
    if (!reason || reason.trim() === '') {
      toast({
        title: "Reason Required",
        description: "Please provide a reason why this document is not available",
        variant: "destructive"
      });
      return;
    }

    try {
      const submissionData = {
        onboarding_request_id: request.id,
        requirement_id: requirementId,
        document_name: documentName,
        is_document_available: false,
        unavailability_reason: reason,
        submitted_by: user?.id
      };

      const { error } = await supabase
        .from('onboarding_document_submissions')
        .insert(submissionData);

      if (error) {
        console.error('Error submitting unavailability:', error);
        toast({
          title: "Error",
          description: "Failed to submit document unavailability",
          variant: "destructive"
        });
        return;
      }

      await fetchExistingSubmissions();
      
      // Reset the form state
      setDocumentNotAvailable(prev => ({ ...prev, [requirementId]: false }));
      setUnavailabilityReasons(prev => ({ ...prev, [requirementId]: '' }));

      toast({
        title: "Success",
        description: `${documentName} marked as unavailable`
      });

      // Completion check will be handled by the useEffect
    } catch (error) {
      console.error('Error in handleDocumentUnavailable:', error);
      toast({
        title: "Error",
        description: "Failed to submit document unavailability",
        variant: "destructive"
      });
    }
  };

  const requiredSubmissions = documentRequirements.filter(req => req.is_required);
  // Only count as complete if submission exists AND is not rejected
  const completedRequired = requiredSubmissions.filter(req => {
    const sub = getSubmissionForRequirement(req.id);
    return sub && sub.status !== 'rejected';
  });
  const allRequiredCompleted = completedRequired.length === requiredSubmissions.length && requiredSubmissions.length > 0;

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

          const hasTemplate = requirement.template_file_path && requirement.template_file_name;

          return (
            <Card key={requirement.id} className={submission?.status === 'rejected' ? 'border-destructive' : ''}>
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
                        {hasTemplate && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            Template
                          </span>
                        )}
                        {submission && (
                          <Badge 
                            variant={
                              submission.status === 'approved' ? 'default' :
                              submission.status === 'rejected' ? 'destructive' :
                              submission.status === 'resubmitted' ? 'secondary' : 'outline'
                            }
                            className="text-xs"
                          >
                            {submission.status === 'approved' ? 'Approved' :
                             submission.status === 'rejected' ? 'Rejected - Resubmit Required' :
                             submission.status === 'resubmitted' ? 'Resubmitted' : 'Pending Review'}
                          </Badge>
                        )}
                      </div>
                      {requirement.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {requirement.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Show rejection reason if rejected */}
                  {submission?.status === 'rejected' && submission.rejection_reason && (
                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <XCircle className="w-4 h-4 text-destructive" />
                        <span className="text-sm font-medium text-destructive">Rejection Reason</span>
                      </div>
                      <p className="text-sm text-destructive/80">{submission.rejection_reason}</p>
                    </div>
                  )}

                  {/* Template Download Section */}
                  {hasTemplate && !submission && (
                    <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <FileText className="h-5 w-5 text-blue-600" />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-blue-800">
                          Download template, fill it out, and upload
                        </div>
                        <div className="text-xs text-blue-600">{requirement.template_file_name}</div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-white border-blue-300 text-blue-700 hover:bg-blue-100"
                        onClick={async () => {
                          try {
                            const { data, error } = await supabase.storage
                              .from('compliance-documents')
                              .createSignedUrl(requirement.template_file_path!, 300);
                            if (error) throw error;
                            if (data?.signedUrl) {
                              // Create a download link
                              const link = document.createElement('a');
                              link.href = data.signedUrl;
                              link.download = requirement.template_file_name || 'template';
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }
                          } catch (err: any) {
                            console.error('Error downloading template:', err);
                            toast({ 
                              title: 'Error', 
                              description: 'Unable to download template', 
                              variant: 'destructive' 
                            });
                          }
                        }}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download Template
                      </Button>
                    </div>
                  )}

                  {submission ? (
                    submission.is_document_available ? (
                      <div className={`flex items-center justify-between p-3 rounded-lg ${
                        submission.status === 'approved' ? 'bg-green-50' :
                        submission.status === 'rejected' ? 'bg-red-50' : 'bg-amber-50'
                      }`}>
                        <div className="flex items-center gap-2">
                          <FileText className={`w-4 h-4 ${
                            submission.status === 'approved' ? 'text-green-600' :
                            submission.status === 'rejected' ? 'text-red-600' : 'text-amber-600'
                          }`} />
                          <div>
                            <div className="text-sm font-medium">{submission.file_name}</div>
                            <div className="text-xs text-muted-foreground">
                              Uploaded on {new Date(submission.created_at).toLocaleDateString()}
                              {submission.version > 1 && <span className="ml-2 text-blue-600">v{submission.version}</span>}
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
                                  .createSignedUrl(submission.file_path!, 300);
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
                          {/* Allow resubmit for rejected documents */}
                          {submission.status === 'rejected' && !isCompleted && (
                            <Button 
                              variant="default" 
                              size="sm"
                              onClick={() => {
                                logger.debug(`Resubmit button clicked for ${requirement.id}`);
                                triggerFileSelect(requirement.id);
                              }}
                            >
                              <Upload className="w-3 h-3 mr-1" />
                              Resubmit
                            </Button>
                          )}
                          {/* Allow replace for pending/resubmitted (not approved or rejected) */}
                          {!isCompleted && (submission.status === 'pending' || submission.status === 'resubmitted') && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                logger.debug(`Replace button clicked for ${requirement.id}`);
                                triggerFileSelect(requirement.id);
                              }}
                            >
                              Replace
                            </Button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className={`p-3 border rounded-lg ${submission.status === 'rejected' ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle className={`w-4 h-4 ${submission.status === 'rejected' ? 'text-red-600' : 'text-orange-600'}`} />
                          <span className={`text-sm font-medium ${submission.status === 'rejected' ? 'text-red-800' : 'text-orange-800'}`}>
                            {submission.status === 'rejected' ? 'Document Rejected' : 'Document Not Available'}
                          </span>
                        </div>
                        {submission.status === 'rejected' && submission.rejection_reason && (
                          <div className="text-sm text-red-700 mb-2">
                            <span className="font-medium">Rejection Reason: </span>
                            {submission.rejection_reason}
                          </div>
                        )}
                        <div className={`text-sm mb-2 ${submission.status === 'rejected' ? 'text-red-700' : 'text-orange-700'}`}>
                          <span className="font-medium">Unavailability Reason: </span>
                          {submission.unavailability_reason}
                        </div>
                        <div className={`text-xs ${submission.status === 'rejected' ? 'text-red-600' : 'text-orange-600'}`}>
                          Submitted on {new Date(submission.created_at).toLocaleDateString()}
                        </div>
                        {/* Resubmit button for rejected unavailable documents */}
                        {submission.status === 'rejected' && !isCompleted && (
                          <Button 
                            variant="default" 
                            size="sm"
                            className="mt-3"
                            onClick={() => {
                              logger.debug(`Resubmit (unavailable) button clicked for ${requirement.id}`);
                              triggerFileSelect(requirement.id);
                            }}
                          >
                            <Upload className="w-3 h-3 mr-1" />
                            Upload Document
                          </Button>
                        )}
                      </div>
                    )
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
                        <div className="space-y-4">
                          {!documentNotAvailable[requirement.id] ? (
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                              <p className="text-sm font-medium mb-2">
                                {hasTemplate ? 'Upload completed template' : 'Upload document'}
                              </p>
                              <Button 
                                variant="outline"
                                disabled={isUploading}
                                onClick={() => {
                                  logger.debug(`Choose File button clicked for ${requirement.id}`);
                                  triggerFileSelect(requirement.id);
                                }}
                              >
                                {isUploading ? 'Uploading...' : 'Choose File'}
                              </Button>
                              <p className="text-xs text-muted-foreground mt-2">
                                Supported formats: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG (Max 10MB)
                              </p>
                              
                              <div className="mt-4 pt-4 border-t border-gray-200">
                                <div className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`unavailable-${requirement.id}`}
                                    checked={documentNotAvailable[requirement.id] || false}
                                    onCheckedChange={(checked) => {
                                      setDocumentNotAvailable(prev => ({
                                        ...prev,
                                        [requirement.id]: !!checked
                                      }));
                                    }}
                                  />
                                  <Label 
                                    htmlFor={`unavailable-${requirement.id}`}
                                    className="text-sm text-muted-foreground"
                                  >
                                    Document not available
                                  </Label>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="border border-orange-200 rounded-lg p-4 bg-orange-50">
                              <div className="flex items-center gap-2 mb-3">
                                <AlertCircle className="w-4 h-4 text-orange-600" />
                                <span className="text-sm font-medium text-orange-800">
                                  Document Not Available
                                </span>
                              </div>
                              
                              <div className="space-y-3">
                                <div>
                                  <Label htmlFor={`reason-${requirement.id}`} className="text-sm">
                                    Please explain why this document is not available:
                                  </Label>
                                  <Textarea
                                    id={`reason-${requirement.id}`}
                                    placeholder="Enter the reason for unavailability..."
                                    value={unavailabilityReasons[requirement.id] || ''}
                                    onChange={(e) => {
                                      setUnavailabilityReasons(prev => ({
                                        ...prev,
                                        [requirement.id]: e.target.value
                                      }));
                                    }}
                                    className="mt-1"
                                  />
                                </div>
                                
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleDocumentUnavailable(requirement.id, requirement.document_name)}
                                    disabled={!unavailabilityReasons[requirement.id]?.trim()}
                                  >
                                    Submit
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setDocumentNotAvailable(prev => ({
                                        ...prev,
                                        [requirement.id]: false
                                      }));
                                      setUnavailabilityReasons(prev => ({
                                        ...prev,
                                        [requirement.id]: ''
                                      }));
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {!isCompleted && (
                    <Input
                      ref={(el) => {
                        fileInputRefs.current[requirement.id] = el;
                        logger.debug(`Set ref for ${requirement.id}:`, !!el);
                      }}
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt"
                      className="hidden"
                      onChange={(e) => {
                        logger.debug(`File input onChange triggered for ${requirement.id}`);
                        const file = e.target.files?.[0];
                        if (file) {
                          logger.debug(`File selected:`, file.name, file.type, file.size);
                          handleFileUpload(requirement.id, requirement.document_name, file);
                        } else {
                          logger.debug(`No file selected in onChange`);
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
        <div className="space-y-4 pt-4">
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm">All required documents uploaded</span>
          </div>
          <Button 
            onClick={() => {
              logger.debug('Manual proceed button clicked');
              onComplete();
            }}
            className="w-full"
          >
            Proceed to Next Step
          </Button>
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