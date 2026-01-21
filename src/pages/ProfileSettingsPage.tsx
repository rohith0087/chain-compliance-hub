import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { AccountSettingsForm } from '@/components/settings/AccountSettingsForm';
import { PasswordChangeForm } from '@/components/settings/PasswordChangeForm';
import { useAuth } from '@/hooks/useAuth';

const ProfileSettingsPage = () => {
  const navigate = useNavigate();
  const { profile, user } = useAuth();

  const getInitials = () => {
    if (profile?.full_name) {
      return profile.full_name.charAt(0).toUpperCase();
    }
    if (user?.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return 'U';
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 items-center gap-4 px-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto max-w-3xl py-8 px-4">
        {/* Profile Header Card */}
        <Card className="mb-8">
          <CardContent className="flex items-center gap-6 pt-6">
            <Avatar className="h-20 w-20 border-2 border-border">
              <AvatarImage src={profile?.avatar_url || undefined} alt="Profile" />
              <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold">Profile Settings</h1>
              <p className="text-muted-foreground">
                Manage your account information and security settings
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Account Settings */}
        <div className="space-y-8">
          <section>
            <div className="flex items-center gap-2 mb-4">
              <User className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Account</h2>
            </div>
            <AccountSettingsForm />
          </section>

          <Separator />

          <section>
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Password</h2>
            </div>
            <PasswordChangeForm />
          </section>
        </div>
      </main>
    </div>
  );
};

export default ProfileSettingsPage;
