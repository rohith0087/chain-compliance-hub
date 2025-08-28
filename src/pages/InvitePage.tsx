import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Building, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface InvitationDetails {
  email: string;
  company_name: string;
  company_type: string;
  branch_name: string;
  role: string;
  invited_by: string;
  temp_password: string;
  user_id: string;
  expires_at: string;
}

const InvitePage = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<'verify' | 'signin' | 'password-reset' | 'complete'>('verify');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showTempPassword, setShowTempPassword] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (token) {
      verifyInvitation();
    }
  }, [token]);

  const verifyInvitation = async () => {
    try {
      setLoading(true);
      
      // Get invitation details from our custom table (if it exists)
      const { data: inviteData, error } = await supabase
        .from('user_invitations')
        .select('*')
        .eq('token', token)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error || !inviteData) {
        toast.error('Invalid or expired invitation link');
        navigate('/auth');
        return;
      }

      // Get additional company details
      const companyTable = inviteData.company_type === 'buyer' ? 'buyers' : 'suppliers';
      const { data: companyData } = await supabase
        .from(companyTable)
        .select('company_name')
        .eq('id', inviteData.company_id)
        .single();

      const { data: branchData } = await supabase
        .from('company_branches')
        .select('branch_name')
        .eq('id', inviteData.branch_id)
        .single();

      setInvitation({
        ...inviteData,
        company_name: companyData?.company_name || 'Unknown Company',
        branch_name: branchData?.branch_name || 'Main Branch'
      });

      setStep('signin');
    } catch (error) {
      console.error('Error verifying invitation:', error);
      toast.error('Failed to verify invitation');
      navigate('/auth');
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async () => {
    if (!invitation) return;
    
    setProcessing(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: invitation.email,
        password: invitation.temp_password
      });

      if (error) {
        toast.error('Failed to sign in. Please check your credentials.');
        return;
      }

      setStep('password-reset');
    } catch (error) {
      console.error('Sign in error:', error);
      toast.error('Failed to sign in');
    } finally {
      setProcessing(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!newPassword || newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters long');
      return;
    }

    if (!invitation) return;

    setProcessing(true);
    try {
      // Update password
      const { error: passwordError } = await supabase.auth.updateUser({
        password: newPassword,
        data: {
          requires_password_reset: false,
          onboarding_completed: true,
          full_name: invitation.email.split('@')[0] // Temporary, user can update later
        }
      });

      if (passwordError) {
        toast.error('Failed to update password');
        return;
      }

      // Clean up invitation record
      await supabase
        .from('user_invitations')
        .delete()
        .eq('token', token);

      setStep('complete');
      
      // Redirect to dashboard after success
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
      
    } catch (error) {
      console.error('Password reset error:', error);
      toast.error('Failed to update password');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center">
              <Shield className="w-8 h-8 text-blue-600 mx-auto mb-4 animate-pulse" />
              <p>Verifying invitation...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const roleDisplayName = invitation?.role?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || '';
  const companyTypeDisplay = invitation?.company_type === 'buyer' ? 'Buyer Company' : 'Supplier Company';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            {step === 'complete' ? (
              <CheckCircle className="w-8 h-8 text-white" />
            ) : (
              <Shield className="w-8 h-8 text-white" />
            )}
          </div>
          <CardTitle className="text-2xl font-bold">
            {step === 'signin' && 'Welcome to Your Team!'}
            {step === 'password-reset' && 'Set Up Your Password'}
            {step === 'complete' && 'Welcome Aboard! 🎉'}
          </CardTitle>
          <CardDescription>
            {step === 'signin' && 'Complete your account setup to get started'}
            {step === 'password-reset' && 'Create a secure password for your account'}
            {step === 'complete' && 'Your account is ready! Redirecting to dashboard...'}
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {invitation && step === 'signin' && (
            <div className="space-y-6">
              {/* Company Info */}
              <div className="bg-slate-50 p-4 rounded-lg">
                <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Building className="w-4 h-4" />
                  Your Role Details
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Company:</span>
                    <span className="font-medium">{invitation.company_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Type:</span>
                    <span className="font-medium">{companyTypeDisplay}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Branch:</span>
                    <span className="font-medium">{invitation.branch_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Role:</span>
                    <span className="font-medium">{roleDisplayName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Invited by:</span>
                    <span className="font-medium">{invitation.invited_by}</span>
                  </div>
                </div>
              </div>

              {/* Credentials */}
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                <div className="flex items-start gap-2 mb-3">
                  <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-amber-900">Your Login Credentials</h4>
                    <p className="text-sm text-amber-700">Use these to sign in, then you'll set up a new password</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <Label className="text-amber-900">Email</Label>
                    <div className="bg-white p-2 rounded border font-mono text-sm">
                      {invitation.email}
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-amber-900">Temporary Password</Label>
                    <div className="relative">
                      <div className="bg-white p-2 rounded border font-mono text-sm pr-10">
                        {showTempPassword ? invitation.temp_password : '••••••••••••••••'}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1 h-6 w-6 p-0"
                        onClick={() => setShowTempPassword(!showTempPassword)}
                      >
                        {showTempPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <Button 
                onClick={handleSignIn} 
                className="w-full" 
                disabled={processing}
              >
                {processing ? 'Signing In...' : 'Continue to Set Up Password'}
              </Button>
            </div>
          )}

          {step === 'password-reset' && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                <div className="flex items-center gap-2 text-green-800">
                  <CheckCircle className="w-4 h-4" />
                  <span className="font-medium">Successfully signed in!</span>
                </div>
                <p className="text-sm text-green-700 mt-1">
                  Now create a secure password that you'll remember.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="newPassword">New Password</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter your new password"
                      className="pr-10"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1 h-8 w-8 p-0"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your new password"
                    required
                  />
                </div>
                
                {newPassword && (
                  <div className="text-sm text-slate-600">
                    <p className={newPassword.length >= 8 ? 'text-green-600' : 'text-red-600'}>
                      ✓ At least 8 characters
                    </p>
                    <p className={newPassword === confirmPassword && confirmPassword ? 'text-green-600' : 'text-red-600'}>
                      ✓ Passwords match
                    </p>
                  </div>
                )}
              </div>

              <Button 
                onClick={handlePasswordReset} 
                className="w-full" 
                disabled={processing || !newPassword || newPassword !== confirmPassword || newPassword.length < 8}
              >
                {processing ? 'Setting Up Account...' : 'Complete Account Setup'}
              </Button>
            </div>
          )}

          {step === 'complete' && (
            <div className="text-center space-y-4">
              <div className="bg-green-50 border border-green-200 p-6 rounded-lg">
                <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-green-900 mb-2">
                  Account Setup Complete!
                </h3>
                <p className="text-green-700">
                  Welcome to {invitation?.company_name}! You're now part of the team.
                </p>
              </div>
              
              <p className="text-sm text-slate-600">
                Redirecting you to your dashboard...
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default InvitePage;