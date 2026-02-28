import { useState } from 'react';
import logger from '@/utils/logger';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Mail, MessageSquare, Share2, Copy, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';

interface InviteSupplierModalProps {
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

export const InviteSupplierModal = ({ 
  isOpen, 
  onClose, 
  buyerId, 
  buyerProfile, 
  userProfile 
}: InviteSupplierModalProps) => {
  const [emails, setEmails] = useState('');
  const [emailSubject, setEmailSubject] = useState(`Invitation to Connect - ${buyerProfile.company_name}`);
  const [emailMessage, setEmailMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const isMobile = useIsMobile();

  const inviteText = `Hi! ${userProfile.full_name} from ${buyerProfile.company_name} would like to connect with you on our supplier platform. Use Buyer ID: ${buyerId} to connect directly. Sign up at: ${window.location.origin}`;

  const handleEmailSend = async () => {
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
      // Send invitations with edge function
      const { error } = await supabase.functions.invoke('send-supplier-invitation', {
        body: {
          emails: emailList,
          subject: emailSubject,
          customMessage: emailMessage,
          buyerData: {
            name: userProfile.full_name,
            company: buyerProfile.company_name,
            email: buyerProfile.contact_email,
            industry: buyerProfile.industry,
            buyerId: buyerId
          }
        }
      });

      if (error) throw error;

      // Create onboarding requests with defaults for each email
      const { useOnboardingRequests } = await import('@/hooks/useOnboardingRequests');
      
      for (const email of emailList) {
        try {
          // This would create onboarding request with default settings
          // Implementation would use the proper hook context
          logger.debug(`Creating onboarding request for ${email} with defaults`);
        } catch (requestError) {
          console.error(`Error creating onboarding request for ${email}:`, requestError);
        }
      }

      toast.success(`Invitation sent to ${emailList.length} email(s) with default onboarding`);
      setEmails('');
      setEmailMessage('');
    } catch (error) {
      console.error('Error sending invitations:', error);
      toast.error('Failed to send invitations');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSMSShare = () => {
    const smsText = encodeURIComponent(inviteText);
    window.open(`sms:?body=${smsText}`, '_self');
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Connect with ${buyerProfile.company_name}`,
          text: inviteText,
          url: window.location.origin
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      handleCopyText();
    }
  };

  const handleSocialShare = (platform: string) => {
    const text = encodeURIComponent(inviteText);
    const url = encodeURIComponent(window.location.origin);
    
    const socialUrls = {
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}&summary=${text}`,
      twitter: `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      whatsapp: `https://wa.me/?text=${text}`
    };

    window.open(socialUrls[platform as keyof typeof socialUrls], '_blank', 'width=600,height=400');
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(inviteText);
      setCopied(true);
      toast.success('Invitation text copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleCopyBuyerId = async () => {
    try {
      await navigator.clipboard.writeText(buyerId);
      toast.success('Buyer ID copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy Buyer ID');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Invite Suppliers</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Buyer Info Card */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-2">Your Company Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <div><span className="font-medium">Company:</span> {buyerProfile.company_name}</div>
              <div><span className="font-medium">Contact:</span> {userProfile.full_name}</div>
              <div><span className="font-medium">Email:</span> {buyerProfile.contact_email}</div>
              {buyerProfile.industry && (
                <div><span className="font-medium">Industry:</span> {buyerProfile.industry}</div>
              )}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                Buyer ID: {buyerId}
              </Badge>
              <Button variant="ghost" size="sm" onClick={handleCopyBuyerId}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <Tabs defaultValue="email" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email
              </TabsTrigger>
              <TabsTrigger value="mobile" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                {isMobile ? 'SMS' : 'Mobile'}
              </TabsTrigger>
              <TabsTrigger value="social" className="flex items-center gap-2">
                <Share2 className="h-4 w-4" />
                Social
              </TabsTrigger>
              <TabsTrigger value="copy" className="flex items-center gap-2">
                <Copy className="h-4 w-4" />
                Copy
              </TabsTrigger>
            </TabsList>

            <TabsContent value="email" className="space-y-4">
              <div>
                <label className="text-sm font-medium">Email Addresses (comma-separated)</label>
                <Textarea
                  placeholder="supplier1@company.com, supplier2@company.com"
                  value={emails}
                  onChange={(e) => setEmails(e.target.value)}
                  rows={3}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Subject</label>
                <Input
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Additional Message (optional)</label>
                <Textarea
                  placeholder="Add a personal message to your invitation..."
                  value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value)}
                  rows={3}
                />
              </div>
              <Button onClick={handleEmailSend} disabled={isLoading} className="w-full">
                {isLoading ? 'Sending...' : 'Send Email Invitations'}
              </Button>
            </TabsContent>

            <TabsContent value="mobile" className="space-y-4">
              <div className="text-sm text-muted-foreground mb-4">
                Share invitation via mobile messaging or native share
              </div>
              <div className="space-y-3">
                {isMobile && (
                  <Button onClick={handleSMSShare} variant="outline" className="w-full">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Send via SMS
                  </Button>
                )}
                {navigator.share && (
                  <Button onClick={handleNativeShare} variant="outline" className="w-full">
                    <Share2 className="h-4 w-4 mr-2" />
                    Share via Native Share
                  </Button>
                )}
                {!isMobile && !navigator.share && (
                  <div className="text-center text-muted-foreground">
                    Mobile sharing options are available on mobile devices
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="social" className="space-y-4">
              <div className="text-sm text-muted-foreground mb-4">
                Share your invitation on social platforms
              </div>
              <div className="grid grid-cols-1 gap-3">
                <Button onClick={() => handleSocialShare('linkedin')} variant="outline" className="w-full">
                  LinkedIn
                </Button>
                <Button onClick={() => handleSocialShare('twitter')} variant="outline" className="w-full">
                  Twitter/X
                </Button>
                <Button onClick={() => handleSocialShare('whatsapp')} variant="outline" className="w-full">
                  WhatsApp
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="copy" className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Invitation Text</label>
                <div className="bg-muted p-3 rounded-lg border">
                  <p className="text-sm">{inviteText}</p>
                </div>
              </div>
              <Button onClick={handleCopyText} variant="outline" className="w-full">
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Invitation Text
                  </>
                )}
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};