import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Check, Send, Mail, Clock, FileText, Users, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useOnboardingRequests } from '@/hooks/useOnboardingRequests';

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
  
  const { createOnboardingRequestFromDefaults } = useOnboardingRequests();

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
          await createOnboardingRequestFromDefaults(buyerId, email, customMessage);
          successCount.push(email);
        } catch (error) {
          console.error(`Failed to create request for ${email}:`, error);
          failureCount.push(email);
        }
      }

      if (successCount.length > 0) {
        toast.success(`Quick onboarding sent to ${successCount.length} supplier(s)!`);
      }
      
      if (failureCount.length > 0) {
        toast.error(`Failed to send to ${failureCount.length} email(s)`);
      }

      if (successCount.length > 0) {
        setEmails('');
        setCustomMessage('');
        onClose();
      }
    } catch (error) {
      console.error('Error in quick send:', error);
      toast.error('Failed to send onboarding requests');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-500" />
            Quick Onboarding with Defaults
          </DialogTitle>
        </DialogHeader>

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
      </DialogContent>
    </Dialog>
  );
};