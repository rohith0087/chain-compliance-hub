import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Shield, AlertCircle, Building2, ShoppingCart, Mail, Eye, EyeOff, Check, X, Lock, Sparkles, KeyRound, Timer, Fingerprint } from 'lucide-react';
import { startAuthentication } from '@simplewebauthn/browser';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';
import { HelpButton } from '@/components/support/HelpButton';
import { useToast } from '@/hooks/use-toast';
import ParticleBackground from './ParticleBackground';
import { TurnstileWidget } from './TurnstileWidget';
import { supabase } from '@/integrations/supabase/client';
import { BackgroundBeamsWithCollision } from '@/components/ui/background-beams-with-collision';
import { z } from 'zod';

// --- Rate Limiting Utilities ---
const LOCKOUT_TIERS = [
  { threshold: 5, durationMs: 30_000 },   // 5 failures = 30s
  { threshold: 10, durationMs: 300_000 },  // 10 failures = 5min
];

const MFA_MAX_ATTEMPTS = 5;
const MFA_LOCKOUT_MS = 60_000; // 60s
const MFA_FORCE_SIGNOUT_ATTEMPTS = 8;

const RESET_COOLDOWN_MS = 60_000; // 60s between password resets
const SIGNUP_COOLDOWN_MS = 30_000; // 30s after signup

function getLockoutDuration(failCount: number): number {
  for (let i = LOCKOUT_TIERS.length - 1; i >= 0; i--) {
    if (failCount >= LOCKOUT_TIERS[i].threshold) return LOCKOUT_TIERS[i].durationMs;
  }
  return 0;
}

function useCountdown(endTime: number | null): number {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (!endTime) { setRemaining(0); return; }
    const tick = () => {
      const left = Math.max(0, endTime - Date.now());
      setRemaining(left);
      if (left <= 0) return;
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endTime]);
  return remaining;
}

// Validation schemas with security hardening
const signInSchema = z.object({
  email: z.string().trim()
    .email("Please enter a valid email address")
    .max(255, "Email must be less than 255 characters"),
  password: z.string()
    .min(1, "Password is required")
    .max(128, "Password must be less than 128 characters")
});

