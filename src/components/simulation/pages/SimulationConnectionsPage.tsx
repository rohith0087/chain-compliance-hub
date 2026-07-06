import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
  AlertCircle,
  Download,
  Info,
  ArrowRight,
  Loader2
} from 'lucide-react';
import { useSimulation } from '@/contexts/SimulationContext';
import { formatDistanceToNow } from 'date-fns';

export const SimulationConnectionsPage = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [buyerIdInput, setBuyerIdInput] = useState('');
  const { 
    currentStep,
    pendingConnectionRequest,
    connectedBuyers,
    acceptConnection,
    onboardingStatus,
    getDocumentRequirements,
    getFormFields,
    completeFormField,
    submitOnboarding,
    uploadedOnboardingDocs,
    completedFormFields,
    pendingOutgoingRequests,
    setShowConnectModal,
    openOnboardingUploadModal,
    downloadTemplate,
    sendConnectionRequest,
    connectionStatus,
  } = useSimulation();

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

  const pendingOutgoingCount = pendingOutgoingRequests.filter(r => r.status === 'pending').length;
  const isWaitingForApproval = currentStep === 'wait-approval';
  const isRequestConnectionStep = currentStep === 'request-connection';

  const handleSendConnectionRequest = () => {
    if (buyerIdInput.trim()) {
      sendConnectionRequest(buyerIdInput.trim());
      setBuyerIdInput('');
    }
  };

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
      </div>

      {/* Get Started Card - Show when no connection exists */}
      {(isRequestConnectionStep || isWaitingForApproval) && connectionStatus !== 'active' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className={`border-2 ${isRequestConnectionStep ? 'border-primary/50 bg-gradient-to-r from-primary/5 to-primary/10' : 'border-amber-200 bg-gradient-to-r from-amber-50/50 to-orange-50/50'}`}>
            <CardHeader>
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${isRequestConnectionStep ? 'bg-primary/10' : 'bg-amber-100'}`}>
                  {isWaitingForApproval ? (
                    <Loader2 className="h-6 w-6 text-amber-600 animate-spin" />
                  ) : (
                    <UserPlus className="h-6 w-6 text-primary" />
                  )}
                </div>
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-2">
                    {isWaitingForApproval ? 'Waiting for Buyer Approval' : 'Get Started - Connect with a Buyer'}
                    {isRequestConnectionStep && (
                      <Badge className="bg-primary/20 text-primary border-primary/30">
                        Current Step
                      </Badge>
                    )}
                    {isWaitingForApproval && (
                      <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                        <Clock className="h-3 w-3 mr-1" />
                        Pending
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {isWaitingForApproval 
                      ? 'Your connection request has been sent. The buyer is reviewing your request...'
                      : 'Enter a Buyer ID to send a connection request. In the real app, buyers will share their ID with you.'}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isRequestConnectionStep && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border">
                    <Info className="h-4 w-4 text-muted-foreground shrink-0" />
                    <p className="text-sm text-muted-foreground">
                      For this simulation, use the demo Buyer ID: <code className="font-mono bg-primary/10 px-1.5 py-0.5 rounded text-primary font-semibold">BUY-DEMO-2024</code>
                    </p>
                  </div>
                  
                  <div className="flex gap-3">
                    <Input
                      placeholder="Enter Buyer ID (e.g., BUY-XXXX-XXXX)"
                      value={buyerIdInput}
                      onChange={(e) => setBuyerIdInput(e.target.value)}
                      className="flex-1"
                    />
                    <Button 
                      onClick={handleSendConnectionRequest}
                      disabled={!buyerIdInput.trim()}
                      className="gap-2"
                    >
                      <Send className="h-4 w-4" />
                      Send Request
                    </Button>
                  </div>
                </div>
              )}
              
              {isWaitingForApproval && (
                <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                    <span className="text-sm text-amber-700">
                      Processing request... The buyer will approve shortly.
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">
            Incoming
            {pendingConnectionRequest && (
              <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 justify-center">
                1
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="outgoing">
            Outgoing
            {pendingOutgoingCount > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 justify-center">
                {pendingOutgoingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="connected">Connected</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6 space-y-4">
          {/* Pending Connection Request - Only show if NOT in request/wait steps */}
          {pendingConnectionRequest && !isRequestConnectionStep && !isWaitingForApproval && (activeTab === 'all' || activeTab === 'pending') && (
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
                    <div className="p-3 bg-card/50 rounded-lg border border-blue-100">
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

          {/* Pending Outgoing Requests */}
          {(activeTab === 'all' || activeTab === 'outgoing') && pendingOutgoingRequests.map((request, index) => (
            <motion.div
              key={request.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className={
                request.status === 'approved' 
                  ? 'border-green-200 bg-gradient-to-r from-green-50/50 to-emerald-50/50'
                  : 'border-purple-200 bg-gradient-to-r from-purple-50/50 to-indigo-50/50'
              }>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-lg ${request.status === 'approved' ? 'bg-green-100' : 'bg-purple-100'}`}>
                        <Building2 className={`h-6 w-6 ${request.status === 'approved' ? 'text-green-600' : 'text-purple-600'}`} />
                      </div>
                      <div>
                        <p className="font-semibold flex items-center gap-2">
                          {request.buyer_name}
                          {request.status === 'approved' ? (
                            <Badge className="bg-green-100 text-green-700 border-green-200">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Approved
                            </Badge>
                          ) : (
                            <Badge className="bg-purple-100 text-purple-700 border-purple-200">
                              <Clock className="h-3 w-3 mr-1" />
                              Awaiting Response
                            </Badge>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Sent {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    {request.status === 'approved' && (
                      <Button size="sm" className="gap-2">
                        Start Onboarding
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {request.notes && (
                    <p className="mt-3 text-sm text-muted-foreground italic pl-16">
                      "{request.notes}"
                    </p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}

          {/* Connected Buyers with Onboarding */}
          {(activeTab === 'all' || activeTab === 'connected') && connectedBuyers.map((connection, index) => (
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
                                isUploaded ? 'bg-green-50 border-green-200' : 'bg-card'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                {isUploaded ? (
                                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                                ) : (
                                  <Clock className="h-5 w-5 text-muted-foreground" />
                                )}
                                <div>
                                  <p className="font-medium text-sm flex items-center gap-2">
                                    {doc.document_name}
                                    {doc.has_template && (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger>
                                            <Badge variant="outline" className="text-xs gap-1">
                                              <FileText className="h-3 w-3" />
                                              Template
                                            </Badge>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>Download the template, fill it in, and re-upload</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{doc.description}</p>
                                </div>
                              </div>
                              {!isUploaded && (
                                <div className="flex items-center gap-2">
                                  {doc.has_template && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button 
                                            size="sm" 
                                            variant="ghost"
                                            onClick={() => downloadTemplate(doc.id)}
                                            className="gap-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                          >
                                            <Download className="h-3 w-3" />
                                            Template
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Download template to fill out</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => openOnboardingUploadModal(doc)}
                                    className="gap-1"
                                  >
                                    <Upload className="h-3 w-3" />
                                    Upload
                                  </Button>
                                </div>
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
                                isCompleted ? 'bg-green-50 border-green-200' : 'bg-card'
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
                                  <p className="text-xs text-muted-foreground">{field.field_type}</p>
                                </div>
                              </div>
                              {!isCompleted && (
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => completeFormField(field.id)}
                                  className="gap-1"
                                >
                                  Complete
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Submit Onboarding */}
                    <div className="pt-4 border-t">
                      <Button 
                        onClick={submitOnboarding}
                        disabled={!canSubmitOnboarding}
                        className="w-full gap-2"
                      >
                        <Send className="h-4 w-4" />
                        Submit Onboarding
                      </Button>
                      {!canSubmitOnboarding && (
                        <p className="text-xs text-muted-foreground text-center mt-2">
                          Complete all documents and form fields to submit
                        </p>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            </motion.div>
          ))}

          {/* Empty State */}
          {!pendingConnectionRequest && 
           pendingOutgoingRequests.length === 0 && 
           connectedBuyers.length === 0 && 
           !isRequestConnectionStep && 
           !isWaitingForApproval && (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Connections Yet</h3>
                <p className="text-muted-foreground max-w-md mx-auto mb-4">
                  Start by connecting with a buyer to begin your supplier journey.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
