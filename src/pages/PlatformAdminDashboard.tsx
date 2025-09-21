import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { SidebarProvider } from '@/components/ui/sidebar';
import { PlatformAdminSidebar } from '@/components/platform-admin/PlatformAdminSidebar';
import { PlatformAdminHeader } from '@/components/platform-admin/PlatformAdminHeader';
import { PlatformAdminDashboardContent } from '@/components/platform-admin/PlatformAdminDashboardContent';

export default function PlatformAdminDashboard() {
  const navigate = useNavigate();
  const { profileLoading, error, isPlatformAdmin } = usePlatformAdmin();

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

  if (profileLoading) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: 'hsl(var(--admin-background))' }}
      >
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'hsl(var(--admin-accent-blue))' }} />
      </div>
    );
  }

  if (error && !isPlatformAdmin) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: 'hsl(var(--admin-background))' }}
      >
        <Card 
          className="w-full max-w-md"
          style={{ 
            backgroundColor: 'hsl(var(--admin-card))', 
            borderColor: 'hsl(var(--admin-border))' 
          }}
        >
          <CardHeader>
            <CardTitle 
              className="text-center"
              style={{ color: 'hsl(var(--admin-text))' }}
            >
              Access Denied
            </CardTitle>
            <CardDescription 
              className="text-center"
              style={{ color: 'hsl(var(--admin-text-muted))' }}
            >
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
    <div className="min-h-screen" style={{ backgroundColor: 'hsl(var(--admin-background))', color: 'hsl(var(--admin-text))' }}>
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <PlatformAdminSidebar activeSection="dashboard" onSectionChange={() => {}} />
          
          <div className="flex-1 flex flex-col">
            <PlatformAdminHeader />
            
            <main className="flex-1 p-6">
              <PlatformAdminDashboardContent />
            </main>
          </div>
        </div>
      </SidebarProvider>
    </div>
  );
}