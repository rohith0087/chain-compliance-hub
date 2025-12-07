import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertCircle, Loader2, KeyRound } from 'lucide-react';
import { useMFA } from '@/hooks/useMFA';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface MFAVerificationProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const MFAVerification = ({ onSuccess, onCancel }: MFAVerificationProps) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);

  const { challengeAndVerify } = useMFA();
  const { toast } = useToast();

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (useRecoveryCode) {
      // Verify recovery code
      if (!code.trim()) {
        setError('Please enter a recovery code');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setError('Session expired. Please sign in again.');
          setLoading(false);
          return;
        }

        const response = await supabase.functions.invoke('verify-mfa-recovery-code', {
          body: { code: code.trim() },
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        });

        if (response.data?.valid) {
          toast({
            title: "Verified",
            description: `Recovery code accepted. ${response.data.remainingCodes} codes remaining.`,
          });
          onSuccess?.();
        } else {
          setAttempts(prev => prev + 1);
          setError(response.data?.error || 'Invalid recovery code');
          setCode('');
        }
      } catch (err) {
        console.error('Recovery code verification error:', err);
        setError('Failed to verify recovery code');
      }
      
      setLoading(false);
      return;
    }

    // Standard TOTP verification
    if (code.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setLoading(true);
    setError(null);

    const { error } = await challengeAndVerify(code);

    if (error) {
      setAttempts(prev => prev + 1);
      setError(
        attempts >= 2 
          ? 'Too many failed attempts. Please wait a moment and try again.' 
          : 'Invalid verification code. Please try again.'
      );
      setCode('');
      setLoading(false);
      return;
    }

    toast({
      title: "Verified",
      description: "Two-factor authentication successful.",
    });

    onSuccess?.();
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted/30">
      <Card className="w-full max-w-md border-0 shadow-xl">
        <CardHeader className="text-center pb-2">
          <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
            {useRecoveryCode ? (
              <KeyRound className="w-8 h-8 text-primary" />
            ) : (
              <Shield className="w-8 h-8 text-primary" />
            )}
          </div>
          <CardTitle className="text-2xl">
            {useRecoveryCode ? 'Use Recovery Code' : 'Two-Factor Authentication'}
          </CardTitle>
          <CardDescription>
            {useRecoveryCode 
              ? 'Enter one of your saved recovery codes'
              : 'Enter the 6-digit code from your authenticator app to continue'
            }
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleVerify} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="mfa-code" className="sr-only">
                {useRecoveryCode ? 'Recovery Code' : 'Verification Code'}
              </Label>
              <Input
                id="mfa-code"
                type="text"
                inputMode={useRecoveryCode ? 'text' : 'numeric'}
                pattern={useRecoveryCode ? undefined : '[0-9]*'}
                maxLength={useRecoveryCode ? 20 : 6}
                value={code}
                onChange={(e) => setCode(
                  useRecoveryCode 
                    ? e.target.value.toUpperCase() 
                    : e.target.value.replace(/\D/g, '')
                )}
                placeholder={useRecoveryCode ? 'XXXX-XXXX' : '000000'}
                className={`text-center h-16 font-mono ${
                  useRecoveryCode ? 'text-xl tracking-wider' : 'text-3xl tracking-[0.5em]'
                }`}
                autoComplete="one-time-code"
                autoFocus
                disabled={loading}
              />
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 text-base font-semibold" 
              disabled={loading || (useRecoveryCode ? !code.trim() : code.length !== 6)}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify'
              )}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">or</span>
              </div>
            </div>

            <Button 
              type="button"
              variant="outline" 
              onClick={() => {
                setUseRecoveryCode(!useRecoveryCode);
                setCode('');
                setError(null);
              }} 
              className="w-full"
            >
              <KeyRound className="w-4 h-4 mr-2" />
              {useRecoveryCode ? 'Use authenticator app instead' : 'Lost access? Use recovery code'}
            </Button>

            {onCancel && (
              <Button 
                type="button"
                variant="ghost" 
                onClick={onCancel} 
                className="w-full text-muted-foreground"
              >
                Cancel & Sign Out
              </Button>
            )}

            <p className="text-xs text-center text-muted-foreground">
              {useRecoveryCode 
                ? 'Each recovery code can only be used once.'
                : 'Open your authenticator app (Google Authenticator, Authy, etc.) to view your verification code.'
              }
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
