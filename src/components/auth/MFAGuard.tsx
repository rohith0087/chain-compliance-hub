import { Loader2 } from 'lucide-react';
import { useMFA } from '@/hooks/useMFA';
import { useAuth } from '@/hooks/useAuth';
import { MFAVerification } from './MFAVerification';

interface MFAGuardProps {
  children: React.ReactNode;
}

export const MFAGuard = ({ children }: MFAGuardProps) => {
  const { signOut } = useAuth();
  const { mfaEnrolled, mfaVerified, loading } = useMFA();

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

  // All good - show app (MFA is now optional)
  return <>{children}</>;
};
