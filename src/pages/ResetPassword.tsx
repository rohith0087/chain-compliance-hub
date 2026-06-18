import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Shield, Lock, Eye, EyeOff, Check, X, AlertCircle, Smartphone, Key, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useMFA } from '@/hooks/useMFA';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';

// Strong password validation schema
const resetPasswordSchema = z.object({
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be less than 128 characters")
    .regex(/[A-Z]/, "Must contain uppercase letter")
    .regex(/[a-z]/, "Must contain lowercase letter")
    .regex(/[0-9]/, "Must contain a number")
    .regex(/[^A-Za-z0-9]/, "Must contain special character"),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"]
});

// Password requirements checker
const checkPasswordRequirements = (password: string) => [
  { label: 'At least 8 characters', met: password.length >= 8 },
  { label: 'Uppercase letter', met: /[A-Z]/.test(password) },
  { label: 'Lowercase letter', met: /[a-z]/.test(password) },
  { label: 'Number', met: /[0-9]/.test(password) },
  { label: 'Special character', met: /[^A-Za-z0-9]/.test(password) },
];

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // MFA states
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaVerified, setMfaVerified] = useState(false);
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [mfaError, setMfaError] = useState('');
  const [checkingMfa, setCheckingMfa] = useState(true);
  
  const navigate = useNavigate();
  const { updatePassword, session, user } = useAuth();
  const { mfaEnrolled, challengeAndVerify, checkMFAStatus } = useMFA();
  const { toast } = useToast();

  const passwordRequirements = useMemo(() => checkPasswordRequirements(password), [password]);

  // Check MFA status on mount
  useEffect(() => {
    const checkMfa = async () => {
      setCheckingMfa(true);
      await checkMFAStatus();
      setCheckingMfa(false);
    };
    
    if (session) {
      checkMfa();
    } else {
      setCheckingMfa(false);
    }
  }, [session]);

  // Set MFA requirement based on enrollment
  useEffect(() => {
    if (!checkingMfa) {
      setMfaRequired(mfaEnrolled);
    }
  }, [mfaEnrolled, checkingMfa]);

  // Handle TOTP verification
  const handleTotpVerification = async () => {
    if (mfaCode.length !== 6) {
      setMfaError('Please enter a 6-digit code');
      return;
    }

    setLoading(true);
    setMfaError('');

    try {
      const { error } = await challengeAndVerify(mfaCode);
      if (error) {
        setMfaError(error.message || 'Invalid verification code');
      } else {
        setMfaVerified(true);
        toast({
          title: "MFA Verified",
          description: "You can now set your new password.",
        });
      }
    } catch (err: any) {
      setMfaError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
      setMfaCode('');
    }
  };

  // Handle recovery code password reset (uses edge function)
  const handleRecoveryCodeReset = async () => {
    if (!recoveryCode.trim()) {
      setMfaError('Please enter a recovery code');
      return;
    }

    // Validate password first
    const validation = resetPasswordSchema.safeParse({ password, confirmPassword });
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.errors.forEach(err => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    setMfaError('');

    try {
      const { data, error } = await supabase.functions.invoke('reset-password-with-recovery', {
        body: { 
          recoveryCode: recoveryCode.trim(),
          newPassword: password
        }
      });

      if (error) {
        setMfaError(error.message || 'Failed to reset password');
        return;
      }

      if (!data.success) {
        setMfaError(data.error || 'Failed to reset password');
        return;
      }

      toast({
        title: "Password Updated Successfully",
        description: data.remainingCodes > 0 
          ? `Please sign in with your new password. You have ${data.remainingCodes} recovery codes remaining.`
          : "Please sign in with your new password. Consider generating new recovery codes.",
      });

      // Redirect to login page
      navigate('/auth');
    } catch (err: any) {
      setMfaError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Standard password update (after MFA verification or for non-MFA users)
  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    // Check for session at submission time
    if (!session) {
      toast({
        title: "Session Expired",
        description: "Your password reset link has expired. Please request a new one.",
        variant: "destructive",
      });
      setTimeout(() => navigate('/auth'), 2000);
      return;
    }
    
    // Validate with Zod schema
    const validation = resetPasswordSchema.safeParse({ password, confirmPassword });
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.errors.forEach(err => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);

    const { error } = await updatePassword(password);

    if (error) {
      toast({
        title: "Password Update Failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Password Updated Successfully",
        description: "Please sign in with your new password.",
      });

      // Clear password_reset_required flag if user exists
      if (user) {
        await supabase
          .from('company_users')
          .update({ password_reset_required: false })
          .eq('profile_id', user.id);
      }

      // Redirect to login page
      navigate('/auth');
    }
    setLoading(false);
  };

  // Loading state while checking MFA
  if (checkingMfa) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Checking security requirements...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // MFA Verification Step (show first if MFA enrolled and not verified)
  if (mfaRequired && !mfaVerified) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold">Verify Your Identity</CardTitle>
            <p className="text-sm text-muted-foreground">
              MFA is enabled on your account. Please verify to continue.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {!useRecoveryCode ? (
              // TOTP Verification
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Smartphone className="w-4 h-4" />
                  <span>Enter the code from your authenticator app</span>
                </div>
                
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={mfaCode}
                    onChange={(value) => setMfaCode(value)}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                {mfaError && (
                  <p className="text-sm text-destructive text-center flex items-center justify-center gap-1">
                    <AlertCircle className="w-4 h-4" /> {mfaError}
                  </p>
                )}

                <Button 
                  onClick={handleTotpVerification} 
                  className="w-full" 
                  disabled={loading || mfaCode.length !== 6}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Verify Code
                </Button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => { setUseRecoveryCode(true); setMfaError(''); }}
                    className="text-sm text-primary hover:underline"
                  >
                    Lost access to authenticator? Use recovery code
                  </button>
                </div>
              </div>
            ) : (
              // Recovery Code Flow (includes password fields)
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Key className="w-4 h-4" />
                  <span>Enter a recovery code and your new password</span>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="recoveryCode">Recovery Code</Label>
                  <Input
                    id="recoveryCode"
                    value={recoveryCode}
                    onChange={(e) => { setRecoveryCode(e.target.value.toUpperCase()); setMfaError(''); }}
                    placeholder="XXXX-XXXX"
                    className="font-mono text-center tracking-widest"
                    maxLength={10}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">New Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setErrors(prev => ({ ...prev, password: '' })); }}
                      placeholder="Enter new password"
                      className={`pr-10 ${errors.password ? 'border-destructive' : ''}`}
                      maxLength={128}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {errors.password}
                    </p>
                  )}
                  {password && (
                    <div className="space-y-1 pt-1">
                      {passwordRequirements.map((req, i) => (
                        <div key={i} className={`flex items-center gap-2 text-xs ${req.met ? 'text-green-600' : 'text-muted-foreground'}`}>
                          {req.met ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                          <span>{req.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); setErrors(prev => ({ ...prev, confirmPassword: '' })); }}
                      placeholder="Confirm new password"
                      className={`pr-10 ${errors.confirmPassword ? 'border-destructive' : ''}`}
                      maxLength={128}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {errors.confirmPassword}
                    </p>
                  )}
                </div>

                {mfaError && (
                  <p className="text-sm text-destructive text-center flex items-center justify-center gap-1">
                    <AlertCircle className="w-4 h-4" /> {mfaError}
                  </p>
                )}

                <Button 
                  onClick={handleRecoveryCodeReset} 
                  className="w-full" 
                  disabled={loading || !recoveryCode.trim() || !password || !confirmPassword}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Reset Password
                </Button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => { setUseRecoveryCode(false); setMfaError(''); setRecoveryCode(''); }}
                    className="text-sm text-primary hover:underline"
                  >
                    Back to authenticator verification
                  </button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Standard Password Reset Form (for non-MFA users or after MFA verification)
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold flex items-center gap-2 justify-center">
            <Lock className="w-6 h-6" />
            Reset Password
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {mfaVerified ? "MFA verified. Enter your new password." : "Enter your new password"}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setErrors(prev => ({ ...prev, password: '' })); }}
                  placeholder="Enter new password"
                  className={`pr-10 ${errors.password ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                  maxLength={128}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {errors.password}
                </p>
              )}
              
              {/* Password requirements checklist */}
              {password && (
                <div className="space-y-1 pt-2">
                  {passwordRequirements.map((req, i) => (
                    <div key={i} className={`flex items-center gap-2 text-xs ${req.met ? 'text-green-600' : 'text-muted-foreground'}`}>
                      {req.met ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      <span>{req.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setErrors(prev => ({ ...prev, confirmPassword: '' })); }}
                  placeholder="Confirm new password"
                  className={`pr-10 ${errors.confirmPassword ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                  maxLength={128}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {errors.confirmPassword}
                </p>
              )}
            </div>
            
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {loading ? "Updating..." : "Update Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
