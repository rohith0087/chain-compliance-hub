import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Rocket, FileEdit, CheckCircle, Building2 } from 'lucide-react';

export type OnboardingType = 'default' | 'custom' | 'none';

interface ConnectionApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (onboardingType: OnboardingType) => void;
  supplierName: string;
  isLoading?: boolean;
}

const ConnectionApprovalModal = ({
  isOpen,
  onClose,
  onConfirm,
  supplierName,
  isLoading = false,
}: ConnectionApprovalModalProps) => {
  const [selectedOption, setSelectedOption] = useState<OnboardingType>('default');

  const handleConfirm = () => {
    onConfirm(selectedOption);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            Approve Connection
          </DialogTitle>
          <DialogDescription>
            Approve connection request from <strong>{supplierName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <RadioGroup
            value={selectedOption}
            onValueChange={(value) => setSelectedOption(value as OnboardingType)}
            className="space-y-3"
          >
            <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer">
              <RadioGroupItem value="default" id="default" className="mt-1" />
              <Label htmlFor="default" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2 font-medium">
                  <Rocket className="w-4 h-4 text-primary" />
                  Start Default Onboarding
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Use your saved default onboarding templates and documents
                </p>
              </Label>
            </div>

            <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer">
              <RadioGroupItem value="custom" id="custom" className="mt-1" />
              <Label htmlFor="custom" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2 font-medium">
                  <FileEdit className="w-4 h-4 text-warning" />
                  Start Custom Onboarding
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Select specific documents and templates for this supplier
                </p>
              </Label>
            </div>

            <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer">
              <RadioGroupItem value="none" id="none" className="mt-1" />
              <Label htmlFor="none" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle className="w-4 h-4 text-success" />
                  Approve Only (No Onboarding Yet)
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Connect now, set up onboarding later
                </p>
              </Label>
            </div>
          </RadioGroup>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? 'Processing...' : 'Confirm Approval'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConnectionApprovalModal;
