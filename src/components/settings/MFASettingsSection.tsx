import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, ShieldCheck, ShieldOff, Trash2, Loader2, AlertCircle, RefreshCw, KeyRound } from 'lucide-react';
import { useMFA } from '@/hooks/useMFA';
import { useToast } from '@/hooks/use-toast';
import { MFAEnrollment } from '@/components/auth/MFAEnrollment';
import { RecoveryCodesDisplay } from '@/components/auth/RecoveryCodesDisplay';
import { supabase } from '@/integrations/supabase/client';

export const MFASettingsSection = () => {
  const { mfaEnrolled, factors, unenrollMFA, loading: mfaLoading, remainingRecoveryCodes, checkMFAStatus, cleanupExistingFactors } = useMFA();
  const { toast } = useToast();
  
  const [showEnrollment, setShowEnrollment] = useState(false);
  const [forceReenrollment, setForceReenrollment] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [disabling, setDisabling] = useState(false);
  const [regeneratingCodes, setRegeneratingCodes] = useState(false);
  const [newRecoveryCodes, setNewRecoveryCodes] = useState<string[]>([]);

  const handleDisableMFA = async () => {
    if (confirmText !== 'DISABLE') {
      return;
    }

    setDisabling(true);
    
    // Clean up ALL existing factors (verified and unverified)
    const cleanupResult = await cleanupExistingFactors();

    if (!cleanupResult.success) {
      toast({
        title: "Error",
        description: "Failed to disable MFA. Please try again.",
        variant: "destructive",
      });
      setDisabling(false);
      return;
    }
    
    toast({
      title: "MFA Disabled",
      description: "Two-factor authentication has been disabled for your account.",
    });

    setShowDisableDialog(false);
    setConfirmText('');
    setDisabling(false);
    
    // Refresh MFA status
    checkMFAStatus();
  };

  const handleRegenerateRecoveryCodes = async () => {
    setRegeneratingCodes(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Error",
          description: "Session expired. Please sign in again.",
          variant: "destructive",
        });
        setRegeneratingCodes(false);
        return;
      }

      const response = await supabase.functions.invoke('generate-mfa-recovery-codes', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (response.data?.codes) {
        setNewRecoveryCodes(response.data.codes);
      } else {
        toast({
          title: "Error",
          description: "Failed to generate new recovery codes.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error regenerating codes:', error);
      toast({
        title: "Error",
        description: "Failed to generate new recovery codes.",
        variant: "destructive",
      });
    }
    
    setRegeneratingCodes(false);
  };

  // Show new recovery codes after regeneration
  if (newRecoveryCodes.length > 0) {
    return (
      <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
        <RecoveryCodesDisplay
          codes={newRecoveryCodes} 
          onConfirm={() => {
            setNewRecoveryCodes([]);
            checkMFAStatus();
          }}
        />
      </div>
    );
  }

  // Enrollment mode (either initial or forced re-enrollment)
  if (showEnrollment) {
    return (
      <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
        <MFAEnrollment
          mandatory={forceReenrollment}
          onComplete={() => {
            setShowEnrollment(false);
            setForceReenrollment(false);
          }}
          onSkip={forceReenrollment ? undefined : () => setShowEnrollment(false)}
        />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${mfaEnrolled ? 'bg-success/10' : 'bg-muted'}`}>
              {mfaEnrolled ? (
                <ShieldCheck className="w-5 h-5 text-success" />
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
          <Badge variant={mfaEnrolled ? "default" : "secondary"} className={mfaEnrolled ? "bg-success" : ""}>
            {mfaEnrolled ? 'Enabled' : 'Disabled'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {mfaEnrolled ? (
          <>
            <Alert className="border-success/50 bg-success/10">
              <ShieldCheck className="h-4 w-4 text-success" />
              <AlertDescription className="text-success">
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
                      This will remove your current MFA setup. Your account will no longer require a verification code when signing in.
                    </DialogDescription>
                  </DialogHeader>
                  
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Warning: Disabling MFA will make your account less secure. You can re-enable it anytime from settings.
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

            {/* Recovery Codes Section */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <KeyRound className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Recovery Codes</p>
                  <p className="text-xs text-muted-foreground">
                    {remainingRecoveryCodes !== null 
                      ? `${remainingRecoveryCodes} codes remaining`
                      : 'Backup access codes'
                    }
                  </p>
                </div>
              </div>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRegenerateRecoveryCodes}
                disabled={regeneratingCodes}
              >
                {regeneratingCodes ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Regenerate
                  </>
                )}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Protect your account by requiring a verification code from your authenticator 
              app when signing in.
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
