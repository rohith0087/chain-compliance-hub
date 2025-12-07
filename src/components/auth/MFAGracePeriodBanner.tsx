import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Shield, X, Clock } from 'lucide-react';
import { useMFA } from '@/hooks/useMFA';

interface MFAGracePeriodBannerProps {
  onSetupClick?: () => void;
}

export const MFAGracePeriodBanner = ({ onSetupClick }: MFAGracePeriodBannerProps) => {
  const [dismissed, setDismissed] = useState(false);
  const { daysRemaining, mfaEnrolled } = useMFA();

  // Don't show if MFA is already enrolled or banner is dismissed
  if (mfaEnrolled || dismissed) {
    return null;
  }

  const urgencyLevel = daysRemaining <= 2 ? 'urgent' : daysRemaining <= 4 ? 'warning' : 'info';

  const bgColor = {
    urgent: 'bg-destructive/10 border-destructive/50',
    warning: 'bg-amber-500/10 border-amber-500/50',
    info: 'bg-primary/10 border-primary/50',
  }[urgencyLevel];

  const textColor = {
    urgent: 'text-destructive',
    warning: 'text-amber-600 dark:text-amber-400',
    info: 'text-primary',
  }[urgencyLevel];

  return (
    <Alert className={`${bgColor} border shadow-lg rounded-lg bg-card`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-full ${urgencyLevel === 'urgent' ? 'bg-destructive/20' : urgencyLevel === 'warning' ? 'bg-amber-500/20' : 'bg-primary/20'}`}>
          {urgencyLevel === 'urgent' ? (
            <Clock className={`h-4 w-4 ${textColor}`} />
          ) : (
            <Shield className={`h-4 w-4 ${textColor}`} />
          )}
        </div>
        
        <AlertDescription className="flex-1 flex items-center justify-between gap-4">
          <span className={textColor}>
            {urgencyLevel === 'urgent' ? (
              <strong>Action Required:</strong>
            ) : null}{' '}
            Set up two-factor authentication.{' '}
            <span className="font-medium">
              {daysRemaining === 1 
                ? 'Last day remaining!' 
                : `${daysRemaining} days remaining.`}
            </span>
          </span>
          
          <div className="flex items-center gap-2 shrink-0">
            <Button 
              size="sm" 
              onClick={onSetupClick}
              className={urgencyLevel === 'urgent' ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              Set Up Now
            </Button>
            
            {urgencyLevel !== 'urgent' && (
              <Button 
                variant="ghost" 
                size="icon"
                className="h-8 w-8"
                onClick={() => setDismissed(true)}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </AlertDescription>
      </div>
    </Alert>
  );
};
