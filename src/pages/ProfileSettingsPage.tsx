import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { AccountSettingsForm } from '@/components/settings/AccountSettingsForm';
import { PasswordChangeForm } from '@/components/settings/PasswordChangeForm';
import { IntegrationsDirectoryModal } from '@/components/settings/IntegrationsDirectoryModal';
import { PasskeysSettingsSection } from '@/components/settings/PasskeysSettingsSection';
import { useAuth } from '@/hooks/useAuth';

const ProfileSettingsPage = () => {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const [showIntegrations, setShowIntegrations] = React.useState(false);

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

          <Separator />

          <section>
            <PasskeysSettingsSection />
          </section>

          <Separator />

          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z"/><path d="m5 2 5 5"/><path d="M2 13h15"/><path d="M22 20v-5h-5"/></svg>
                </div>
                <h2 className="text-lg font-semibold">Integrations</h2>
              </div>
            </div>
            <Card>
              <CardContent className="pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-foreground">Connect Workflow Tools</h3>
                  <p className="text-sm text-muted-foreground mt-1">Integrate TraceR2C with your calendar, email, and productivity apps.</p>
                </div>
                <Button onClick={() => setShowIntegrations(true)}>
                  Browse Integrations
                </Button>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>

      <IntegrationsDirectoryModal 
        open={showIntegrations} 
        onOpenChange={setShowIntegrations} 
      />
    </div>
  );
};

export default ProfileSettingsPage;
