import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Database, MessageSquare, FileText, TrendingUp, Activity, UserPlus, BarChart3, Settings } from 'lucide-react';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { PlatformAdminUserManagement } from './PlatformAdminUserManagement';
import { PlatformAdminAnalytics } from './PlatformAdminAnalytics';
import { PlatformAdminSystemSettings } from './PlatformAdminSystemSettings';
import { PlatformAdminInvitations } from './PlatformAdminInvitations';

export function PlatformAdminDashboardContent() {
  const [searchParams] = useSearchParams();
  const { stats, error, fetchStats } = usePlatformAdmin();
  const activeTab = searchParams.get('tab') || 'dashboard';

  const statsCards = [
    {
      title: 'Total Users',
      value: stats?.total_users || 0,
      icon: Users,
      description: `+${stats?.recent_signups || 0} this week`,
      color: 'hsl(var(--admin-accent-blue))',
      trend: '+12%'
    },
    {
      title: 'Active Connections',
      value: stats?.active_connections || 0,
      icon: Database,
      description: 'Buyer-Supplier pairs',
      color: 'hsl(var(--admin-accent-purple))',
      trend: '+8%'
    },
    {
      title: 'Total Documents',
      value: stats?.total_documents || 0,
      icon: FileText,
      description: `${stats?.pending_requests || 0} pending`,
      color: 'hsl(var(--admin-accent-green))',
      trend: '+23%'
    },
    {
      title: 'Chat Sessions',
      value: stats?.total_chat_sessions || 0,
      icon: MessageSquare,
      description: 'Total conversations',
      color: 'hsl(var(--admin-accent-blue))',
      trend: '+15%'
    }
  ];

  if (activeTab === 'users') {
    return <PlatformAdminUserManagement />;
  }

  if (activeTab === 'invitations') {
    return <PlatformAdminInvitations />;
  }

  if (activeTab === 'analytics') {
    return <PlatformAdminAnalytics />;
  }

  if (activeTab === 'settings') {
    return <PlatformAdminSystemSettings />;
  }

  if (activeTab === 'logs') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-2 text-black">
            Audit Logs
          </h2>
          <p className="text-gray-600">
            Track system activities and user actions
          </p>
        </div>
        
        <Card style={{ 
          backgroundColor: 'hsl(var(--admin-card))', 
          borderColor: 'hsl(var(--admin-border))' 
        }}>
          <CardContent className="p-8 text-center">
            <Activity className="h-12 w-12 mx-auto mb-4" style={{ color: 'hsl(var(--admin-text-muted))' }} />
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'hsl(var(--admin-text))' }}>
              Audit Logs Coming Soon
            </h3>
            <p style={{ color: 'hsl(var(--admin-text-muted))' }}>
              Comprehensive audit logging and activity tracking will be available in the next release.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <div 
          className="p-4 rounded-lg border"
          style={{
            backgroundColor: 'hsl(var(--destructive) / 0.1)',
            borderColor: 'hsl(var(--destructive) / 0.3)',
            color: 'hsl(var(--destructive))'
          }}
        >
          <p className="font-medium">Error loading dashboard data: {error}</p>
          <button 
            onClick={fetchStats}
            className="mt-2 text-sm hover:underline font-medium"
          >
            Retry
          </button>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2 text-black">
          Platform Overview
        </h1>
        <p className="text-gray-600">
          Monitor your platform's performance and key metrics
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsCards.map((stat, index) => (
          <Card 
            key={index}
            className="relative overflow-hidden transition-all duration-300 hover:shadow-lg"
            style={{ 
              backgroundColor: 'hsl(var(--admin-card))', 
              borderColor: 'hsl(var(--admin-border))',
              boxShadow: 'var(--admin-shadow)'
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle 
                className="text-sm font-medium text-gray-600"
              >
                {stat.title}
              </CardTitle>
              <div 
                className="p-2 rounded-lg"
                style={{ backgroundColor: `${stat.color}20` }}
              >
                <stat.icon className="h-4 w-4" style={{ color: stat.color }} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold mb-1 text-black">
                {stat.value.toLocaleString()}
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-600">
                  {stat.description}
                </p>
                <div className="flex items-center space-x-1">
                  <TrendingUp className="h-3 w-3" style={{ color: 'hsl(var(--admin-accent-green))' }} />
                  <span 
                    className="text-xs font-medium"
                    style={{ color: 'hsl(var(--admin-accent-green))' }}
                  >
                    {stat.trend}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card style={{ 
          backgroundColor: 'hsl(var(--admin-card))', 
          borderColor: 'hsl(var(--admin-border))' 
        }}>
          <CardHeader>
            <CardTitle className="text-black">System Health</CardTitle>
            <CardDescription className="text-gray-600">
              Current system status and performance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Database</span>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(var(--admin-accent-green))' }}></div>
                  <span className="text-sm text-black">Operational</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">API Services</span>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(var(--admin-accent-green))' }}></div>
                  <span className="text-sm text-black">Operational</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">File Storage</span>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(var(--admin-accent-green))' }}></div>
                  <span className="text-sm text-black">Operational</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card style={{ 
          backgroundColor: 'hsl(var(--admin-card))', 
          borderColor: 'hsl(var(--admin-border))' 
        }}>
          <CardHeader>
            <CardTitle className="text-black">Quick Actions</CardTitle>
            <CardDescription className="text-gray-600">
              Common administrative tasks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <button 
                className="p-3 rounded-lg border transition-colors hover:bg-opacity-80 text-black"
                style={{
                  backgroundColor: 'hsl(var(--admin-sidebar-accent))',
                  borderColor: 'hsl(var(--admin-border))'
                }}
              >
                <Users className="h-4 w-4 mb-1" />
                <div className="text-xs font-medium">Manage Users</div>
              </button>
              <button 
                className="p-3 rounded-lg border transition-colors hover:bg-opacity-80"
                style={{
                  backgroundColor: 'hsl(var(--admin-sidebar-accent))',
                  borderColor: 'hsl(var(--admin-border))',
                  color: 'hsl(var(--admin-text))'
                }}
              >
                <UserPlus className="h-4 w-4 mb-1" />
                <div className="text-xs font-medium">Send Invite</div>
              </button>
              <button 
                className="p-3 rounded-lg border transition-colors hover:bg-opacity-80"
                style={{
                  backgroundColor: 'hsl(var(--admin-sidebar-accent))',
                  borderColor: 'hsl(var(--admin-border))',
                  color: 'hsl(var(--admin-text))'
                }}
              >
                <BarChart3 className="h-4 w-4 mb-1" />
                <div className="text-xs font-medium">View Analytics</div>
              </button>
              <button 
                className="p-3 rounded-lg border transition-colors hover:bg-opacity-80"
                style={{
                  backgroundColor: 'hsl(var(--admin-sidebar-accent))',
                  borderColor: 'hsl(var(--admin-border))',
                  color: 'hsl(var(--admin-text))'
                }}
              >
                <Settings className="h-4 w-4 mb-1" />
                <div className="text-xs font-medium">Settings</div>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}