import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, Upload, Building2, FileText, Send } from 'lucide-react';
import { useOnboardingRequests } from '@/hooks/useOnboardingRequests';
import { OnboardingBranchSelection } from './OnboardingBranchSelection';
import { OnboardingDocumentUpload } from './OnboardingDocumentUpload';
import { OnboardingFormCompletion } from './OnboardingFormCompletion';
import { useToast } from '@/hooks/use-toast';

interface OnboardingProcessProps {
  request: any;
  onComplete?: () => void;
}

export const OnboardingProcess: React.FC<OnboardingProcessProps> = ({
  request,
  onComplete
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [documentRequirements, setDocumentRequirements] = useState<any[]>([]);
  const [formFields, setFormFields] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { getDocumentRequirements, getFormFields, updateRequestStatus } = useOnboardingRequests();
  const { toast } = useToast();

  useEffect(() => {
    fetchRequirements();
  }, [request.id]);

  const fetchRequirements = async () => {
    try {
      setLoading(true);
      const [docReqs, formFieldsData] = await Promise.all([
        getDocumentRequirements(request.id),
        getFormFields(request.id)
      ]);
      setDocumentRequirements(docReqs);
      setFormFields(formFieldsData);
    } catch (error) {
      console.error('Error fetching requirements:', error);
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    ...(request.can_choose_branches ? [{
      id: 'branches',
      title: 'Select Branches',
      description: 'Choose which branches you want to supply to',
      icon: Building2,
      component: OnboardingBranchSelection
    }] : []),
    ...(documentRequirements.length > 0 ? [{
      id: 'documents',
      title: 'Upload Documents',
      description: `Upload ${documentRequirements.length} required documents`,
      icon: Upload,
      component: OnboardingDocumentUpload
    }] : []),
    ...(formFields.length > 0 ? [{
      id: 'forms',
      title: 'Complete Forms',
      description: `Fill out ${formFields.length} form fields`,
      icon: FileText,
      component: OnboardingFormCompletion
    }] : [])
  ];

  const progress = (completedSteps.length / steps.length) * 100;

  const handleStepComplete = (stepIndex: number) => {
    if (!completedSteps.includes(stepIndex)) {
      setCompletedSteps([...completedSteps, stepIndex]);
    }
    
    // Move to next step if available
    if (stepIndex < steps.length - 1) {
      setCurrentStep(stepIndex + 1);
    }
  };

  const handleSubmitForReview = async () => {
    try {
      await updateRequestStatus(request.id, 'under_review');
      toast({
        title: "Success",
        description: "Onboarding submitted for review"
      });
      onComplete?.();
    } catch (error) {
      console.error('Error submitting for review:', error);
      toast({
        title: "Error",
        description: "Failed to submit onboarding for review",
        variant: "destructive"
      });
    }
  };

  const isAllStepsCompleted = completedSteps.length === steps.length;

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="text-muted-foreground">Loading onboarding requirements...</div>
      </div>
    );
  }

  if (steps.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <div className="text-muted-foreground mb-4">No onboarding steps required</div>
          <Button onClick={handleSubmitForReview}>
            <Send className="w-4 h-4 mr-2" />
            Submit for Review
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Onboarding Progress</CardTitle>
              <p className="text-muted-foreground">
                Complete all steps to finish your onboarding
              </p>
            </div>
            <Badge variant="outline">
              {completedSteps.length} of {steps.length} completed
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Progress value={progress} className="w-full" />
            <div className="text-sm text-muted-foreground">
              {Math.round(progress)}% complete
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Steps */}
      <div className="space-y-4">
        {steps.map((step, index) => {
          const isCompleted = completedSteps.includes(index);
          const isCurrent = currentStep === index;
          const isAccessible = index === 0 || completedSteps.includes(index - 1);
          const StepIcon = step.icon;
          const StepComponent = step.component;

          return (
            <Card key={step.id} className={`${isCurrent ? 'border-primary' : ''}`}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${
                    isCompleted ? 'bg-green-100 text-green-600' :
                    isCurrent ? 'bg-primary/10 text-primary' :
                    'bg-gray-100 text-gray-400'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <StepIcon className="w-5 h-5" />
                    )}
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg">{step.title}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                  {isCompleted && (
                    <Badge className="bg-green-100 text-green-800">
                      Completed
                    </Badge>
                  )}
                  {isCurrent && !isCompleted && (
                    <Badge>
                      In Progress
                    </Badge>
                  )}
                </div>
              </CardHeader>
              {(isCurrent || isCompleted) && isAccessible && (
                <CardContent>
                  <StepComponent
                    request={request}
                    {...(step.id === 'documents' && { documentRequirements })}
                    {...(step.id === 'forms' && { formFields })}
                    onComplete={() => handleStepComplete(index)}
                    isCompleted={isCompleted}
                  />
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Submit for Review */}
      {isAllStepsCompleted && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="py-6">
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mx-auto">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-green-800">All Steps Completed!</h3>
                <p className="text-sm text-green-700">
                  You've completed all onboarding requirements. Submit for buyer review.
                </p>
              </div>
              <Button
                onClick={handleSubmitForReview}
                className="bg-green-600 hover:bg-green-700"
              >
                <Send className="w-4 h-4 mr-2" />
                Submit for Review
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};