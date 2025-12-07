import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useMFA } from '@/hooks/useMFA';
import { useAuth } from '@/hooks/useAuth';
import { MFAVerification } from './MFAVerification';
import { MFAEnrollment } from './MFAEnrollment';
import { MFAGracePeriodBanner } from './MFAGracePeriodBanner';

interface MFAGuardProps {
  children: React.ReactNode;
}

export const MFAGuard = ({ children }: MFAGuardProps) => {
  const { signOut } = useAuth();
  const { mfaEnrolled, mfaVerified, gracePeriodExpired, loading } = useMFA();
  const [showEnrollment, setShowEnrollment] = useState(false);

  // Still loading MFA status
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // MFA enrolled but not verified this session → verification screen
  if (mfaEnrolled && !mfaVerified) {
    return (
      <MFAVerification 
        onSuccess={() => {
          // Force refresh to update state
          window.location.reload();
        }}
        onCancel={async () => {
          await signOut();
        }}
      />
    );
  }

  // MFA not enrolled and grace period expired → force enrollment
  if (!mfaEnrolled && gracePeriodExpired) {
    return (
      <MFAEnrollment 
        mandatory 
        onComplete={() => {
          // Force refresh to update state
          window.location.reload();
        }}
      />
    );
  }

  // User chose to set up MFA from banner
  if (showEnrollment) {
    return (
      <MFAEnrollment 
        onComplete={() => {
          setShowEnrollment(false);
          window.location.reload();
        }}
        onSkip={() => setShowEnrollment(false)}
      />
    );
  }

  // All good - show app with optional grace period banner as toast
  return (
    <>
      {!mfaEnrolled && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm">
          <MFAGracePeriodBanner onSetupClick={() => setShowEnrollment(true)} />
        </div>
      )}
      {children}
    </>
  );
};
