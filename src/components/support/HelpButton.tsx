import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TicketSubmissionModal } from './TicketSubmissionModal';

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
}

export const HelpButton = ({ source, user }: HelpButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);

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

      <TicketSubmissionModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        source={source}
        user={user}
      />
    </>
  );
};
