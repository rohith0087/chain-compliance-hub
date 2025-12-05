import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Database, MessageSquare, FileText, TrendingUp, Ticket, Clock, AlertTriangle } from 'lucide-react';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { useSupportTickets } from '@/hooks/useSupportTickets';
import { PlatformAdminUserManagement } from './PlatformAdminUserManagement';
import { PlatformAdminAnalytics } from './PlatformAdminAnalytics';
import { PlatformAdminSystemSettings } from './PlatformAdminSystemSettings';
import { PlatformAdminInvitations } from './PlatformAdminInvitations';
import { PlatformAdminAuditLogs } from './PlatformAdminAuditLogs';
import { SuperAdminClientSupport } from '@/components/super-admin/SuperAdminClientSupport';
import { formatDistanceToNow } from 'date-fns';

export function PlatformAdminDashboardContent() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { stats, error, fetchStats } = usePlatformAdmin();
  const { tickets } = useSupportTickets();
  const activeTab = searchParams.get('tab') || 'dashboard';

  // Get recent tickets (latest 5)
  const recentTickets = tickets.slice(0, 5);

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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'hsl(var(--destructive))';
      case 'high': return 'hsl(217 91% 60%)';
      case 'medium': return 'hsl(45 93% 47%)';
      default: return 'hsl(var(--admin-text-muted))';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'hsl(var(--admin-accent-blue))';
      case 'in_progress': return 'hsl(45 93% 47%)';
      case 'resolved': return 'hsl(var(--admin-accent-green))';
      case 'closed': return 'hsl(var(--admin-text-muted))';
      default: return 'hsl(var(--admin-text-muted))';
    }
  };

  if (activeTab === 'users') {
    return <PlatformAdminUserManagement />;
  }

  if (activeTab === 'invitations') {
    return <PlatformAdminInvitations />;
  }

  if (activeTab === 'tickets') {
    return <SuperAdminClientSupport />;
  }

  if (activeTab === 'analytics') {
    return <PlatformAdminAnalytics />;
  }

  if (activeTab === 'settings') {
    return <PlatformAdminSystemSettings />;
  }

  if (activeTab === 'logs') {
    return <PlatformAdminAuditLogs />;
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
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'hsl(var(--admin-text))' }}>
          Platform Overview
        </h1>
        <p style={{ color: 'hsl(var(--admin-text-muted))' }}>
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
                className="text-sm font-medium"
                style={{ color: 'hsl(var(--admin-text-muted))' }}
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
              <div className="text-2xl font-bold mb-1" style={{ color: 'hsl(var(--admin-text))' }}>
                {stat.value.toLocaleString()}
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs" style={{ color: 'hsl(var(--admin-text-muted))' }}>
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
            <CardTitle style={{ color: 'hsl(var(--admin-text))' }}>System Health</CardTitle>
            <CardDescription style={{ color: 'hsl(var(--admin-text-muted))' }}>
              Current system status and performance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span style={{ color: 'hsl(var(--admin-text-muted))' }}>Database</span>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(var(--admin-accent-green))' }}></div>
                  <span className="text-sm" style={{ color: 'hsl(var(--admin-text))' }}>Operational</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ color: 'hsl(var(--admin-text-muted))' }}>API Services</span>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(var(--admin-accent-green))' }}></div>
                  <span className="text-sm" style={{ color: 'hsl(var(--admin-text))' }}>Operational</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ color: 'hsl(var(--admin-text-muted))' }}>File Storage</span>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(var(--admin-accent-green))' }}></div>
                  <span className="text-sm" style={{ color: 'hsl(var(--admin-text))' }}>Operational</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Tickets Card */}
        <Card style={{ 
          backgroundColor: 'hsl(var(--admin-card))', 
          borderColor: 'hsl(var(--admin-border))' 
        }}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle style={{ color: 'hsl(var(--admin-text))' }}>Recent Tickets</CardTitle>
              <CardDescription style={{ color: 'hsl(var(--admin-text-muted))' }}>
                Latest support requests
              </CardDescription>
            </div>
            <button
              onClick={() => navigate('/platform-admin/dashboard?tab=tickets')}
              className="text-sm font-medium hover:underline"
              style={{ color: 'hsl(var(--admin-accent-blue))' }}
            >
              View All
            </button>
          </CardHeader>
          <CardContent>
            {recentTickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Ticket className="h-10 w-10 mb-2" style={{ color: 'hsl(var(--admin-text-muted))' }} />
                <p className="text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>
                  No support tickets yet
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentTickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    onClick={() => navigate('/platform-admin/dashboard?tab=tickets')}
                    className="w-full p-3 rounded-lg border transition-colors hover:bg-opacity-80 text-left"
                    style={{
                      backgroundColor: 'hsl(var(--admin-sidebar-accent))',
                      borderColor: 'hsl(var(--admin-border))'
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p 
                          className="text-sm font-medium truncate"
                          style={{ color: 'hsl(var(--admin-text))' }}
                        >
                          {ticket.subject}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="h-3 w-3" style={{ color: 'hsl(var(--admin-text-muted))' }} />
                          <span className="text-xs" style={{ color: 'hsl(var(--admin-text-muted))' }}>
                            {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge 
                          variant="outline"
                          className="text-[10px] px-1.5 py-0"
                          style={{ 
                            borderColor: getPriorityColor(ticket.priority),
                            color: getPriorityColor(ticket.priority)
                          }}
                        >
                          {ticket.priority === 'urgent' && <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />}
                          {ticket.priority}
                        </Badge>
                        <Badge 
                          className="text-[10px] px-1.5 py-0"
                          style={{ 
                            backgroundColor: getStatusColor(ticket.status),
                            color: 'white'
                          }}
                        >
                          {ticket.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
