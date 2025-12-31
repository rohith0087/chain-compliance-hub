import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Building2, 
  CheckCircle2,
  Clock,
  Mail,
  Phone,
  MapPin,
  UserPlus,
  Send,
  Upload,
  FileText,
  AlertCircle
} from 'lucide-react';
import { useSimulation } from '@/contexts/SimulationContext';
import { formatDistanceToNow } from 'date-fns';

export const SimulationConnectionsPage = () => {
  const [activeTab, setActiveTab] = useState('all');
  const { 
    pendingConnectionRequest,
    connectedBuyers,
    acceptConnection,
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

  const onboardingRequest = getOnboardingRequest();
  const documentRequirements = getDocumentRequirements();
  const formFields = getFormFields();

  // Calculate onboarding progress
  const totalRequirements = documentRequirements.length + formFields.length;
  const completedRequirements = uploadedOnboardingDocs.length + completedFormFields.length;
  const progressPercent = totalRequirements > 0 
    ? Math.round((completedRequirements / totalRequirements) * 100) 
    : 0;

  const allDocsUploaded = uploadedOnboardingDocs.length >= documentRequirements.length;
  const allFieldsCompleted = completedFormFields.length >= formFields.length;
  const canSubmitOnboarding = allDocsUploaded && allFieldsCompleted;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Buyer Connections
            <Badge variant="outline" className="text-xs">Demo Data</Badge>
          </h1>
          <p className="text-muted-foreground">Manage your buyer relationships</p>
        </div>
        <Button variant="outline" className="gap-2">
          <UserPlus className="h-4 w-4" />
          Request Connection
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">
            Pending
            {pendingConnectionRequest && (
              <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 justify-center">
                1
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="connected">Connected</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6 space-y-4">
          {/* Pending Connection Request */}
          {pendingConnectionRequest && (activeTab === 'all' || activeTab === 'pending') && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="border-blue-200 bg-gradient-to-r from-blue-50/50 to-indigo-50/50">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-lg bg-blue-100">
                        <Building2 className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {pendingConnectionRequest.buyer.company_name}
                          <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                            <Clock className="h-3 w-3 mr-1" />
                            Pending Request
                          </Badge>
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {pendingConnectionRequest.buyer.industry}
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      {pendingConnectionRequest.buyer.contact_email}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      {pendingConnectionRequest.buyer.phone}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      {pendingConnectionRequest.buyer.city}, {pendingConnectionRequest.buyer.state}
                    </div>
                  </div>
                  
                  {pendingConnectionRequest.notes && (
                    <div className="p-3 bg-white/50 rounded-lg border border-blue-100">
                      <p className="text-sm text-muted-foreground italic">
                        "{pendingConnectionRequest.notes}"
                      </p>
                    </div>
                  )}
                  
                  <div className="flex gap-3">
                    <Button 
                      onClick={acceptConnection}
                      className="gap-2 bg-blue-600 hover:bg-blue-700"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Accept Connection
                    </Button>
                    <Button variant="outline" className="gap-2">
                      Decline
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Connected Buyers with Onboarding */}
          {connectedBuyers.map((connection, index) => (
            <motion.div
              key={connection.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className={
                connection.unifiedStatus === 'onboardingPending' 
                  ? 'border-amber-200 bg-gradient-to-r from-amber-50/50 to-orange-50/50'
                  : 'border-green-200 bg-gradient-to-r from-green-50/50 to-emerald-50/50'
              }>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-lg ${
                        connection.unifiedStatus === 'fullyConnected' 
                          ? 'bg-green-100' 
                          : 'bg-amber-100'
                      }`}>
                        <Building2 className={`h-6 w-6 ${
                          connection.unifiedStatus === 'fullyConnected' 
                            ? 'text-green-600' 
                            : 'text-amber-600'
                        }`} />
                      </div>
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {connection.buyers.company_name}
                          {connection.unifiedStatus === 'fullyConnected' ? (
                            <Badge className="bg-green-100 text-green-700 border-green-200">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Connected
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Onboarding Required
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {connection.buyers.industry}
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                {/* Onboarding Section */}
                {connection.unifiedStatus === 'onboardingPending' && (
                  <CardContent className="space-y-6 border-t pt-6">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">Onboarding Progress</h4>
                        <span className="text-sm text-muted-foreground">{progressPercent}%</span>
                      </div>
                      <Progress value={progressPercent} className="h-2" />
                    </div>

                    {/* Document Requirements */}
                    <div className="space-y-3">
                      <h4 className="font-medium flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Required Documents
                      </h4>
                      <div className="grid gap-2">
                        {documentRequirements.map((doc) => {
                          const isUploaded = uploadedOnboardingDocs.includes(doc.id);
                          return (
                            <div 
                              key={doc.id}
                              className={`flex items-center justify-between p-3 rounded-lg border ${
                                isUploaded ? 'bg-green-50 border-green-200' : 'bg-white'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                {isUploaded ? (
                                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                                ) : (
                                  <Clock className="h-5 w-5 text-muted-foreground" />
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
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Form Fields */}
                    <div className="space-y-3">
                      <h4 className="font-medium flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Required Information
                      </h4>
                      <div className="grid gap-2">
                        {formFields.map((field) => {
                          const isCompleted = completedFormFields.includes(field.id);
                          return (
                            <div 
                              key={field.id}
                              className={`flex items-center justify-between p-3 rounded-lg border ${
                                isCompleted ? 'bg-green-50 border-green-200' : 'bg-white'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                {isCompleted ? (
                                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                                ) : (
                                  <Clock className="h-5 w-5 text-muted-foreground" />
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
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Submit Button */}
                    {onboardingStatus === 'submitted' ? (
                      <div className="text-center py-4">
                        <Send className="h-8 w-8 mx-auto text-blue-500 animate-pulse mb-2" />
                        <p className="text-muted-foreground">Waiting for buyer approval...</p>
                      </div>
                    ) : onboardingStatus === 'approved' ? (
                      <div className="text-center py-4">
                        <CheckCircle2 className="h-8 w-8 mx-auto text-green-500 mb-2" />
                        <p className="text-green-600 font-medium">Onboarding Approved!</p>
                      </div>
                    ) : (
                      <Button 
                        onClick={submitOnboarding}
                        disabled={!canSubmitOnboarding}
                        className="w-full gap-2"
                      >
                        <Send className="h-4 w-4" />
                        Submit Onboarding
                      </Button>
                    )}
                  </CardContent>
                )}
                
                {/* Fully Connected */}
                {connection.unifiedStatus === 'fullyConnected' && (
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-4 w-4" />
                        {connection.buyers.contact_email}
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        {connection.buyers.phone}
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        {connection.buyers.city}, {connection.buyers.state}
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            </motion.div>
          ))}

          {/* Empty State */}
          {!pendingConnectionRequest && connectedBuyers.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Connections Yet</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  You don't have any buyer connections. Request a connection or wait for buyers to reach out.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
