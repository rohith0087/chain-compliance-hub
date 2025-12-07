import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Smartphone, Copy, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useMFA } from '@/hooks/useMFA';
import { useToast } from '@/hooks/use-toast';

interface MFAEnrollmentProps {
  mandatory?: boolean;
  onComplete?: () => void;
  onSkip?: () => void;
}

export const MFAEnrollment = ({ mandatory = false, onComplete, onSkip }: MFAEnrollmentProps) => {
  const [step, setStep] = useState<'intro' | 'qr' | 'verify'>('intro');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { enrollMFA, verifyMFA, daysRemaining } = useMFA();
  const { toast } = useToast();

  const handleStartEnrollment = async () => {
    setLoading(true);
    setError(null);

    const { data, error } = await enrollMFA();

    if (error) {
      setError(error.message || 'Failed to start MFA enrollment');
      setLoading(false);
      return;
    }

    if (data) {
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setFactorId(data.id);
      setStep('qr');
    }

    setLoading(false);
  };

  const handleCopySecret = async () => {
    if (secret) {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
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

    const { error } = await verifyMFA(factorId, verificationCode);

    if (error) {
      setError(error.message || 'Invalid verification code');
      setLoading(false);
      return;
    }

    toast({
      title: "MFA Enabled",
      description: "Two-factor authentication has been set up successfully.",
    });

    onComplete?.();
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted/30">
      <Card className="w-full max-w-md border-0 shadow-xl">
        <CardHeader className="text-center pb-2">
          <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">
            {step === 'intro' && 'Set Up Two-Factor Authentication'}
            {step === 'qr' && 'Scan QR Code'}
            {step === 'verify' && 'Verify Setup'}
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

          {step === 'intro' && (
            <>
              {mandatory && (
                <Alert className="border-amber-500/50 bg-amber-500/10">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  <AlertDescription className="text-amber-700 dark:text-amber-400">
                    MFA is required to continue using this application.
                    {daysRemaining > 0 && ` You have ${daysRemaining} day${daysRemaining > 1 ? 's' : ''} remaining.`}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <Smartphone className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Download an Authenticator App</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Google Authenticator, Microsoft Authenticator, Authy, or any TOTP-compatible app
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <Shield className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Protect Your Account</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      MFA adds an extra layer of security by requiring a code from your phone
                    </p>
                  </div>
                </div>
              </div>

              <Button 
                onClick={handleStartEnrollment} 
                className="w-full" 
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Setting up...
                  </>
                ) : (
                  'Get Started'
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

          {step === 'qr' && (
            <>
              <div className="flex justify-center">
                {qrCode && (
                  <div className="p-4 bg-white rounded-lg">
                    <img 
                      src={qrCode} 
                      alt="QR Code for MFA setup" 
                      className="w-48 h-48"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Can't scan? Enter this code manually:
                </Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-muted rounded text-xs font-mono break-all">
                    {secret}
                  </code>
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={handleCopySecret}
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              <Button onClick={() => setStep('verify')} className="w-full">
                I've Scanned the Code
              </Button>

              <Button 
                variant="ghost" 
                onClick={() => setStep('intro')} 
                className="w-full text-muted-foreground"
              >
                Back
              </Button>
            </>
          )}

          {step === 'verify' && (
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Verification Code</Label>
                <Input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="text-center text-2xl tracking-widest h-14 font-mono"
                  autoComplete="one-time-code"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground text-center">
                  Enter the 6-digit code from your authenticator app
                </p>
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading || verificationCode.length !== 6}
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
                Back
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
