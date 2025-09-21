import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Shield, CheckCircle, AlertTriangle, UserPlus, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function PlatformAdminBootstrap() {
  const [step, setStep] = useState<'initial' | 'signup' | 'finalize' | 'success'>('initial');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    fullName: "",
    password: ""
  });

  const handleInitialStep = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.fullName) {
      setError('Please fill in email and full name');
      return;
    }

    setStep('signup');
    setError(null);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.password || formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Create auth user first
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/platform-admin/bootstrap`
        }
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      if (!authData.user) {
        setError('Failed to create user account');
        return;
      }

      setStep('finalize');
    } catch (err) {
      console.error('Error creating user:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFinalize = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      // Accept bootstrap admin role
      const { data, error } = await supabase.rpc('accept_bootstrap_admin', {
        p_full_name: formData.fullName
      });

      if (error) {
        setError(error.message);
        return;
      }

      const result = data as { success: boolean; error?: string };
      if (!result?.success) {
        setError(result?.error || 'Failed to create bootstrap admin');
        return;
      }

      setStep('success');
    } catch (err) {
      console.error('Error finalizing bootstrap admin:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CheckCircle className="h-12 w-12 text-emerald-600 mx-auto mb-4" />
            <CardTitle>Bootstrap Admin Created!</CardTitle>
            <CardDescription>
              Your platform super admin account has been successfully created.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Success!</strong> You can now use the platform admin dashboard.
                <br />
                <br />
                <strong>Email:</strong> {formData.email}
              </AlertDescription>
            </Alert>
            <Button 
              className="w-full" 
              onClick={() => window.location.href = '/platform-admin/dashboard'}
            >
              Go to Platform Admin Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'finalize') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <UserPlus className="h-12 w-12 text-primary mx-auto mb-4" />
            <CardTitle>Finalize Bootstrap Admin</CardTitle>
            <CardDescription>
              Complete the setup by accepting the platform admin role.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                User account created successfully for <strong>{formData.email}</strong>.
                Click below to complete the bootstrap admin setup.
              </AlertDescription>
            </Alert>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button onClick={handleFinalize} className="w-full" disabled={isProcessing}>
              {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Complete Bootstrap Admin Setup
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'signup') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <UserPlus className="h-12 w-12 text-primary mx-auto mb-4" />
            <CardTitle>Create Admin Account</CardTitle>
            <CardDescription>
              Create a secure password for {formData.email}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  disabled
                  className="bg-muted"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  value={formData.fullName}
                  disabled
                  className="bg-muted"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Create a secure password"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  required
                  minLength={8}
                />
                <p className="text-xs text-muted-foreground">
                  Must be at least 8 characters long
                </p>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setStep('initial')}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button type="submit" className="flex-1" disabled={isProcessing}>
                  {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Account
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
          <CardTitle>Bootstrap Platform Admin</CardTitle>
          <CardDescription>
            Create the first platform super administrator account. This should only be used once for initial setup.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInitialStep} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@yourcompany.com"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="System Administrator"
                value={formData.fullName}
                onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                required
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Security Warning:</strong> This bootstrap function should only be used once during initial setup. 
                After creating the first admin, use the invitation system to add additional administrators.
              </AlertDescription>
            </Alert>

            <Button type="submit" className="w-full">
              Continue
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </form>

          <div className="mt-4 text-center">
            <Button 
              variant="link" 
              onClick={() => window.location.href = '/platform-admin/login'}
              className="text-sm"
            >
              Already have an admin account? Sign in
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}