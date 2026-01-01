import { useState, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HelpCenterWorkspace } from './HelpCenterWorkspace';
import { useTour } from './TourProvider';

export interface HelpButtonUser {
  id?: string;
  email?: string;
  name?: string;
  companyId?: string;
  companyName?: string;
  userType?: 'buyer' | 'supplier' | 'guest';
}

interface HelpButtonProps {
  source: 'buyer_portal' | 'supplier_portal' | 'login_page';
  user?: HelpButtonUser;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const HelpButton = ({ source, user, isOpen: externalOpen, onOpenChange }: HelpButtonProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const { isRunning } = useTour();

  // Use external state if provided, otherwise use internal state
  const isOpen = externalOpen !== undefined ? externalOpen : internalOpen;
  const setIsOpen = onOpenChange || setInternalOpen;

  // Sync internal state with external state
  useEffect(() => {
    if (externalOpen !== undefined && externalOpen !== internalOpen) {
      setInternalOpen(externalOpen);
    }
  }, [externalOpen]);

  // Don't show button during tour
  if (isRunning) {
    return null;
  }

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        size="icon"
        variant="outline"
        className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full shadow-lg bg-primary text-primary-foreground hover:bg-primary/90 border-0"
        aria-label="Get Help"
      >
        <HelpCircle className="h-6 w-6" />
      </Button>

      <HelpCenterWorkspace
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        source={source}
        user={user}
      />
    </>
  );
};
