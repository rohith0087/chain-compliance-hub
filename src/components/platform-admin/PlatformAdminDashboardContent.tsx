import { useSearchParams, useNavigate } from 'react-router-dom';
import { Users, Database, MessageSquare, FileText, Ticket, Clock, AlertTriangle } from 'lucide-react';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { useSupportTickets } from '@/hooks/useSupportTickets';
import { PlatformAdminUserManagement } from './PlatformAdminUserManagement';
import { PlatformAdminAnalytics } from './PlatformAdminAnalytics';
import { PlatformAdminInvitations } from './PlatformAdminInvitations';
import { PlatformAdminAuditLogs } from './PlatformAdminAuditLogs';
import { SuperAdminClientSupport } from '@/components/super-admin/SuperAdminClientSupport';
import { DocumentBackfillManager } from './DocumentBackfillManager';
import { PlatformEmailIntakeOperations } from './PlatformEmailIntakeOperations';
import { PlatformAdminSupplierRisk } from './PlatformAdminSupplierRisk';
import { PlatformAdminFeatureFlags } from './PlatformAdminFeatureFlags';
import { PlatformAdminDataExplorer } from './PlatformAdminDataExplorer';
import { AdminPageHeader, AdminCard, AdminStatCard, AdminBadge, type AdminTone } from './ui';
import { formatDistanceToNow } from 'date-fns';

export function PlatformAdminDashboardContent() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { stats, error, fetchStats } = usePlatformAdmin();
  const { tickets } = useSupportTickets();
  const activeTab = searchParams.get('tab') || 'dashboard';

  const recentTickets = tickets.slice(0, 5);

  if (activeTab === 'users') return <PlatformAdminUserManagement />;
  if (activeTab === 'invitations') return <PlatformAdminInvitations />;
  if (activeTab === 'tickets') return <SuperAdminClientSupport />;
  if (activeTab === 'analytics') return <PlatformAdminAnalytics />;
  if (activeTab === 'logs') return <PlatformAdminAuditLogs />;
  if (activeTab === 'backfill') return <DocumentBackfillManager />;
  if (activeTab === 'email-intake') return <PlatformEmailIntakeOperations />;
  if (activeTab === 'supplier-risk') return <PlatformAdminSupplierRisk />;
  if (activeTab === 'feature-flags') return <PlatformAdminFeatureFlags />;
  if (activeTab === 'data-explorer') return <PlatformAdminDataExplorer />;

  const statsCards = [
    { title: 'Total Users', value: stats?.total_users ?? 0, icon: Users, hint: `${stats?.recent_signups ?? 0} new this week` },
    { title: 'Active Connections', value: stats?.active_connections ?? 0, icon: Database, hint: 'Buyer–supplier pairs' },
    { title: 'Total Documents', value: stats?.total_documents ?? 0, icon: FileText, hint: `${stats?.pending_requests ?? 0} pending` },
    { title: 'Chat Sessions', value: stats?.total_chat_sessions ?? 0, icon: MessageSquare, hint: 'Total conversations' },
  ];

  const priorityTone = (p: string): AdminTone => (p === 'urgent' ? 'danger' : p === 'high' ? 'warning' : p === 'medium' ? 'info' : 'neutral');
  const statusTone = (s: string): AdminTone => (s === 'open' ? 'info' : s === 'in_progress' ? 'warning' : s === 'resolved' ? 'positive' : 'neutral');

  const health = [
    { label: 'Database', status: 'Operational' },
    { label: 'API Services', status: 'Operational' },
    { label: 'File Storage', status: 'Operational' },
  ];

  return (
    <div>
      <AdminPageHeader title="Platform Overview" description="Monitor platform activity and key metrics at a glance." />

      {error && (
        <div className="mb-5 rounded-lg border px-4 py-3"
          style={{ background: 'hsl(var(--admin-danger) / 0.08)', borderColor: 'hsl(var(--admin-danger) / 0.3)', color: 'hsl(var(--admin-danger))' }}>
          <p className="text-sm font-medium">Error loading dashboard data: {error}</p>
          <button onClick={fetchStats} className="mt-1 text-sm font-medium hover:underline">Retry</button>
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statsCards.map((s) => (
          <AdminStatCard key={s.title} label={s.title} value={s.value.toLocaleString()} hint={s.hint} icon={<s.icon className="h-4 w-4" />} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AdminCard>
          <h2 className="mb-1 text-base font-semibold" style={{ color: 'hsl(var(--admin-text))' }}>System Health</h2>
          <p className="mb-4 text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>Current system status.</p>
          <div className="space-y-3">
            {health.map((h) => (
              <div key={h.label} className="flex items-center justify-between">
                <span className="text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>{h.label}</span>
                <span className="inline-flex items-center gap-2 text-sm" style={{ color: 'hsl(var(--admin-text))' }}>
                  <span className="h-2 w-2 rounded-full" style={{ background: 'hsl(var(--admin-positive))' }} />
                  {h.status}
                </span>
              </div>
            ))}
          </div>
        </AdminCard>

        <AdminCard>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold" style={{ color: 'hsl(var(--admin-text))' }}>Recent Tickets</h2>
              <p className="text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>Latest support requests.</p>
            </div>
            <button onClick={() => navigate('/platform-admin/dashboard?tab=tickets')}
              className="text-sm font-medium hover:underline" style={{ color: 'hsl(var(--admin-accent-blue))' }}>
              View all
            </button>
          </div>
          {recentTickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Ticket className="mb-2 h-9 w-9" style={{ color: 'hsl(var(--admin-text-muted))' }} />
              <p className="text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>No support tickets yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentTickets.map((ticket) => (
                <button key={ticket.id} onClick={() => navigate('/platform-admin/dashboard?tab=tickets')}
                  className="w-full rounded-lg border p-3 text-left transition-colors"
                  style={{ background: 'hsl(var(--admin-surface))', borderColor: 'hsl(var(--admin-border))' }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" style={{ color: 'hsl(var(--admin-text))' }}>{ticket.subject}</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <Clock className="h-3 w-3" style={{ color: 'hsl(var(--admin-text-muted))' }} />
                        <span className="text-xs" style={{ color: 'hsl(var(--admin-text-muted))' }}>
                          {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <AdminBadge tone={priorityTone(ticket.priority)}>
                        {ticket.priority === 'urgent' && <AlertTriangle className="mr-0.5 h-2.5 w-2.5" />}
                        {ticket.priority}
                      </AdminBadge>
                      <AdminBadge tone={statusTone(ticket.status)}>{ticket.status.replace('_', ' ')}</AdminBadge>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </AdminCard>
      </div>
    </div>
  );
}
