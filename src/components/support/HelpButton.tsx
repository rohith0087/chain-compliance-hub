import { useState, useEffect } from 'react';
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
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
  /**
   * Optional override for the floating button styling. Needed on surfaces that
   * don't define the `--r2c-*` theme vars (e.g. the login page renders on plain
   * black), where the default `bg-[var(--r2c-stamp)]` falls back to transparent
   * and the icon disappears.
   */
  className?: string;
}

export const HelpButton = ({ source, user, isOpen: externalOpen, onOpenChange, className }: HelpButtonProps) => {
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
        className={cn(
          "fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full shadow-lg bg-[var(--r2c-stamp)] text-white hover:bg-[var(--r2c-stamp-deep)] border-0",
          className,
        )}
        aria-label="Get Help"
      >
        <MessageSquare className="h-6 w-6" />
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
