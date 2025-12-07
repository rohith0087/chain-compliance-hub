import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, ShieldCheck, ShieldOff, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { useMFA } from '@/hooks/useMFA';
import { useToast } from '@/hooks/use-toast';
import { MFAEnrollment } from '@/components/auth/MFAEnrollment';

export const MFASettingsSection = () => {
  const { mfaEnrolled, factors, unenrollMFA, loading: mfaLoading } = useMFA();
  const { toast } = useToast();
  
  const [showEnrollment, setShowEnrollment] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [disabling, setDisabling] = useState(false);

  const handleDisableMFA = async () => {
    if (confirmText !== 'DISABLE') {
      return;
    }

    setDisabling(true);
    
    // Unenroll all factors
    for (const factor of factors) {
      const { error } = await unenrollMFA(factor.id);
      if (error) {
        toast({
          title: "Error",
          description: "Failed to disable MFA. Please try again.",
          variant: "destructive",
        });
        setDisabling(false);
        return;
      }
    }

    toast({
      title: "MFA Disabled",
      description: "Two-factor authentication has been disabled.",
    });

    setShowDisableDialog(false);
    setConfirmText('');
    setDisabling(false);
  };

  if (showEnrollment) {
    return (
      <div className="fixed inset-0 z-50 bg-background">
        <MFAEnrollment 
          onComplete={() => {
            setShowEnrollment(false);
          }}
          onSkip={() => setShowEnrollment(false)}
        />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${mfaEnrolled ? 'bg-green-500/10' : 'bg-muted'}`}>
              {mfaEnrolled ? (
                <ShieldCheck className="w-5 h-5 text-green-500" />
              ) : (
                <Shield className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
            <div>
              <CardTitle className="text-lg">Two-Factor Authentication</CardTitle>
              <CardDescription>
                Add an extra layer of security to your account
              </CardDescription>
            </div>
          </div>
          <Badge variant={mfaEnrolled ? "default" : "secondary"} className={mfaEnrolled ? "bg-green-500" : ""}>
            {mfaEnrolled ? 'Enabled' : 'Disabled'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {mfaEnrolled ? (
          <>
            <Alert className="border-green-500/50 bg-green-500/10">
              <ShieldCheck className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-green-700 dark:text-green-400">
                Your account is protected with two-factor authentication using an authenticator app.
              </AlertDescription>
            </Alert>

            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Authenticator App</p>
                  <p className="text-xs text-muted-foreground">TOTP-based verification</p>
                </div>
              </div>
              
              <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                    <Trash2 className="w-4 h-4 mr-1" />
                    Remove
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-destructive">
                      <ShieldOff className="w-5 h-5" />
                      Disable Two-Factor Authentication
                    </DialogTitle>
                    <DialogDescription>
                      This will remove the extra security from your account. 
                      You'll need to set it up again later as MFA is mandatory.
                    </DialogDescription>
                  </DialogHeader>
                  
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Warning: Disabling MFA reduces your account security significantly.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2">
                    <Label htmlFor="confirm">Type DISABLE to confirm</Label>
                    <Input
                      id="confirm"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                      placeholder="DISABLE"
                    />
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowDisableDialog(false)}>
                      Cancel
                    </Button>
                    <Button 
                      variant="destructive" 
                      onClick={handleDisableMFA}
                      disabled={confirmText !== 'DISABLE' || disabling}
                    >
                      {disabling ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Disabling...
                        </>
                      ) : (
                        'Disable MFA'
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Protect your account by requiring a verification code from your authenticator 
              app when signing in. This is mandatory and must be set up within your grace period.
            </p>

            <Button onClick={() => setShowEnrollment(true)} className="w-full">
              <Shield className="w-4 h-4 mr-2" />
              Set Up Two-Factor Authentication
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};