const signUpSchema = z.object({
  fullName: z.string().trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters"),
  companyName: z.string().trim().max(100, "Company name too long").optional(),
  email: z.string().trim().email("Please enter a valid email address"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain uppercase letter")
    .regex(/[a-z]/, "Must contain lowercase letter")
    .regex(/[0-9]/, "Must contain a number")
    .regex(/[^A-Za-z0-9]/, "Must contain special character"),
  roles: z.array(z.enum(['buyer', 'supplier'])).min(1, "Select at least one role")
});

// Password strength calculator
const getPasswordStrength = (password: string) => {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  
  if (score <= 2) return { label: 'Weak', color: 'bg-destructive', width: '33%' };
  if (score <= 4) return { label: 'Medium', color: 'bg-yellow-500', width: '66%' };
  return { label: 'Strong', color: 'bg-green-500', width: '100%' };
};

// Password requirements checker
const checkPasswordRequirements = (password: string) => [
  { label: 'At least 8 characters', met: password.length >= 8 },
  { label: 'Uppercase letter', met: /[A-Z]/.test(password) },
  { label: 'Lowercase letter', met: /[a-z]/.test(password) },
  { label: 'Number', met: /[0-9]/.test(password) },
  { label: 'Special character', met: /[^A-Za-z0-9]/.test(password) },
];

// Check if Turnstile is enabled via environment variable
const isTurnstileEnabled = import.meta.env.VITE_TURNSTILE_ENABLED === 'true';

const Wordmark = ({ size = 24, className = "", invertLogo = false }: { size?: number, className?: string, invertLogo?: boolean }) => (
  <span className={`flex items-center gap-3 ${className}`}>
    <img src="/logo.png" alt="TraceR2C Logo" className={`object-contain ${invertLogo ? 'brightness-0 invert' : ''}`} style={{ width: size * 1.6, height: size * 1.6 }} />
    <span className="flex items-baseline gap-2">
      <span className="font-serif leading-none" style={{ fontSize: size }}>
        TraceR2C
      </span>
      <span className="hidden font-data text-[10px] uppercase tracking-[0.2em] opacity-70 sm:inline">
        / compliance OS
      </span>
    </span>
  </span>
);

const AuthPage = () => {
  const navigate = useNavigate();

  const nav = [
    { label: 'Platform', href: '/#platform' },
    { label: 'How it reads', href: '/#how' },
    { label: 'Solutions', href: '/#solutions' },
  ];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<('buyer' | 'supplier')[]>(['supplier']);
  const [loading, setLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState('login');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<{ reset: () => void } | null>(null);
  const [resetTurnstileToken, setResetTurnstileToken] = useState<string | null>(null);
  
  // 2FA inline state
  const [authStep, setAuthStep] = useState<'credentials' | 'mfa'>('credentials');
  const [mfaCode, setMfaCode] = useState('');
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [mfaLoading, setMfaLoading] = useState(false);

  // --- Rate limiting state ---
  const [loginFailCount, setLoginFailCount] = useState(0);
  const [loginLockoutUntil, setLoginLockoutUntil] = useState<number | null>(null);
  const [mfaFailCount, setMfaFailCount] = useState(0);
  const [mfaLockoutUntil, setMfaLockoutUntil] = useState<number | null>(null);
  const [resetCooldownUntil, setResetCooldownUntil] = useState<number | null>(null);
  const [signupCooldownUntil, setSignupCooldownUntil] = useState<number | null>(null);

  const loginCooldownRemaining = useCountdown(loginLockoutUntil);
  const mfaCooldownRemaining = useCountdown(mfaLockoutUntil);
  const resetCooldownRemaining = useCountdown(resetCooldownUntil);
  const signupCooldownRemaining = useCountdown(signupCooldownUntil);

  const isLoginLocked = loginCooldownRemaining > 0;
  const isMfaLocked = mfaCooldownRemaining > 0;
  const isResetCooling = resetCooldownRemaining > 0;
  const isSignupCooling = signupCooldownRemaining > 0;
  
  const { signIn, signUp, resetPassword } = useAuth();
  const { toast } = useToast();

  const passwordStrength = useMemo(() => getPasswordStrength(password), [password]);
  const passwordRequirements = useMemo(() => checkPasswordRequirements(password), [password]);

  const resetTurnstile = useCallback(() => {
    setTurnstileToken(null);
    turnstileRef.current?.reset();
  }, []);

  const checkTurnstileToken = (): boolean => {
    // Skip Turnstile check if disabled
    if (!isTurnstileEnabled) {
      return true;
    }
    if (!turnstileToken) {
      toast({
        title: "Verification Required",
        description: "Please complete the security verification.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Check lockout
    if (isLoginLocked) {
      toast({
        title: "Too Many Attempts",
        description: `Please wait ${Math.ceil(loginCooldownRemaining / 1000)}s before trying again.`,
        variant: "destructive",
      });
      return;
    }
    
    const validation = signInSchema.safeParse({ email: email.trim(), password });
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.errors.forEach(err => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }
    
    // Check Turnstile token exists
    if (!checkTurnstileToken()) {
      return;
    }
    
    setLoading(true);
    
    // Pass token directly to Supabase Auth for server-side validation (undefined if disabled)
    const { error } = await signIn(email.trim(), password, isTurnstileEnabled ? turnstileToken! : undefined);
    
    if (error) {
      const newFailCount = loginFailCount + 1;
      setLoginFailCount(newFailCount);
      const lockout = getLockoutDuration(newFailCount);
      if (lockout > 0) {
        setLoginLockoutUntil(Date.now() + lockout);
      }
      toast({
        title: "Sign In Failed",
        description: error?.message || (typeof error === 'object' && Object.keys(error).length === 0 ? "Invalid email or password." : JSON.stringify(error)),
        variant: "destructive",
      });
      resetTurnstile();
      setLoading(false);
      return;
    }
    
    // Reset on success
    setLoginFailCount(0);
    setLoginLockoutUntil(null);
    
    // Check if user needs MFA verification
    const { data: factorsData } = await supabase.auth.mfa.listFactors();
    const hasVerifiedTOTP = factorsData?.totp?.some(f => f.status === 'verified');
    
    if (hasVerifiedTOTP) {
      // Show MFA input within the same card
      setAuthStep('mfa');
    }
    // If no MFA, the auth state change will redirect to dashboard
    setLoading(false);
  };

  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const passkeySupported = typeof window !== 'undefined' && !!window.PublicKeyCredential;

  const handlePasskeySignIn = async () => {
    setPasskeyLoading(true);
    try {
      const beginRes = await supabase.functions.invoke('passkey-auth-begin', {
        body: email.trim() ? { email: email.trim() } : {},
      });
      if (beginRes.error || !beginRes.data) {
        throw new Error(beginRes.error?.message || 'Failed to start passkey sign-in');
      }

      const assertion = await startAuthentication({ optionsJSON: beginRes.data });

      const finishRes = await supabase.functions.invoke('passkey-auth-finish', {
        body: { response: assertion },
      });
      if (finishRes.error || !finishRes.data?.verified || !finishRes.data?.token_hash) {
        throw new Error(finishRes.error?.message || 'Passkey verification failed');
      }

      const { error: verifyErr } = await supabase.auth.verifyOtp({
        token_hash: finishRes.data.token_hash,
        type: 'magiclink',
      });
      if (verifyErr) throw verifyErr;

      toast({ title: 'Signed in', description: 'Welcome back.' });
      // Auth state change handles navigation
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        // User cancelled; stay quiet
      } else {
        toast({
          title: 'Passkey sign-in failed',
          description: err?.message || 'Please try again or use your password.',
          variant: 'destructive',
        });
      }
    } finally {
      setPasskeyLoading(false);
    }
  };


  const handleMFAVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setMfaError(null);

    // Check MFA lockout
    if (isMfaLocked) {
      setMfaError(`Too many attempts. Wait ${Math.ceil(mfaCooldownRemaining / 1000)}s.`);
      return;
    }

    const recordMfaFailure = async () => {
      const newCount = mfaFailCount + 1;
      setMfaFailCount(newCount);
      if (newCount >= MFA_FORCE_SIGNOUT_ATTEMPTS) {
        setMfaError('Too many failed attempts. You have been signed out.');
        await supabase.auth.signOut();
        setAuthStep('credentials');
        setMfaCode('');
        setMfaFailCount(0);
        setMfaLockoutUntil(null);
        return;
      }
      if (newCount >= MFA_MAX_ATTEMPTS) {
        setMfaLockoutUntil(Date.now() + MFA_LOCKOUT_MS);
      }
    };
    
    if (useRecoveryCode) {
      if (!mfaCode.trim()) {
        setMfaError('Please enter a recovery code');
        return;
      }
      setMfaLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      const response = await supabase.functions.invoke('verify-mfa-recovery-code', {
        body: { code: mfaCode.trim() },
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });
      
      if (response.data?.valid) {
        setMfaFailCount(0);
        toast({ title: "Verified", description: `Recovery code accepted. ${response.data.remainingCodes} codes remaining.` });
      } else {
        await recordMfaFailure();
        setMfaError(response.data?.error || 'Invalid recovery code');
        setMfaCode('');
      }
      setMfaLoading(false);
      return;
    }
    
    // Standard TOTP verification
    if (mfaCode.length !== 6) {
      setMfaError('Please enter a valid 6-digit code');
      return;
    }
    
    setMfaLoading(true);
    
    const { data: factorsData } = await supabase.auth.mfa.listFactors();
    const factor = factorsData?.totp?.find(f => f.status === 'verified');
    
    if (!factor) {
      setMfaError('No MFA factor found');
      setMfaLoading(false);
      return;
    }
    
    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: factor.id });
    
    if (challengeError || !challengeData) {
      setMfaError('Failed to create MFA challenge');
      setMfaLoading(false);
      return;
    }
    
    const { error } = await supabase.auth.mfa.verify({
      factorId: factor.id,
      challengeId: challengeData.id,
      code: mfaCode
    });
    
    if (error) {
      await recordMfaFailure();
      setMfaError('Invalid verification code');
      setMfaCode('');
    } else {
      setMfaFailCount(0);
      toast({ title: "Verified", description: "Login successful." });
    }
    setMfaLoading(false);
  };

  const handleCancelMFA = async () => {
    await supabase.auth.signOut();
    setAuthStep('credentials');
    setMfaCode('');
    setMfaError(null);
    setUseRecoveryCode(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    const validation = signUpSchema.safeParse({
      fullName: fullName.trim(),
      companyName: companyName.trim() || undefined,
      email: email.trim(),
      password,
      roles: selectedRoles
    });
    
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.errors.forEach(err => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }
    
    // Check Turnstile token exists
    if (!checkTurnstileToken()) {
      return;
    }
    
    setLoading(true);
    
    // Pass token directly to Supabase Auth for server-side validation (undefined if disabled)
    const { error } = await signUp(email.trim(), password, fullName.trim(), selectedRoles, companyName.trim() || undefined, isTurnstileEnabled ? turnstileToken! : undefined);
    
    if (error) {
      toast({
        title: "Sign Up Failed",
        description: error.message,
        variant: "destructive",
      });
      resetTurnstile();
    } else {
      toast({
        title: "Account Created",
        description: "Please check your email to verify your account.",
      });
      setEmail('');
      setPassword('');
      setFullName('');
      setCompanyName('');
      setSelectedRoles(['supplier']);
      resetTurnstile();
      // Signup cooldown to prevent re-submission
      setSignupCooldownUntil(Date.now() + SIGNUP_COOLDOWN_MS);
    }
    setLoading(false);
  };

  const toggleRole = (role: 'buyer' | 'supplier') => {
    setSelectedRoles(prev => {
      if (prev.includes(role)) {
        return prev.filter(r => r !== role);
      } else {
        return [...prev, role];
      }
    });
    setErrors(prev => ({ ...prev, roles: '' }));
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isResetCooling) {
      toast({
        title: "Please Wait",
        description: `You can request another reset in ${Math.ceil(resetCooldownRemaining / 1000)}s.`,
        variant: "destructive",
      });
      return;
    }

    const emailValidation = z.string().trim().email().safeParse(resetEmail);
    if (!emailValidation.success) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }
    
    if (isTurnstileEnabled && !resetTurnstileToken) {
      toast({
        title: "Verification Required",
        description: "Please complete the security check.",
        variant: "destructive",
      });
      return;
    }

    setResetLoading(true);
    setResetCooldownUntil(Date.now() + RESET_COOLDOWN_MS);
    const { error } = await resetPassword(resetEmail.trim(), isTurnstileEnabled ? resetTurnstileToken! : undefined);

    if (error) {
      toast({
        title: "Reset Failed",
        description: error.message,
        variant: "destructive",
      });
      setResetTurnstileToken(null);
    } else {
      toast({
        title: "Reset Email Sent",
        description: "If an account exists with this email, you'll receive reset instructions.",
      });
      setResetEmail('');
      setResetTurnstileToken(null);
      setResetDialogOpen(false);
    }
    setResetLoading(false);
  };

  const handleGoogleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      toast({
        title: "Google sign-in failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };


  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white px-4 py-10 relative overflow-hidden">
      {/* Accent dot top-right */}
      <span aria-hidden className="absolute top-6 right-8 h-1.5 w-1.5 rounded-full bg-[#6366F1]" />

      {/* Centered two-pane card */}
      <div className="grid w-full max-w-[960px] grid-cols-1 lg:grid-cols-2 rounded-2xl overflow-hidden border border-white/[0.06] bg-[#0B0B0F] shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)]">

        {/* Left Hero Pane */}
        <div
          className="relative hidden lg:flex flex-col justify-between min-h-[600px] p-10 overflow-hidden"
          style={{
            // Teal ledger ramp, matching the marketing site's dark evidence
            // sections. Was a magenta/purple ramp from the old brand.
            backgroundImage:
              "radial-gradient(120% 90% at 85% 15%, #0d9e8a 0%, #0a7a6b 34%, #0f2e30 72%, #0a151b 100%)",
          }}
        >
          {/* Grain overlay */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none opacity-[0.35] mix-blend-overlay"
            style={{ backgroundImage: "url('/grain-texture.webp')", backgroundSize: '420px 420px', backgroundRepeat: 'repeat' }}
          />

          {/* Wordmark top-left — links out to the public marketing site */}
          <a
            href="https://tracer2c.com"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="TraceR2C home"
            className="relative z-10 inline-flex items-start text-white hover:opacity-80 transition-opacity"
          >
            <Wordmark size={22} invertLogo className="text-white" />
          </a>

          {/* Testimonial */}
          <div className="relative z-10 max-w-[320px]">
            <div className="font-serif text-6xl leading-none text-white/30 mb-3 select-none">"</div>
            <p className="font-serif italic text-[22px] leading-[1.35] text-white">
              Compliance you can read at a glance — every certificate, every clause, every supplier, in one place.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-white/10 ring-1 ring-white/20 flex items-center justify-center overflow-hidden">
                <img src="/logo.png" alt="" className="h-6 w-6 object-contain brightness-0 invert opacity-90" />
              </div>
              <div className="leading-tight">
                <div className="text-sm font-semibold text-white">TraceR2C Team</div>
                <div className="text-xs text-white/55">@tracer2c</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Form Pane */}
        <div className="relative bg-[#0B0B0F] p-8 sm:p-10 flex flex-col justify-center min-h-[600px]">
          {/* Grain overlay */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none opacity-[0.12] mix-blend-overlay"
            style={{ backgroundImage: "url('/grain-texture.webp')", backgroundSize: '420px 420px', backgroundRepeat: 'repeat' }}
          />

          {/* Mobile wordmark — same outbound link as the desktop wordmark */}
          <div className="flex lg:hidden items-center justify-center mb-6 relative z-10">
            <a
              href="https://tracer2c.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="TraceR2C home"
              className="inline-flex text-white hover:opacity-80 transition-opacity"
            >
              <Wordmark size={22} invertLogo className="text-white" />
            </a>
          </div>

          <div className="auth-plasma relative z-10 w-full max-w-sm mx-auto">
            <div className="mb-6">
              <h2 className="text-[22px] font-semibold text-white tracking-tight">
                {authStep === 'mfa' ? 'Verify Identity' : 'Welcome to TraceR2C'}
              </h2>
              <p className="text-[13px] text-white/55 mt-1">
                {authStep === 'mfa'
                  ? 'Complete two-factor authentication'
                  : 'Sign up or sign in to your account'}
              </p>
            </div>

            {/* Google sign-in (hidden during MFA & signup-only flows show it too) */}
            {authStep === 'credentials' && (
              <>
                <Button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-full h-11 mb-4 bg-[#1A1A1F] hover:bg-[#22222A] border border-white/[0.08] text-white font-medium rounded-md flex items-center justify-center gap-3"
                >
                  <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
                    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/>
                    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
                    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.5-5.2l-6.2-5.2C29.2 35 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
                    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.6l6.2 5.2C40.9 35.5 44 30.2 44 24c0-1.2-.1-2.3-.4-3.5z"/>
                  </svg>
                  Continue with Google
                </Button>

                <div className="relative my-5">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-white/[0.08]" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-[#0B0B0F] px-3 text-[11px] uppercase tracking-wider text-white/40">or</span>
                  </div>
                </div>
              </>
            )}


              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                {authStep === 'credentials' && (
                  <TabsList className="grid w-full grid-cols-2 mb-6 bg-[var(--r2c-surface-2)]">
                    <TabsTrigger value="login" className="data-[state=active]:bg-[var(--r2c-stamp)] data-[state=active]:text-white text-[var(--r2c-muted)]">
                      Login
                    </TabsTrigger>
                    <TabsTrigger value="signup" className="data-[state=active]:bg-[var(--r2c-stamp)] data-[state=active]:text-white text-[var(--r2c-muted)]">
                      Sign Up
                    </TabsTrigger>
                  </TabsList>
                )}
                
                <TabsContent value="login" className="mt-0">
                  {authStep === 'credentials' ? (
                    <form onSubmit={handleSignIn} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-foreground">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => { setEmail(e.target.value); setErrors(prev => ({ ...prev, email: '' })); }}
                          placeholder="Enter your email"
                          className={`h-11 ${errors.email ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                          disabled={loading}
                          maxLength={255}
                        />
                        {errors.email && (
                          <p className="text-xs text-destructive flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> {errors.email}
                          </p>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="password" className="text-foreground">Password</Label>
                        <div className="relative">
                          <Input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => { setPassword(e.target.value); setErrors(prev => ({ ...prev, password: '' })); }}
                            placeholder="Enter your password"
                            className={`h-11 pr-10 ${errors.password ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                            disabled={loading}
                            maxLength={128}
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
                      </div>
                      
                      {/* Turnstile Widget - only show when enabled */}
                      {isTurnstileEnabled && (
                        <TurnstileWidget
                          siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY || ''}
                          onSuccess={(token) => setTurnstileToken(token)}
                          onExpire={() => setTurnstileToken(null)}
                          onError={() => setTurnstileToken(null)}
                        />
                      )}
                      
                      <Button type="submit" className="r2c-glass-btn w-full h-11 text-slate-900 dark:text-white hover:text-slate-900 dark:hover:text-white" disabled={loading || isLoginLocked || (isTurnstileEnabled && !turnstileToken)}>
                        {isLoginLocked 
                          ? `Locked (${Math.ceil(loginCooldownRemaining / 1000)}s)` 
                          : loading ? "Logging In..." : "Login"}
                      </Button>
                      {isLoginLocked && (
                        <p className="text-xs text-destructive flex items-center gap-1 justify-center">
                          <Timer className="w-3 h-3" /> Too many failed attempts. Please wait.
                        </p>
                      )}
                      
                      {passkeySupported && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handlePasskeySignIn}
                          disabled={passkeyLoading || loading}
                          className="w-full h-11 border-[var(--r2c-line)] bg-[var(--r2c-surface-2)]/50 hover:bg-[var(--r2c-surface-2)] text-[var(--r2c-ink)] gap-2"
                        >
                          <Fingerprint className="w-4 h-4" />
                          {passkeyLoading ? 'Waiting for passkey…' : 'Sign in with a passkey'}
                        </Button>
                      )}
                      
                      <div className="text-center">
                        <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                          <DialogTrigger asChild>
                            <Button variant="link" className="text-sm text-muted-foreground hover:text-primary p-0 h-auto">
                              Forgot your password?
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="r2c sm:max-w-md bg-[var(--r2c-surface)]/80 backdrop-blur-2xl border-[var(--r2c-line)] text-[var(--r2c-ink)] shadow-[0_16px_32px_-12px_rgba(20,24,31,0.5)]">
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-2">
                                <Mail className="w-5 h-5 text-[var(--r2c-stamp)]" />
                                Reset Password
                              </DialogTitle>
                              <DialogDescription>
                                Enter your email address and we'll send you a link to reset your password.
                              </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleForgotPassword} className="space-y-4">
                              <div>
                                <Label htmlFor="resetEmail">Email</Label>
                                <Input
                                  id="resetEmail"
                                  type="email"
                                  value={resetEmail}
                                  onChange={(e) => setResetEmail(e.target.value)}
                                  placeholder="Enter your email"
                                  className="h-11"
                                  maxLength={255}
                                  required
                                />
                              </div>
                              {isTurnstileEnabled && (
                                <TurnstileWidget
                                  siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
                                  onSuccess={(token) => setResetTurnstileToken(token)}
                                  onExpire={() => setResetTurnstileToken(null)}
                                  onError={() => setResetTurnstileToken(null)}
                                />
                              )}
                              <div className="flex gap-2">
                                <Button 
                                  type="button" 
                                  variant="outline" 
                                  className="flex-1 border-[var(--r2c-line)] hover:bg-[var(--r2c-surface-2)] text-[var(--r2c-ink)]"
                                  onClick={() => setResetDialogOpen(false)}
                                >
                                  Cancel
                                </Button>
                              <Button type="submit" className="flex-1 bg-[var(--r2c-stamp)] hover:bg-[var(--r2c-stamp-deep)] text-white" disabled={resetLoading || isResetCooling || (isTurnstileEnabled && !resetTurnstileToken)}>
                                   {isResetCooling ? `Wait ${Math.ceil(resetCooldownRemaining / 1000)}s` : resetLoading ? "Sending..." : "Send Reset Link"}
                                </Button>
                              </div>
                            </form>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </form>
                  ) : (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                      <div className="text-center">
                        <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
                          {useRecoveryCode ? (
                            <KeyRound className="w-8 h-8 text-primary" />
                          ) : (
                            <Shield className="w-8 h-8 text-primary" />
                          )}
                        </div>
                        <h3 className="text-lg font-semibold text-foreground">
                          {useRecoveryCode ? 'Use Recovery Code' : 'Two-Factor Authentication'}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {useRecoveryCode 
                            ? 'Enter one of your saved recovery codes'
                            : 'Enter the 6-digit code from your authenticator app'
                          }
                        </p>
                      </div>

                      <form onSubmit={handleMFAVerify} className="space-y-4">
                        {mfaError && (
                          <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{mfaError}</AlertDescription>
                          </Alert>
                        )}
                        
                        <Input
                          type="text"
                          inputMode={useRecoveryCode ? 'text' : 'numeric'}
                          pattern={useRecoveryCode ? undefined : '[0-9]*'}
                          maxLength={useRecoveryCode ? 20 : 6}
                          value={mfaCode}
                          onChange={(e) => setMfaCode(
                            useRecoveryCode 
                              ? e.target.value.toUpperCase() 
                              : e.target.value.replace(/\D/g, '')
                          )}
                          placeholder={useRecoveryCode ? 'XXXX-XXXX' : '000000'}
                          className={`text-center h-14 font-mono ${
                            useRecoveryCode ? 'text-lg tracking-wider' : 'text-2xl tracking-[0.4em]'
                          }`}
                          autoFocus
                          disabled={mfaLoading}
                        />
                        
                        <Button 
                          type="submit" 
                          className="w-full h-11 font-semibold bg-[var(--r2c-stamp)] hover:bg-[var(--r2c-stamp-deep)] text-white" 
                          disabled={mfaLoading || isMfaLocked || (useRecoveryCode ? !mfaCode.trim() : mfaCode.length !== 6)}
                        >
                          {isMfaLocked 
                            ? `Locked (${Math.ceil(mfaCooldownRemaining / 1000)}s)` 
                            : mfaLoading ? "Verifying..." : "Verify"}
                        </Button>
                        
                        <div className="relative">
                          <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                          </div>
                          <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-card px-2 text-muted-foreground">or</span>
                          </div>
                        </div>
                        
                        <Button 
                          type="button"
                          variant="outline" 
                          onClick={() => {
                            setUseRecoveryCode(!useRecoveryCode);
                            setMfaCode('');
                            setMfaError(null);
                          }} 
                          className="w-full"
                        >
                          <KeyRound className="w-4 h-4 mr-2" />
                          {useRecoveryCode ? 'Use authenticator app' : 'Lost access? Use recovery code'}
                        </Button>
                        
                        <Button 
                          type="button"
                          variant="ghost" 
                          onClick={handleCancelMFA} 
                          className="w-full text-muted-foreground"
                        >
                          Cancel & Sign Out
                        </Button>
                      </form>
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="signup" className="mt-0">
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="fullName" className="text-foreground">Full Name</Label>
                      <Input
                        id="fullName"
                        type="text"
                        value={fullName}
                        onChange={(e) => { setFullName(e.target.value); setErrors(prev => ({ ...prev, fullName: '' })); }}
                        placeholder="Enter your full name"
                        className={`h-11 ${errors.fullName ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                        disabled={loading}
                        maxLength={100}
                      />
                      {errors.fullName && (
                        <p className="text-xs text-destructive flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> {errors.fullName}
                        </p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="companyName" className="text-foreground">Company Name <span className="text-muted-foreground">(Optional)</span></Label>
                      <Input
                        id="companyName"
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Enter your company name"
                        className="h-11"
                        disabled={loading}
                        maxLength={100}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="signupEmail" className="text-foreground">Email</Label>
                      <Input
                        id="signupEmail"
                        type="email"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setErrors(prev => ({ ...prev, email: '' })); }}
                        placeholder="Enter your email"
                        className={`h-11 ${errors.email ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                        disabled={loading}
                      />
                      {errors.email && (
                        <p className="text-xs text-destructive flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> {errors.email}
                        </p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="signupPassword" className="text-foreground">Password</Label>
                      <div className="relative">
                        <Input
                          id="signupPassword"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => { setPassword(e.target.value); setErrors(prev => ({ ...prev, password: '' })); }}
                          placeholder="Create a password"
                          className={`h-11 pr-10 ${errors.password ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                          disabled={loading}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      
                      {/* Password Strength Indicator */}
                      {password && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${passwordStrength.color} transition-all duration-300`}
                                style={{ width: passwordStrength.width }}
                              />
                            </div>
                            <span className={`text-xs font-medium ${
                              passwordStrength.label === 'Weak' ? 'text-destructive' :
                              passwordStrength.label === 'Medium' ? 'text-yellow-600' : 'text-green-600'
                            }`}>
                              {passwordStrength.label}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-1">
                            {passwordRequirements.map((req, i) => (
                              <div key={i} className="flex items-center gap-1.5 text-xs">
                                {req.met ? (
                                  <Check className="w-3 h-3 text-green-600" />
                                ) : (
                                  <X className="w-3 h-3 text-muted-foreground" />
                                )}
                                <span className={req.met ? 'text-green-600' : 'text-muted-foreground'}>
                                  {req.label}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {errors.password && (
                        <p className="text-xs text-destructive flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> {errors.password}
                        </p>
                      )}
                    </div>
                    
                    <div className="space-y-3">
                      <Label className="text-foreground">Select your role(s)</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <button 
                          type="button"
                          onClick={() => toggleRole('buyer')}
                          disabled={loading}
                          className={`p-3 rounded-lg border-2 text-left transition-all ${
                            selectedRoles.includes('buyer') 
                              ? 'border-primary bg-primary/5' 
                              : 'border-border hover:border-primary/50'
                          } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                              selectedRoles.includes('buyer') 
                                ? 'bg-primary border-primary' 
                                : 'border-muted-foreground'
                            }`}>
                              {selectedRoles.includes('buyer') && <Check className="w-3 h-3 text-primary-foreground" />}
                            </div>
                            <ShoppingCart className="w-4 h-4 text-primary" />
                          </div>
                          <p className="text-sm font-medium mt-2 text-foreground">Buyer</p>
                          <p className="text-xs text-muted-foreground">Request documents</p>
                        </button>
                        
                        <button 
                          type="button"
                          onClick={() => toggleRole('supplier')}
                          disabled={loading}
                          className={`p-3 rounded-lg border-2 text-left transition-all ${
                            selectedRoles.includes('supplier') 
                              ? 'border-primary bg-primary/5' 
                              : 'border-border hover:border-primary/50'
                          } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                              selectedRoles.includes('supplier') 
                                ? 'bg-primary border-primary' 
                                : 'border-muted-foreground'
                            }`}>
                              {selectedRoles.includes('supplier') && <Check className="w-3 h-3 text-primary-foreground" />}
                            </div>
                            <Building2 className="w-4 h-4 text-primary" />
                          </div>
                          <p className="text-sm font-medium mt-2 text-foreground">Supplier</p>
                          <p className="text-xs text-muted-foreground">Provide documents</p>
                        </button>
                      </div>
                      {errors.roles && (
                        <p className="text-xs text-destructive flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> {errors.roles}
                        </p>
                      )}
                    </div>
                    
                    {/* Turnstile Widget - only show when enabled */}
                    {isTurnstileEnabled && (
                      <TurnstileWidget
                        siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY || ''}
                        onSuccess={(token) => setTurnstileToken(token)}
                        onExpire={() => setTurnstileToken(null)}
                        onError={() => setTurnstileToken(null)}
                      />
                    )}
                    
                    <Button 
                      type="submit" 
                      className="r2c-glass-btn w-full h-11 text-slate-900 dark:text-white hover:text-slate-900 dark:hover:text-white" 
                      disabled={loading || isSignupCooling || selectedRoles.length === 0 || (isTurnstileEnabled && !turnstileToken)}
                    >
                      {isSignupCooling 
                        ? `Please wait (${Math.ceil(signupCooldownRemaining / 1000)}s)` 
                        : loading ? "Creating Account..." : "Create Account"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>

              {/* Sign-in / Sign-up toggle line (matches reference) */}
              {authStep === 'credentials' && (
                <p className="text-center text-sm text-white/55 mt-5">
                  {activeTab === 'login' ? (
                    <>Don't have an account?{' '}
                      <button type="button" onClick={() => setActiveTab('signup')} className="text-[#2fbf8f] hover:text-[#5fd4ab] font-medium">Sign up</button>
                    </>
                  ) : (
                    <>Already have an account?{' '}
                      <button type="button" onClick={() => setActiveTab('login')} className="text-[#2fbf8f] hover:text-[#5fd4ab] font-medium">Sign in</button>
                    </>
                  )}
                </p>
              )}
            </div>
          </div>
        </div>


      {/* Legal footer below the card */}
      <p className="text-center text-xs text-white/45 mt-6 max-w-md leading-relaxed">
        By continuing, you agree to TraceR2C's{' '}
        <a href="/terms" className="underline hover:text-white/70">Terms of Service</a>{' '}and{' '}
        <a href="/privacy" className="underline hover:text-white/70">Privacy Policy</a>,
        <br />
        and to receive periodic emails with updates.
      </p>

      {/* Floating Help Button for unauthenticated users */}
      <HelpButton
        source="login_page"
        user={{
          email: email || undefined,
          name: fullName || undefined,
          userType: 'guest',
        }}
      />
    </div>

  );
};

export default AuthPage;
