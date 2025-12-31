import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  FileText, 
  Upload, 
  CheckCircle2, 
  Circle,
  ClipboardList,
  Send,
  Building2
} from 'lucide-react';
import { useSimulation } from '@/contexts/SimulationContext';
import { motion } from 'framer-motion';

export const SimulationOnboarding = () => {
  const { 
    connectionStatus,
    onboardingStatus,
    getOnboardingRequest,
    getDocumentRequirements,
    getFormFields,
    uploadOnboardingDocument,
    completeFormField,
    submitOnboarding,
    uploadedOnboardingDocs,
    completedFormFields,
  } = useSimulation();

  // Only show when in onboarding phase
  if (connectionStatus === 'pending' || connectionStatus === 'active') {
    return null;
  }

  const onboardingRequest = getOnboardingRequest();
  const documentRequirements = getDocumentRequirements();
  const formFields = getFormFields();

  const totalDocs = documentRequirements.length;
  const uploadedDocs = uploadedOnboardingDocs.length;
  const totalFields = formFields.length;
  const completedFields = completedFormFields.length;
  
  const docsComplete = uploadedDocs >= totalDocs;
  const formsComplete = completedFields >= totalFields;
  const canSubmit = docsComplete && formsComplete && onboardingStatus !== 'submitted' && onboardingStatus !== 'approved';

  const overallProgress = Math.round(
    ((uploadedDocs + completedFields) / (totalDocs + totalFields)) * 100
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Header Card */}
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">
                  Onboarding: {onboardingRequest.buyer.company_name}
                </CardTitle>
                <CardDescription>
                  Complete the requirements below to finish onboarding
                </CardDescription>
              </div>
            </div>
            <Badge 
              variant={onboardingStatus === 'approved' ? 'default' : 'secondary'}
              className={onboardingStatus === 'approved' ? 'bg-emerald-500' : ''}
            >
              {onboardingStatus === 'approved' ? 'Approved' : 
               onboardingStatus === 'submitted' ? 'Under Review' : 'In Progress'}
            </Badge>
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-sm text-muted-foreground mb-1">
              <span>Overall Progress</span>
              <span>{overallProgress}%</span>
            </div>
            <Progress value={overallProgress} className="h-2" />
          </div>
        </CardHeader>
      </Card>

      {/* Documents Section */}
      <Card className="simulation-onboarding-docs">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Required Documents</CardTitle>
            <Badge variant="outline" className="ml-auto">
              {uploadedDocs}/{totalDocs}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {documentRequirements.map((doc, index) => {
            const isUploaded = uploadedOnboardingDocs.includes(doc.id);
            return (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  isUploaded ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-muted/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  {isUploaded ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div>
                    <p className="font-medium text-sm">{doc.document_name}</p>
                    <p className="text-xs text-muted-foreground">{doc.description}</p>
                  </div>
                </div>
                {!isUploaded && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => uploadOnboardingDocument(doc.id)}
                    className="gap-1"
                  >
                    <Upload className="h-3 w-3" />
                    Upload
                  </Button>
                )}
              </motion.div>
            );
          })}
        </CardContent>
      </Card>

      {/* Form Fields Section */}
      <Card className="simulation-onboarding-form">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Company Information</CardTitle>
            <Badge variant="outline" className="ml-auto">
              {completedFields}/{totalFields}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {formFields.map((field, index) => {
            const isCompleted = completedFormFields.includes(field.id);
            return (
              <motion.div
                key={field.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  isCompleted ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-muted/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div>
                    <p className="font-medium text-sm">{field.field_label}</p>
                    <p className="text-xs text-muted-foreground">{field.field_description}</p>
                  </div>
                </div>
                {!isCompleted && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => completeFormField(field.id)}
                  >
                    Fill
                  </Button>
                )}
              </motion.div>
            );
          })}
        </CardContent>
      </Card>

      {/* Submit Section */}
      <Card className={`simulation-submit-onboarding ${canSubmit ? 'border-primary/30' : ''}`}>
        <CardContent className="pt-6">
          <div className="text-center space-y-3">
            {onboardingStatus === 'approved' ? (
              <>
                <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
                <p className="font-medium text-emerald-600">Onboarding Approved!</p>
                <p className="text-sm text-muted-foreground">
                  You're now fully connected with {onboardingRequest.buyer.company_name}
                </p>
              </>
            ) : onboardingStatus === 'submitted' ? (
              <>
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Send className="h-6 w-6 text-primary animate-pulse" />
                </div>
                <p className="font-medium">Onboarding Submitted</p>
                <p className="text-sm text-muted-foreground">
                  Waiting for buyer approval...
                </p>
              </>
            ) : (
              <>
                <p className="text-muted-foreground text-sm">
                  {canSubmit 
                    ? 'All requirements complete! Submit your onboarding for review.'
                    : 'Complete all documents and forms above to submit.'
                  }
                </p>
                <Button 
                  onClick={submitOnboarding}
                  disabled={!canSubmit}
                  className="gap-2"
                  size="lg"
                >
                  <Send className="h-4 w-4" />
                  Submit for Review
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
