import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Shield, CheckCircle, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function PlatformAdminBootstrap() {
  const [isCreating, setIsCreating] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    fullName: "",
    tempPassword: "ChangeMe2024!"
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.fullName) {
      setError('Please fill in all fields');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const { data, error } = await supabase.rpc('create_bootstrap_super_admin', {
        p_email: formData.email,
        p_full_name: formData.fullName,
        p_temp_password: formData.tempPassword
      });

      if (error) {
        setError(error.message);
        return;
      }

      const result = data as { success: boolean; error?: string; temp_password?: string };
      if (!result?.success) {
        setError(result?.error || 'Failed to create bootstrap admin');
        return;
      }

      setSuccess(true);
    } catch (err) {
      console.error('Error creating bootstrap admin:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  if (success) {
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
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Important:</strong> Please change your password immediately after logging in.
                <br />
                <br />
                <strong>Email:</strong> {formData.email}
                <br />
                <strong>Temp Password:</strong> {formData.tempPassword}
              </AlertDescription>
            </Alert>
            <Button 
              className="w-full" 
              onClick={() => window.location.href = '/platform-admin/login'}
            >
              Go to Platform Admin Login
            </Button>
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
          <form onSubmit={handleSubmit} className="space-y-4">
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

            <div className="space-y-2">
              <Label htmlFor="tempPassword">Temporary Password</Label>
              <Input
                id="tempPassword"
                type="text"
                value={formData.tempPassword}
                onChange={(e) => setFormData(prev => ({ ...prev, tempPassword: e.target.value }))}
                required
              />
              <p className="text-xs text-muted-foreground">
                This password MUST be changed immediately after first login
              </p>
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

            <Button type="submit" className="w-full" disabled={isCreating}>
              {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Bootstrap Admin
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