import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface EditOnboardingRequestDialogProps {
  isOpen: boolean;
  onClose: () => void;
  request: {
    id: string;
    supplier_email: string;
    supplier_company_name?: string;
    custom_message?: string;
    can_choose_branches: boolean;
  };
  onSave: (requestId: string, updates: {
    supplier_company_name?: string;
    custom_message?: string;
    can_choose_branches?: boolean;
    supplier_email?: string;
  }) => Promise<void>;
}

export const EditOnboardingRequestDialog = ({
  isOpen,
  onClose,
  request,
  onSave
}: EditOnboardingRequestDialogProps) => {
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [canChooseBranches, setCanChooseBranches] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [emailChanged, setEmailChanged] = useState(false);

  useEffect(() => {
    if (isOpen && request) {
      setCompanyName(request.supplier_company_name || '');
      setEmail(request.supplier_email);
      setCustomMessage(request.custom_message || '');
      setCanChooseBranches(request.can_choose_branches);
      setEmailChanged(false);
    }
  }, [isOpen, request]);

  const handleEmailChange = (newEmail: string) => {
    setEmail(newEmail);
    setEmailChanged(newEmail !== request.supplier_email);
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await onSave(request.id, {
        supplier_company_name: companyName,
        custom_message: customMessage,
        can_choose_branches: canChooseBranches,
        ...(emailChanged ? { supplier_email: email } : {})
      });
      onClose();
    } catch (error) {
      console.error('Error saving:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Onboarding Request</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="email">Supplier Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              placeholder="supplier@company.com"
            />
            {emailChanged && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Changing the email will send the invitation to a different supplier. Make sure this is intended.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="company">Supplier Company Name (Optional)</Label>
            <Input
              id="company"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Leave blank to let supplier fill in"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Custom Message (Optional)</Label>
            <Textarea
              id="message"
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Add a personal message for the supplier..."
              rows={4}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="branches">Allow Branch Selection</Label>
              <p className="text-sm text-muted-foreground">
                Let supplier choose which branches to connect with
              </p>
            </div>
            <Switch
              id="branches"
              checked={canChooseBranches}
              onCheckedChange={setCanChooseBranches}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
