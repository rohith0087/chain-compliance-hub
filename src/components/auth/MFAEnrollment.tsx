import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Smartphone, QrCode, CheckCircle, Loader2, AlertCircle, Copy, Check } from 'lucide-react';
import { useMFA } from '@/hooks/useMFA';
import { useToast } from '@/hooks/use-toast';
import { RecoveryCodesDisplay } from './RecoveryCodesDisplay';
import { supabase } from '@/integrations/supabase/client';

interface MFAEnrollmentProps {
  mandatory?: boolean;
  onComplete?: () => void;
  onSkip?: () => void;
}

export const MFAEnrollment = ({ mandatory = false, onComplete, onSkip }: MFAEnrollmentProps) => {
  const [step, setStep] = useState<'intro' | 'qr' | 'verify' | 'recovery'>('intro');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [isFactorExistsError, setIsFactorExistsError] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const { enrollMFA, verifyMFA, checkMFAStatus, daysRemaining, cleanupExistingFactors } = useMFA();
  const { toast } = useToast();

  const handleStartEnrollment = async (forceCleanup = false) => {
    setLoading(true);
    setError(null);
    setIsFactorExistsError(false);
    
    const result = await enrollMFA(forceCleanup);
    
    if (result.error) {
      const factorExists = result.isFactorExistsError || 
                          (result.error.message?.toLowerCase().includes('factor') && 
                           result.error.message?.toLowerCase().includes('already exists'));
      
      setIsFactorExistsError(factorExists);
      setError(factorExists 
        ? 'A previous setup attempt was incomplete. Click "Retry Setup" to clean up and try again.'
        : (result.error.message || 'Failed to start MFA enrollment'));
      setLoading(false);
      return;
    }

    if (result.data) {
      setQrCode(result.data.totp.qr_code);
      setSecret(result.data.totp.secret);
      setFactorId(result.data.id);
      setStep('qr');
    }
    
    setLoading(false);
  };

  const handleRetrySetup = async () => {
    setRetrying(true);
    setError(null);
    
    // Aggressive cleanup with longer delays
    await cleanupExistingFactors(3, 1500);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setRetrying(false);
    await handleStartEnrollment(true);
  };

  const handleCopySecret = async () => {
    if (secret) {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      toast({
        title: "Copied",
        description: "Secret key copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!factorId || verificationCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setLoading(true);
    setError(null);

    const result = await verifyMFA(factorId, verificationCode);

    if (result.error) {
      setError(result.error.message || 'Invalid verification code');
      setVerificationCode('');
      setLoading(false);
      return;
    }

    // Generate recovery codes after successful MFA verification
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const response = await supabase.functions.invoke('generate-mfa-recovery-codes', {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        });
        
        if (response.data?.codes) {
          setRecoveryCodes(response.data.codes);
          setStep('recovery');
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.error('Failed to generate recovery codes:', err);
    }

    // If recovery code generation fails, still complete the flow
    toast({
      title: "MFA Enabled",
      description: "Two-factor authentication has been set up successfully.",
    });

    await checkMFAStatus();
    onComplete?.();
    setLoading(false);
  };

  const handleRecoveryConfirm = async () => {
    toast({
      title: "MFA Enabled",
      description: "Two-factor authentication has been set up successfully with recovery codes.",
    });

    await checkMFAStatus();
    onComplete?.();
  };

  // Show recovery codes step
  if (step === 'recovery' && recoveryCodes.length > 0) {
    return <RecoveryCodesDisplay codes={recoveryCodes} onConfirm={handleRecoveryConfirm} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 py-8 bg-gradient-to-br from-background via-background to-muted/30">
      <Card className="w-full max-w-md border-0 shadow-xl">
        <CardHeader className="text-center pb-2">
          <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
            {step === 'intro' && <Shield className="w-8 h-8 text-primary" />}
            {step === 'qr' && <QrCode className="w-8 h-8 text-primary" />}
            {step === 'verify' && <Smartphone className="w-8 h-8 text-primary" />}
          </div>
          <CardTitle className="text-2xl">
            {step === 'intro' && 'Set Up Two-Factor Authentication'}
            {step === 'qr' && 'Scan QR Code'}
            {step === 'verify' && 'Verify Your Setup'}
          </CardTitle>
          <CardDescription>
            {step === 'intro' && 'Add an extra layer of security to your account'}
            {step === 'qr' && 'Use your authenticator app to scan this code'}
            {step === 'verify' && 'Enter the code from your authenticator app'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isFactorExistsError && step === 'intro' && (
            <Button
              onClick={handleRetrySetup}
              disabled={retrying || loading}
              variant="outline"
              className="w-full border-amber-500/50 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
            >
              {retrying ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Cleaning up previous attempt...
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4 mr-2" />
                  Retry Setup
                </>
              )}
            </Button>
          )}

          {step === 'intro' && (
            <>
              {mandatory && (
                <Alert className="border-amber-500/50 bg-amber-500/10">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  <AlertDescription className="text-amber-700 dark:text-amber-400">
                    MFA is required to continue using this application.
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="mt-0.5 p-1.5 rounded-full bg-primary/10">
                    <CheckCircle className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Download an authenticator app</p>
                    <p className="text-xs text-muted-foreground">
                      Google Authenticator, Authy, or 1Password
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="mt-0.5 p-1.5 rounded-full bg-primary/10">
                    <CheckCircle className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Scan QR code</p>
                    <p className="text-xs text-muted-foreground">
                      Link your authenticator app to your account
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="mt-0.5 p-1.5 rounded-full bg-primary/10">
                    <CheckCircle className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Save recovery codes</p>
                    <p className="text-xs text-muted-foreground">
                      Backup codes in case you lose your device
                    </p>
                  </div>
                </div>
              </div>

              <Button
                onClick={() => handleStartEnrollment(false)}
                disabled={loading}
                className="w-full h-12 text-base font-semibold"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Setting up...
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4 mr-2" />
                    Get Started
                  </>
                )}
              </Button>

              {!mandatory && onSkip && (
                <Button
                  variant="ghost"
                  onClick={onSkip}
                  className="w-full text-muted-foreground"
                >
                  Skip for now ({daysRemaining} days remaining)
                </Button>
              )}
            </>
          )}

          {step === 'qr' && qrCode && (
            <>
              <div className="flex justify-center p-4 bg-white rounded-lg">
                <img src={qrCode} alt="QR Code" className="w-48 h-48" />
              </div>

              {secret && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Can't scan? Enter this code manually:
                  </Label>
                  <div className="flex gap-2">
                    <code className="flex-1 p-2 text-xs bg-muted rounded font-mono break-all">
                      {secret}
                    </code>
                    <Button variant="outline" size="sm" onClick={handleCopySecret}>
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              )}

              <Button
                onClick={() => setStep('verify')}
                className="w-full h-12 text-base font-semibold"
              >
                I've Scanned the Code
              </Button>
            </>
          )}

          {step === 'verify' && (
            <form onSubmit={handleVerify} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="code" className="sr-only">Verification Code</Label>
                <Input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="text-center text-3xl tracking-[0.5em] h-16 font-mono"
                  autoFocus
                  disabled={loading}
                />
              </div>

              <Button
                type="submit"
                disabled={loading || verificationCode.length !== 6}
                className="w-full h-12 text-base font-semibold"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify & Enable MFA'
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep('qr')}
                className="w-full text-muted-foreground"
              >
                Back to QR Code
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
