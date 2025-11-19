import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Check, Send, Mail, Clock, FileText, Users, Zap, Edit, RefreshCw, XCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useOnboardingRequests } from '@/hooks/useOnboardingRequests';
import { EditOnboardingRequestDialog } from './EditOnboardingRequestDialog';
import { formatDistanceToNow } from 'date-fns';

interface QuickOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  buyerId: string;
  buyerProfile: {
    company_name: string;
    contact_email: string;
    industry?: string;
  };
  userProfile: {
    full_name: string;
  };
}

export const QuickOnboardingModal = ({ 
  isOpen, 
  onClose, 
  buyerId, 
  buyerProfile, 
  userProfile 
}: QuickOnboardingModalProps) => {
  const [emails, setEmails] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [previewDefaults, setPreviewDefaults] = useState<any>(null);
  const [existingRequests, setExistingRequests] = useState<any[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [requestToCancel, setRequestToCancel] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const { 
    createOnboardingRequestFromDefaults, 
    updateOnboardingRequest, 
    resendOnboardingRequest, 
    cancelOnboardingRequest 
  } = useOnboardingRequests();

  useEffect(() => {
    if (isOpen) {
      loadExistingRequests();
    }
  }, [isOpen, buyerId]);

  const loadExistingRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('supplier_onboarding_requests')
        .select('*')
        .eq('buyer_id', buyerId)
        .in('status', ['pending', 'requested', 'expired'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setExistingRequests(data || []);
    } catch (error) {
      console.error('Error loading existing requests:', error);
    }
  };

  const handleQuickSend = async () => {
    if (!emails.trim()) {
      toast.error('Please enter at least one email address');
      return;
    }

    const emailList = emails
      .split(',')
      .map(email => email.trim())
      .filter(email => email && email.includes('@'));

    if (emailList.length === 0) {
      toast.error('Please enter valid email addresses');
      return;
    }

    setIsLoading(true);
    try {
      const successCount = [];
      const failureCount = [];

      for (const email of emailList) {
        try {
          // Create onboarding request with defaults
          await createOnboardingRequestFromDefaults(buyerId, email, '', customMessage);
          successCount.push(email);
        } catch (error) {
          console.error(`Failed to create request for ${email}:`, error);
          failureCount.push(email);
        }
      }

      if (successCount.length > 0) {
        toast.success(`Quick onboarding sent to ${successCount.length} supplier(s)!`);
        loadExistingRequests();
      }
      
      if (failureCount.length > 0) {
        toast.error(`Failed to send to ${failureCount.length} email(s)`);
      }

      if (successCount.length > 0) {
        setEmails('');
        setCustomMessage('');
      }
    } catch (error) {
      console.error('Error in quick send:', error);
      toast.error('Failed to send onboarding requests');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditRequest = (request: any) => {
    setSelectedRequest(request);
    setShowEditDialog(true);
  };

  const handleSaveEdit = async (requestId: string, updates: any) => {
    try {
      await updateOnboardingRequest(requestId, updates);
      toast.success('Onboarding request updated successfully');
      loadExistingRequests();
    } catch (error) {
      toast.error('Failed to update request');
      throw error;
    }
  };

  const handleResend = async (requestId: string) => {
    try {
      setIsLoading(true);
      await resendOnboardingRequest(requestId);
      toast.success('Invitation resent successfully');
      loadExistingRequests();
    } catch (error) {
      toast.error('Failed to resend invitation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!requestToCancel) return;
    
    try {
      await cancelOnboardingRequest(requestToCancel);
      toast.success('Onboarding request cancelled');
      loadExistingRequests();
    } catch (error) {
      toast.error('Failed to cancel request');
    } finally {
      setRequestToCancel(null);
    }
  };

  const getStatusBadge = (status: string, expiresAt?: string) => {
    const isExpired = expiresAt && new Date(expiresAt) < new Date();
    
    if (isExpired) {
      return <Badge variant="destructive">Expired</Badge>;
    }
    
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'requested':
        return <Badge variant="outline">Requested</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getExpiryText = (expiresAt?: string) => {
    if (!expiresAt) return 'No expiry';
    
    const expiryDate = new Date(expiresAt);
    const now = new Date();
    
    if (expiryDate < now) {
      return <span className="text-destructive">Expired {formatDistanceToNow(expiryDate)} ago</span>;
    }
    
    return <span className="text-muted-foreground">Expires in {formatDistanceToNow(expiryDate)}</span>;
  };

  const filteredRequests = existingRequests.filter(req => 
    req.supplier_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (req.supplier_company_name && req.supplier_company_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-blue-500" />
              Quick Onboarding with Defaults
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="new" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="new">New Invitations</TabsTrigger>
              <TabsTrigger value="existing">
                Existing Requests ({existingRequests.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="new" className="space-y-4">

        <div className="grid md:grid-cols-2 gap-6">
          {/* Left Side - Form */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Send className="w-4 h-4" />
                  Send Invitations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Supplier Email Addresses</label>
                  <Textarea
                    placeholder="supplier1@company.com, supplier2@company.com"
                    value={emails}
                    onChange={(e) => setEmails(e.target.value)}
                    rows={3}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Separate multiple emails with commas
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium">Additional Message (Optional)</label>
                  <Textarea
                    placeholder="Add a personal note to the invitation..."
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    rows={3}
                    className="mt-1"
                  />
                </div>

                <Button 
                  onClick={handleQuickSend} 
                  disabled={isLoading || !emails.trim()} 
                  className="w-full"
                  size="lg"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-2" />
                      Send Quick Onboarding
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right Side - Preview */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  What's Included
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 text-green-600">
                  <Check className="w-4 h-4" />
                  <span className="text-sm">Industry-specific defaults ({buyerProfile.industry || 'General'})</span>
                </div>
                
                <div className="flex items-center gap-2 text-green-600">
                  <Check className="w-4 h-4" />
                  <span className="text-sm">Standard document requirements</span>
                </div>
                
                <div className="flex items-center gap-2 text-green-600">
                  <Check className="w-4 h-4" />
                  <span className="text-sm">Professional welcome message</span>
                </div>
                
                <div className="flex items-center gap-2 text-green-600">
                  <Check className="w-4 h-4" />
                  <span className="text-sm">Custom form fields</span>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-blue-600">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm font-medium">Time Savings</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Instantly sends comprehensive onboarding with your pre-configured settings.
                    No manual setup required!
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-purple-600">
                    <Users className="w-4 h-4" />
                    <span className="text-sm font-medium">Professional Experience</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Suppliers receive a polished, industry-appropriate onboarding experience.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Your Company Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Company:</span>
                  <span>{buyerProfile.company_name}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Contact:</span>
                  <span>{userProfile.full_name}</span>
                </div>
                {buyerProfile.industry && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Industry:</span>
                    <Badge variant="secondary" className="text-xs">{buyerProfile.industry}</Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
            </div>
            </TabsContent>

            <TabsContent value="existing" className="space-y-4">
              <div className="space-y-4">
                <Input
                  placeholder="Search by email or company name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-md"
                />

                {filteredRequests.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      {searchTerm ? 'No requests match your search' : 'No pending or requested invitations'}
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead>Company</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead>Expiry</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRequests.map((request) => (
                          <TableRow key={request.id}>
                            <TableCell className="font-medium">{request.supplier_email}</TableCell>
                            <TableCell>{request.supplier_company_name || '-'}</TableCell>
                            <TableCell>{getStatusBadge(request.status, request.expires_at)}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDistanceToNow(new Date(request.created_at))} ago
                            </TableCell>
                            <TableCell className="text-sm">
                              {getExpiryText(request.expires_at)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditRequest(request)}
                                  disabled={isLoading}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleResend(request.id)}
                                  disabled={isLoading}
                                >
                                  <RefreshCw className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setRequestToCancel(request.id)}
                                  disabled={isLoading}
                                >
                                  <XCircle className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {selectedRequest && (
        <EditOnboardingRequestDialog
          isOpen={showEditDialog}
          onClose={() => {
            setShowEditDialog(false);
            setSelectedRequest(null);
          }}
          request={selectedRequest}
          onSave={handleSaveEdit}
        />
      )}

      <AlertDialog open={!!requestToCancel} onOpenChange={() => setRequestToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Onboarding Request</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this onboarding request? The supplier will no longer be able to access the invitation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Request</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelRequest}>
              Cancel Request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};