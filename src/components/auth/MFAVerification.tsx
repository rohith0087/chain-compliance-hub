import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertCircle, Loader2 } from 'lucide-react';
import { useMFA } from '@/hooks/useMFA';
import { useToast } from '@/hooks/use-toast';

interface MFAVerificationProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const MFAVerification = ({ onSuccess, onCancel }: MFAVerificationProps) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);

  const { challengeAndVerify } = useMFA();
  const { toast } = useToast();

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Two-Factor Authentication</CardTitle>
          <CardDescription>
            Enter the 6-digit code from your authenticator app to continue
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
              <Label htmlFor="mfa-code" className="sr-only">Verification Code</Label>
              <Input
                id="mfa-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="text-center text-3xl tracking-[0.5em] h-16 font-mono"
                autoComplete="one-time-code"
                autoFocus
                disabled={loading}
              />
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 text-base font-semibold" 
              disabled={loading || code.length !== 6}
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
              Open your authenticator app (Google Authenticator, Authy, etc.) to view your verification code.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
