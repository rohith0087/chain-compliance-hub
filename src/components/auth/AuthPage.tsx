import { useState, useMemo, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Shield, AlertCircle, Building2, ShoppingCart, Mail, Eye, EyeOff, Check, X, Lock, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { HelpButton } from '@/components/support/HelpButton';
import { useToast } from '@/hooks/use-toast';
import ParticleBackground from './ParticleBackground';
import { TurnstileWidget } from './TurnstileWidget';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';

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

const AuthPage = () => {
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
      toast({
        title: "Sign In Failed",
        description: error.message,
        variant: "destructive",
      });
      resetTurnstile();
    }
    setLoading(false);
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
    const emailValidation = z.string().trim().email().safeParse(resetEmail);
    if (!emailValidation.success) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }
    
    setResetLoading(true);
    const { error } = await resetPassword(resetEmail.trim());

    if (error) {
      toast({
        title: "Reset Failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Reset Email Sent",
        description: "Please check your email for password reset instructions.",
      });
      setResetEmail('');
      setResetDialogOpen(false);
    }
    setResetLoading(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Hero Section */}
      <div className={`hidden lg:flex lg:w-1/2 relative overflow-hidden transition-all duration-500 ${
        activeTab === 'login' 
          ? 'bg-gradient-to-br from-primary via-primary/90 to-accent' 
          : 'bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-500'
      }`}>
        <ParticleBackground />
        
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-lg">
              <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-xl">T</span>
              </div>
            </div>
            <span className="text-2xl font-bold text-white">Tracer2C</span>
          </div>
          
          <h1 className="text-4xl xl:text-5xl font-bold text-white mb-6 leading-tight">
            Streamline Your<br />
            <span className="text-white/90">Compliance Management</span>
          </h1>
          
          <p className="text-lg text-white/80 mb-10 max-w-md">
            Secure document management, automated workflows, and real-time compliance tracking for modern enterprises.
          </p>
          
          <div className="space-y-4">
            {[
              { icon: Shield, text: 'Enterprise-grade security' },
              { icon: Sparkles, text: 'AI-powered document analysis' },
              { icon: Lock, text: 'End-to-end encryption' },
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-3 text-white/90">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <feature.icon className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium">{feature.text}</span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-black/10 to-transparent"></div>
        <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-white/5 rounded-full blur-3xl"></div>
        <div className="absolute -top-20 -left-20 w-60 h-60 bg-white/5 rounded-full blur-3xl"></div>
      </div>

      {/* Right Form Section */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-8 bg-background">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="flex lg:hidden items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-lg">T</span>
            </div>
            <span className="text-xl font-bold text-foreground">Tracer2C</span>
          </div>

          <Card className="border-0 shadow-xl bg-card/50 backdrop-blur-sm">
            <CardContent className="p-6 sm:p-8">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-foreground">Welcome</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {activeTab === 'login' ? 'Login to your account' : 'Create your account'}
                </p>
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="login" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    Login
                  </TabsTrigger>
                  <TabsTrigger value="signup" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    Sign Up
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="login" className="mt-0">
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
                    
                    <Button type="submit" className="w-full h-11 font-semibold" disabled={loading || (isTurnstileEnabled && !turnstileToken)}>
                      {loading ? "Logging In..." : "Login"}
                    </Button>
                    
                    <div className="text-center">
                      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="link" className="text-sm text-muted-foreground hover:text-primary p-0 h-auto">
                            Forgot your password?
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                              <Mail className="w-5 h-5 text-primary" />
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
                            <div className="flex gap-2">
                              <Button 
                                type="button" 
                                variant="outline" 
                                className="flex-1"
                                onClick={() => setResetDialogOpen(false)}
                              >
                                Cancel
                              </Button>
                              <Button type="submit" className="flex-1" disabled={resetLoading}>
                                {resetLoading ? "Sending..." : "Send Reset Link"}
                              </Button>
                            </div>
                          </form>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </form>
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
                      className="w-full h-11 font-semibold" 
                      disabled={loading || selectedRoles.length === 0 || (isTurnstileEnabled && !turnstileToken)}
                    >
                      {loading ? "Creating Account..." : "Create Account"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
          
          <p className="text-center text-xs text-muted-foreground mt-6">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>

      {/* Floating Help Button for unauthenticated users */}
      <HelpButton 
        source="login_page"
        user={{
          email: email || undefined,
          name: fullName || undefined,
          userType: 'guest'
        }}
      />
    </div>
  );
};

export default AuthPage;
