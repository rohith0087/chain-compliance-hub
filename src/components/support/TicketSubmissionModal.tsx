import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Send, Loader2, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { HelpButtonUser } from './HelpButton';

// Get client IP address using public API
const getClientIP = async (): Promise<string | null> => {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch {
    return null;
  }
};

interface TicketSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  source: 'buyer_portal' | 'supplier_portal' | 'login_page';
  user?: HelpButtonUser;
}

export const TicketSubmissionModal = ({ isOpen, onClose, source, user }: TicketSubmissionModalProps) => {
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const getSourceLabel = () => {
    switch (source) {
      case 'buyer_portal': return 'Buyer Portal';
      case 'supplier_portal': return 'Supplier Portal';
      case 'login_page': return 'Login Page';
      default: return 'Application';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!subject.trim() || !description.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in both subject and description.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Auto-capture context
      const ipAddress = await getClientIP();
      const metadata = {
        timestamp: new Date().toISOString(),
        screen_resolution: `${window.screen.width}x${window.screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language,
      };

      const ticketData = {
        user_id: user?.id || null,
        user_email: user?.email || null,
        user_name: user?.name || null,
        company_id: user?.companyId || null,
        company_name: user?.companyName || null,
        user_type: user?.userType || 'guest',
        subject: subject.trim(),
        description: description.trim(),
        priority,
        status: 'open' as const,
        source,
        page_url: window.location.href,
        page_route: window.location.pathname,
        ip_address: ipAddress,
        user_agent: navigator.userAgent,
        metadata,
      };

      const { data: insertedTicket, error } = await supabase
        .from('support_tickets')
        .insert(ticketData)
        .select()
        .single();

      if (error) throw error;

      // Send email notification to all platform admins
      try {
        await supabase.functions.invoke('send-ticket-notification', {
          body: {
            action: 'ticket_created',
            ticketId: insertedTicket.id,
            ticketSubject: subject.trim(),
            ticketDescription: description.trim(),
            ticketPriority: priority,
            ticketSource: source,
            userEmail: user?.email,
            userName: user?.name,
            companyId: user?.companyId,
            companyName: user?.companyName,
            companyType: user?.userType === 'buyer' ? 'buyer' : user?.userType === 'supplier' ? 'supplier' : undefined,
          }
        });
        console.log('Admin notification sent successfully');
      } catch (notifError) {
        console.error('Failed to send admin notification:', notifError);
        // Don't fail the ticket submission if notification fails
      }

      setSubmitted(true);
      toast({
        title: "Ticket Submitted",
        description: "Our support team will get back to you soon.",
      });

      // Reset and close after delay
      setTimeout(() => {
        setSubject('');
        setDescription('');
        setPriority('medium');
        setSubmitted(false);
        onClose();
      }, 2000);

    } catch (error: any) {
      console.error('Error submitting ticket:', error);
      toast({
        title: "Submission Failed",
        description: error.message || "Failed to submit ticket. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setSubject('');
      setDescription('');
      setPriority('medium');
      setSubmitted(false);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Need Help?
            <Badge variant="outline" className="text-xs font-normal">
              {getSourceLabel()}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Submit a support ticket and our team will assist you as soon as possible.
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold text-lg">Ticket Submitted!</h3>
              <p className="text-sm text-muted-foreground">We'll get back to you soon.</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief description of your issue"
                disabled={loading}
                maxLength={200}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={priority} onValueChange={(v: any) => setPriority(v)} disabled={loading}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low - General question</SelectItem>
                  <SelectItem value="medium">Medium - Need assistance</SelectItem>
                  <SelectItem value="high">High - Blocking issue</SelectItem>
                  <SelectItem value="urgent">Urgent - Critical problem</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Please describe your issue in detail. Include any error messages or steps to reproduce the problem."
                rows={5}
                disabled={loading}
                maxLength={2000}
              />
              <p className="text-xs text-muted-foreground text-right">
                {description.length}/2000
              </p>
            </div>

            {user?.email && (
              <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                We'll respond to: <span className="font-medium">{user.email}</span>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button 
                type="button" 
                variant="outline" 
                className="flex-1"
                onClick={handleClose}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Submit Ticket
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
