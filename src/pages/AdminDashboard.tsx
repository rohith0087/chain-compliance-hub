import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useUserRoles } from '@/hooks/useUserRoles';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, 
  Activity, 
  BarChart3, 
  Settings,
  UserCheck,
  MessageSquare,
  FileText,
  TrendingUp,
  Shield,
  Home
} from 'lucide-react';
import AdminUserManagement from '@/components/admin/AdminUserManagement';
import AdminAnalytics from '@/components/admin/AdminAnalytics';
import AdminActivityFeed from '@/components/admin/AdminActivityFeed';
import AdminSystemSettings from '@/components/admin/AdminSystemSettings';
import { useToast } from '@/hooks/use-toast';

const AdminDashboard = () => {
  const { t } = useTranslation(['admin', 'common']);
  const { user, profile, loading } = useAuth();
  const { hasRole, loading: rolesLoading } = useUserRoles();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalSessions: 0,
    totalDocuments: 0
  });

  // Check if user is admin
  const isAdmin = hasRole('admin');

  useEffect(() => {
    if (!loading && !rolesLoading && (!user || !isAdmin)) {
      toast({
        title: t('admin:accessDenied'),
        description: t('admin:accessDeniedDescription'),
        variant: "destructive"
      });
      navigate('/auth');
      return;
    }
  }, [user, isAdmin, loading, navigate, toast]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">{t('admin:loading')}</p>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{t('admin:title')}</h1>
                <p className="text-sm text-gray-600">{t('admin:subtitle')}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant="destructive" className="flex items-center gap-1">
                <Shield className="w-3 h-3" />
                {t('admin:administrator')}
              </Badge>
              <Button 
                variant="outline" 
                onClick={() => navigate('/')}
                className="flex items-center gap-2"
              >
                <Home className="w-4 h-4" />
                {t('admin:returnToApp')}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            {t('admin:welcome', { name: profile?.full_name || t('admin:administrator') })}
          </h2>
          <p className="text-gray-600">
            {t('admin:description')}
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{t('admin:stats.totalUsers')}</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.totalUsers}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{t('admin:stats.activeUsers')}</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.activeUsers}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <UserCheck className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{t('admin:stats.chatSessions')}</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.totalSessions}</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{t('admin:stats.documents')}</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.totalDocuments}</p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                  <FileText className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              {t('admin:tabs.users')}
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              {t('admin:tabs.analytics')}
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              {t('admin:tabs.activity')}
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              {t('admin:tabs.settings')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  {t('admin:sections.userManagement.title')}
                </CardTitle>
                <CardDescription>
                  {t('admin:sections.userManagement.description')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AdminUserManagement onStatsUpdate={setStats} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  {t('admin:sections.analytics.title')}
                </CardTitle>
                <CardDescription>
                  {t('admin:sections.analytics.description')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AdminAnalytics />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  {t('admin:sections.activity.title')}
                </CardTitle>
                <CardDescription>
                  {t('admin:sections.activity.description')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AdminActivityFeed />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  {t('admin:sections.settings.title')}
                </CardTitle>
                <CardDescription>
                  {t('admin:sections.settings.description')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AdminSystemSettings />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;