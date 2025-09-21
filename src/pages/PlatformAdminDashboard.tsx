import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Users, Database, MessageSquare, FileText, Shield, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { PlatformAdminUserManagement } from '@/components/platform-admin/PlatformAdminUserManagement';
import { PlatformAdminAnalytics } from '@/components/platform-admin/PlatformAdminAnalytics';
import { PlatformAdminSystemSettings } from '@/components/platform-admin/PlatformAdminSystemSettings';
import { PlatformAdminInvitations } from '@/components/platform-admin/PlatformAdminInvitations';

export default function PlatformAdminDashboard() {
  const navigate = useNavigate();
  const { stats, loading, error, isPlatformAdmin, platformAdmin } = usePlatformAdmin();

  useEffect(() => {
    // Redirect if not authenticated or not a platform admin
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/platform-admin/login');
        return;
      }
    };
    
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    if (!loading && !isPlatformAdmin) {
      navigate('/platform-admin/login');
    }
  }, [loading, isPlatformAdmin, navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/platform-admin/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error && !isPlatformAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">Access Denied</CardTitle>
            <CardDescription className="text-center">
              Platform administrator access required
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => navigate('/platform-admin/login')}>
              Return to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Shield className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">Platform Administration</h1>
                <p className="text-sm text-muted-foreground">
                  Welcome back, {platformAdmin?.full_name}
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total_users || 0}</div>
              <p className="text-xs text-muted-foreground">
                +{stats?.recent_signups || 0} this week
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Connections</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.active_connections || 0}</div>
              <p className="text-xs text-muted-foreground">Buyer-Supplier pairs</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total_documents || 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.pending_requests || 0} pending
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Chat Sessions</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total_chat_sessions || 0}</div>
              <p className="text-xs text-muted-foreground">Total conversations</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="users">User Management</TabsTrigger>
            <TabsTrigger value="invitations">Invitations</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="settings">System Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <PlatformAdminUserManagement />
          </TabsContent>

          <TabsContent value="invitations">
            <PlatformAdminInvitations />
          </TabsContent>

          <TabsContent value="analytics">
            <PlatformAdminAnalytics />
          </TabsContent>

          <TabsContent value="settings">
            <PlatformAdminSystemSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}