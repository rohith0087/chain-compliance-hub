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
  const { stats, loading, profileLoading, error, isPlatformAdmin, platformAdmin, fetchStats } = usePlatformAdmin();

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
    // Only redirect if profile loading is complete and user is not a platform admin
    if (!profileLoading && !isPlatformAdmin) {
      navigate('/platform-admin/login');
    }
  }, [profileLoading, isPlatformAdmin, navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/platform-admin/login');
  };

  if (profileLoading || loading) {
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
    <div className="min-h-screen bg-gradient-subtle">
      {/* Professional Header */}
      <header className="bg-gradient-primary border-b border-white/20 shadow-elegant">
        <div className="container mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="relative">
                <div className="absolute inset-0 bg-white/20 rounded-xl blur-md"></div>
                <Shield className="relative h-12 w-12 text-white drop-shadow-lg" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white tracking-tight">
                  Platform Administration
                </h1>
                <p className="text-white/80 text-base font-medium mt-1">
                  Welcome back, {platformAdmin?.full_name}
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              onClick={handleSignOut}
              className="bg-white/10 border-white/30 text-white hover:bg-white/20 backdrop-blur-sm shadow-lg"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-8 py-10">
        {error && (
          <div className="mb-8 p-6 bg-destructive/10 border border-destructive/20 rounded-xl backdrop-blur-sm shadow-lg">
            <p className="text-destructive font-medium">Error loading dashboard data: {error}</p>
            <button 
              onClick={fetchStats}
              className="mt-3 text-sm text-destructive hover:underline font-medium"
            >
              Retry
            </button>
          </div>
        )}

        {/* Professional Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          <Card className="bg-gradient-to-br from-blue-accent/5 to-blue-accent/10 border-blue-accent/20 shadow-elegant hover:shadow-lg transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-blue-accent">Total Users</CardTitle>
              <div className="p-2 bg-blue-accent/10 rounded-lg">
                <Users className="h-5 w-5 text-blue-accent" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-accent">{stats?.total_users || 0}</div>
              <p className="text-sm text-muted-foreground mt-2">
                <span className="text-green-accent font-medium">+{stats?.recent_signups || 0}</span> this week
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-accent/5 to-purple-accent/10 border-purple-accent/20 shadow-elegant hover:shadow-lg transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-purple-accent">Active Connections</CardTitle>
              <div className="p-2 bg-purple-accent/10 rounded-lg">
                <Database className="h-5 w-5 text-purple-accent" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-accent">{stats?.active_connections || 0}</div>
              <p className="text-sm text-muted-foreground mt-2">Buyer-Supplier pairs</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-accent/5 to-green-accent/10 border-green-accent/20 shadow-elegant hover:shadow-lg transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-green-accent">Total Documents</CardTitle>
              <div className="p-2 bg-green-accent/10 rounded-lg">
                <FileText className="h-5 w-5 text-green-accent" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-accent">{stats?.total_documents || 0}</div>
              <p className="text-sm text-muted-foreground mt-2">
                <span className="text-amber-500 font-medium">{stats?.pending_requests || 0}</span> pending
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 shadow-elegant hover:shadow-lg transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-primary">Chat Sessions</CardTitle>
              <div className="p-2 bg-primary/10 rounded-lg">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{stats?.total_chat_sessions || 0}</div>
              <p className="text-sm text-muted-foreground mt-2">Total conversations</p>
            </CardContent>
          </Card>
        </div>

        {/* Professional Tabs Interface */}
        <Tabs defaultValue="users" className="space-y-8">
          <div className="flex justify-center">
            <TabsList className="grid w-full max-w-4xl grid-cols-4 bg-white/50 backdrop-blur-sm border shadow-elegant p-2 h-auto">
              <TabsTrigger 
                value="users" 
                className="data-[state=active]:bg-gradient-primary data-[state=active]:text-white font-semibold py-3 px-6 transition-all duration-300"
              >
                User Management
              </TabsTrigger>
              <TabsTrigger 
                value="invitations"
                className="data-[state=active]:bg-gradient-primary data-[state=active]:text-white font-semibold py-3 px-6 transition-all duration-300"
              >
                Invitations
              </TabsTrigger>
              <TabsTrigger 
                value="analytics"
                className="data-[state=active]:bg-gradient-primary data-[state=active]:text-white font-semibold py-3 px-6 transition-all duration-300"
              >
                Analytics
              </TabsTrigger>
              <TabsTrigger 
                value="settings"
                className="data-[state=active]:bg-gradient-primary data-[state=active]:text-white font-semibold py-3 px-6 transition-all duration-300"
              >
                System Settings
              </TabsTrigger>
            </TabsList>
          </div>

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