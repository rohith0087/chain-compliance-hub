import { useSuperAdmin } from '@/hooks/useSuperAdmin';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SuperAdminUserManagement } from '@/components/super-admin/SuperAdminUserManagement';
import { SuperAdminAnalytics } from '@/components/super-admin/SuperAdminAnalytics';
import { SuperAdminSystemSettings } from '@/components/super-admin/SuperAdminSystemSettings';
import { SuperAdminClientSupport } from '@/components/super-admin/SuperAdminClientSupport';
import { Badge } from '@/components/ui/badge';
import { Shield, Users, BarChart, Settings, HeadphonesIcon, Database } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';

const SuperAdminDashboard = () => {
  const { stats, loading, error, isSuperAdmin } = useSuperAdmin();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (!user.user_metadata?.roles?.includes('super_admin')) {
      navigate('/dashboard');
      return;
    }
  }, [user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading Super Admin Dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !isSuperAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Shield className="w-16 h-16 mx-auto text-destructive mb-4" />
            <CardTitle className="text-destructive">Access Denied</CardTitle>
            <CardDescription>
              {error || 'You don\'t have Super Administrator privileges to access this page.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <button 
              onClick={() => navigate('/dashboard')}
              className="text-primary hover:underline"
            >
              Return to Dashboard
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">Super Admin Dashboard</h1>
            <Badge variant="destructive" className="ml-2">
              RESTRICTED ACCESS
            </Badge>
          </div>
          <p className="text-muted-foreground text-lg">
            Platform-wide management, analytics, and client support tools
          </p>
        </div>

        {/* Quick Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                    <p className="text-2xl font-bold">{stats.total_users}</p>
                  </div>
                  <Users className="w-8 h-8 text-primary" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Active Connections</p>
                    <p className="text-2xl font-bold">{stats.active_connections}</p>
                  </div>
                  <Database className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Documents</p>
                    <p className="text-2xl font-bold">{stats.total_documents}</p>
                  </div>
                  <BarChart className="w-8 h-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Recent Signups</p>
                    <p className="text-2xl font-bold">{stats.recent_signups}</p>
                    <p className="text-xs text-muted-foreground">Last 7 days</p>
                  </div>
                  <Users className="w-8 h-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Content */}
        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              User Management
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart className="w-4 h-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="support" className="flex items-center gap-2">
              <HeadphonesIcon className="w-4 h-4" />
              Client Support
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              System Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <SuperAdminUserManagement />
          </TabsContent>

          <TabsContent value="analytics">
            <SuperAdminAnalytics />
          </TabsContent>

          <TabsContent value="support">
            <SuperAdminClientSupport />
          </TabsContent>

          <TabsContent value="settings">
            <SuperAdminSystemSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;