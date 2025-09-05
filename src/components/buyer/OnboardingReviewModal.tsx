import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle, XCircle, FileText, Building2 } from 'lucide-react';
import { useOnboardingRequests } from '@/hooks/useOnboardingRequests';
import { supabase } from '@/integrations/supabase/client';

interface OnboardingReviewModalProps {
  request: any;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
}

export const OnboardingReviewModal: React.FC<OnboardingReviewModalProps> = ({
  request,
  onClose,
  onApprove,
  onReject
}) => {
  const [documentSubmissions, setDocumentSubmissions] = useState<any[]>([]);
  const [formResponses, setFormResponses] = useState<any[]>([]);
  const [branchSelections, setBranchSelections] = useState<any[]>([]);
  const [reviewNotes, setReviewNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const { getDocumentRequirements, getFormFields } = useOnboardingRequests();

  useEffect(() => {
    fetchOnboardingData();
  }, [request.id]);

  const fetchOnboardingData = async () => {
    try {
      setLoading(true);

      // Fetch document submissions
      const { data: submissions } = await supabase
        .from('onboarding_document_submissions')
        .select('*')
        .eq('onboarding_request_id', request.id);

      setDocumentSubmissions(submissions || []);

      // Fetch form responses
      const { data: responses } = await supabase
        .from('onboarding_form_responses')
        .select(`
          *,
          onboarding_form_fields (
            field_label,
            field_type,
            field_description
          )
        `)
        .eq('onboarding_request_id', request.id);

      setFormResponses(responses || []);

      // Fetch branch selections if applicable
      if (request.can_choose_branches) {
        const { data: branches } = await supabase
          .from('onboarding_branch_selections')
          .select(`
            *,
            company_branches (
              branch_name,
              location
            )
          `)
          .eq('onboarding_request_id', request.id);

        setBranchSelections(branches || []);
      }
    } catch (error) {
      console.error('Error fetching onboarding data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = () => {
    onApprove();
  };

  const handleReject = () => {
    onReject();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Review Onboarding: {request.supplier_company_name || request.supplier_email}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-8">
            <div className="text-muted-foreground">Loading onboarding data...</div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Supplier Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Email: </span>
                    {request.supplier_email}
                  </div>
                  <div>
                    <span className="font-medium">Company: </span>
                    {request.supplier_company_name || 'Not provided'}
                  </div>
                  <div>
                    <span className="font-medium">Status: </span>
                    <Badge className="ml-2">
                      {request.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                  <div>
                    <span className="font-medium">Submitted: </span>
                    {request.completed_at ? new Date(request.completed_at).toLocaleDateString() : 'Not completed'}
                  </div>
                </div>
                {request.custom_message && (
                  <div className="mt-4">
                    <span className="font-medium">Original Message: </span>
                    <p className="text-muted-foreground mt-1">{request.custom_message}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Branch Selections */}
            {request.can_choose_branches && branchSelections.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Selected Branches
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {branchSelections.map((selection) => (
                      <div key={selection.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <div className="font-medium">{selection.company_branches?.branch_name}</div>
                          <div className="text-sm text-muted-foreground">{selection.company_branches?.location}</div>
                        </div>
                        <Badge variant="outline">Selected</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Document Submissions */}
            {documentSubmissions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Document Submissions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {documentSubmissions.map((submission) => (
                      <div key={submission.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <div className="font-medium">{submission.document_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {submission.file_name} • {Math.round(submission.file_size / 1024)}KB
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Submitted: {new Date(submission.created_at).toLocaleString()}
                          </div>
                        </div>
                        <Button variant="outline" size="sm">
                          View Document
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Form Responses */}
            {formResponses.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Form Responses</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {formResponses.map((response) => (
                      <div key={response.id} className="border-b pb-4 last:border-b-0">
                        <div className="font-medium">{response.onboarding_form_fields?.field_label}</div>
                        {response.onboarding_form_fields?.field_description && (
                          <div className="text-sm text-muted-foreground mb-2">
                            {response.onboarding_form_fields.field_description}
                          </div>
                        )}
                        <div className="text-sm bg-gray-50 p-2 rounded">
                          {response.response_value || 'No response provided'}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Review Notes */}
            <Card>
              <CardHeader>
                <CardTitle>Review Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="review-notes">Add notes about this review (optional)</Label>
                  <Textarea
                    id="review-notes"
                    placeholder="Add any comments or feedback..."
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex items-center justify-end gap-4 pt-4 border-t">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                className="flex items-center gap-2"
              >
                <XCircle className="w-4 h-4" />
                Reject
              </Button>
              <Button
                onClick={handleApprove}
                className="flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Approve
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};