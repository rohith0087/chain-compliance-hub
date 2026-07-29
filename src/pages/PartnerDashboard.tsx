import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Building2, Activity, LogOut, ArrowLeft, Ban, ShieldCheck, Trash2, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  usePartner, type PartnerCustomer, type PartnerCompanyUser, type PartnerMember, type PartnerActivity,
} from '@/hooks/usePartner';
import { PartnerBrand } from '@/components/partner/PartnerBrand';
import { AdminCard, AdminStatCard, AdminBadge, AdminDataTable, AdminPageHeader, type AdminColumn, type AdminTone } from '@/components/platform-admin/ui';

type View = 'customers' | 'team' | 'activity';
const ASSIGNABLE_ROLES = ['company_admin', 'branch_manager', 'document_manager', 'approver', 'auditor', 'viewer'];
const humanize = (s: string) => s.replace(/_/g, ' ');
const statusTone = (s: string): AdminTone => (s === 'active' ? 'positive' : s === 'inactive' ? 'neutral' : 'warning');

function InviteForm({ roles, busy, onSubmit }: { roles: string[]; busy: boolean; onSubmit: (email: string, fullName: string, role: string) => void }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState(roles[0]);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium"
        style={{ background: 'hsl(var(--admin-accent-blue))', color: 'white' }}>
        <UserPlus className="h-4 w-4" /> Add user
      </button>
    );
  }
  return (
    <div className="flex flex-wrap items-end gap-2">
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@company.com" type="email"
        className="rounded-md px-2 py-1.5 text-sm outline-none" style={{ background: 'hsl(var(--admin-surface))', border: '1px solid hsl(var(--admin-border))', color: 'hsl(var(--admin-text))' }} />
      <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name"
        className="rounded-md px-2 py-1.5 text-sm outline-none" style={{ background: 'hsl(var(--admin-surface))', border: '1px solid hsl(var(--admin-border))', color: 'hsl(var(--admin-text))' }} />
      <select value={role} onChange={(e) => setRole(e.target.value)} className="rounded-md px-2 py-1.5 text-xs"
        style={{ background: 'hsl(var(--admin-surface))', border: '1px solid hsl(var(--admin-border))', color: 'hsl(var(--admin-text))' }}>
        {roles.map((r) => <option key={r} value={r}>{humanize(r)}</option>)}
      </select>
      <button disabled={busy || !email} onClick={() => onSubmit(email, fullName, role)}
        className="rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50" style={{ background: 'hsl(var(--admin-accent-blue))', color: 'white' }}>
        {busy ? 'Inviting…' : 'Invite'}
      </button>
      <button onClick={() => setOpen(false)} className="rounded-md px-2 py-1.5 text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>Cancel</button>
    </div>
  );
}

export default function PartnerDashboard() {
  const navigate = useNavigate();
  const { partner, loading } = usePartner();
  const [view, setView] = useState<View>('customers');
  const [selected, setSelected] = useState<PartnerCustomer | null>(null);

  const signOut = async () => { await supabase.auth.signOut(); navigate('/auth'); };

  if (loading) {
    return <div className="admin-portal flex min-h-screen items-center justify-center" style={{ background: 'hsl(var(--admin-background))', color: 'hsl(var(--admin-text-muted))' }}>Loading…</div>;
  }

  const navItems: { key: View; label: string; icon: typeof Users }[] = [
    { key: 'customers', label: 'Customers', icon: Building2 },
    ...(partner?.role === 'partner_admin' ? [{ key: 'team' as View, label: 'My Team', icon: Users }] : []),
    { key: 'activity', label: 'Activity', icon: Activity },
  ];

  return (
    <div className="admin-portal min-h-screen" style={{ background: 'hsl(var(--admin-background))', color: 'hsl(var(--admin-text))' }}>
      <header className="border-b" style={{ borderColor: 'hsl(var(--admin-border))', background: 'hsl(var(--admin-sidebar))' }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <PartnerBrand size="sm" />
            <nav className="hidden items-center gap-1 md:flex">
              {navItems.map((n) => (
                <button key={n.key} onClick={() => { setView(n.key); setSelected(null); }}
                  className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium"
                  style={{
                    background: view === n.key ? 'hsl(var(--admin-accent-weak))' : 'transparent',
                    color: view === n.key ? 'hsl(var(--admin-accent-blue))' : 'hsl(var(--admin-text-muted))',
                  }}>
                  <n.icon className="h-4 w-4" /> {n.label}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm sm:inline" style={{ color: 'hsl(var(--admin-text-muted))' }}>{partner?.partner_name}</span>
            <button onClick={signOut} className="rounded-md p-2" style={{ color: 'hsl(var(--admin-text-muted))' }} title="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-6">
        {view === 'customers' && !selected && <CustomersView onOpen={setSelected} />}
        {view === 'customers' && selected && <CustomerDetail customer={selected} onBack={() => setSelected(null)} />}
        {view === 'team' && <TeamView />}
        {view === 'activity' && <ActivityView />}
      </main>
    </div>
  );
}

function CustomersView({ onOpen }: { onOpen: (c: PartnerCustomer) => void }) {
  const { listCustomers } = usePartner();
  const [rows, setRows] = useState<PartnerCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { listCustomers().then(setRows).finally(() => setLoading(false)); }, [listCustomers]);

  const columns: AdminColumn<PartnerCustomer>[] = [
    { key: 'company_name', header: 'Customer', render: (r) => <span className="font-medium">{r.company_name}</span> },
    { key: 'company_type', header: 'Type', render: (r) => <AdminBadge tone="neutral">{r.company_type}</AdminBadge> },
    { key: 'industry', header: 'Industry', render: (r) => <span style={{ color: 'hsl(var(--admin-text-muted))' }}>{r.industry ?? '—'}</span> },
    { key: 'user_count', header: 'Users', align: 'right', mono: true },
    { key: 'go', header: '', align: 'right', render: () => <ChevronRight className="h-4 w-4" style={{ color: 'hsl(var(--admin-text-muted))' }} /> },
  ];

  return (
    <div>
      <AdminPageHeader title="Managed customers" description="Companies assigned to your organization." icon={<Building2 className="h-5 w-5" />} />
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <AdminStatCard label="Customers" value={rows.length} />
        <AdminStatCard label="Total users" value={rows.reduce((n, r) => n + r.user_count, 0)} />
      </div>
      <AdminCard flush>
        <AdminDataTable columns={columns} rows={rows} rowKey={(r) => `${r.company_type}:${r.company_id}`}
          loading={loading} empty="No customers assigned yet." onRowClick={onOpen} />
      </AdminCard>
    </div>
  );
}

function CustomerDetail({ customer, onBack }: { customer: PartnerCustomer; onBack: () => void }) {
  const { toast } = useToast();
  const { listCompanyUsers, setUserRole, removeUser, setUserStatus, invite } = usePartner();
  const [rows, setRows] = useState<PartnerCompanyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);

  const handleInvite = async (email: string, fullName: string, role: string) => {
    setInviteBusy(true);
    const { data, error } = await invite({
      kind: 'company_user', company_id: customer.company_id, company_type: customer.company_type,
      email, full_name: fullName, role,
    });
    if (error || !data?.success) {
      toast({ title: 'Error', description: data?.error || error?.message || 'Failed to add user', variant: 'destructive' });
    } else if (data.membership === 'already_member') {
      toast({ title: 'Already a member', description: `${email} is already in this company.` });
    } else {
      toast({ title: data.invited ? 'Invitation sent' : 'User added', description: data.invited ? `${email} was invited by email.` : `${email} added to ${customer.company_name}.` });
      await load();
    }
    setInviteBusy(false);
  };

  const load = useCallback(() => {
    setLoading(true);
    listCompanyUsers(customer.company_id, customer.company_type).then(setRows).finally(() => setLoading(false));
  }, [listCompanyUsers, customer]);
  useEffect(load, [load]);

  const changeRole = async (u: PartnerCompanyUser, role: string) => {
    setBusy(u.company_user_id);
    const { error } = await setUserRole(u.company_user_id, role);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Role updated', description: `${u.full_name || u.email} → ${humanize(role)}` }); await load(); }
    setBusy(null);
  };
  const toggleDisabled = async (u: PartnerCompanyUser) => {
    setBusy(u.company_user_id);
    const { data, error } = await setUserStatus(u.profile_id, !u.account_disabled);
    if (error || !data?.success) toast({ title: 'Error', description: data?.error || error?.message || 'Failed', variant: 'destructive' });
    else { toast({ title: u.account_disabled ? 'User re-enabled' : 'User disabled' }); await load(); }
    setBusy(null);
  };
  const remove = async (u: PartnerCompanyUser) => {
    setBusy(u.company_user_id);
    const { error } = await removeUser(u.company_user_id);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else { toast({ title: 'User removed', description: `${u.full_name || u.email} removed from ${customer.company_name}` }); await load(); }
    setBusy(null);
  };

  const columns: AdminColumn<PartnerCompanyUser>[] = [
    { key: 'full_name', header: 'User', render: (u) => (
      <div><div className="font-medium">{u.full_name || '—'}</div><div className="text-xs" style={{ color: 'hsl(var(--admin-text-muted))' }}>{u.email}</div></div>
    ) },
    { key: 'role', header: 'Role', render: (u) => (
      <select value={ASSIGNABLE_ROLES.includes(u.role) ? u.role : ''} disabled={busy === u.company_user_id}
        onChange={(e) => changeRole(u, e.target.value)}
        className="rounded-md px-2 py-1 text-xs" style={{ background: 'hsl(var(--admin-surface))', border: '1px solid hsl(var(--admin-border))', color: 'hsl(var(--admin-text))' }}>
        {!ASSIGNABLE_ROLES.includes(u.role) && <option value="">{humanize(u.role)}</option>}
        {ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{humanize(r)}</option>)}
      </select>
    ) },
    { key: 'status', header: 'Status', render: (u) => (
      u.account_disabled ? <AdminBadge tone="danger">disabled</AdminBadge> : <AdminBadge tone={statusTone(u.status)}>{u.status}</AdminBadge>
    ) },
    { key: 'actions', header: '', align: 'right', render: (u) => (
      <div className="flex items-center justify-end gap-1">
        <button onClick={() => toggleDisabled(u)} disabled={busy === u.company_user_id} title={u.account_disabled ? 'Re-enable login' : 'Disable login'}
          className="rounded-md p-1.5 hover:bg-[hsl(var(--admin-surface))]" style={{ color: u.account_disabled ? 'hsl(var(--admin-positive))' : 'hsl(var(--admin-danger))' }}>
          {u.account_disabled ? <ShieldCheck className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
        </button>
        {u.status === 'active' && (
          <button onClick={() => remove(u)} disabled={busy === u.company_user_id} title="Remove from company"
            className="rounded-md p-1.5 hover:bg-[hsl(var(--admin-surface))]" style={{ color: 'hsl(var(--admin-text-muted))' }}>
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    ) },
  ];

  return (
    <div>
      <div className="mb-5 flex items-start gap-3">
        <button onClick={onBack} className="mt-1 rounded-md p-1.5" style={{ border: '1px solid hsl(var(--admin-border))', color: 'hsl(var(--admin-text))' }} title="Back">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'hsl(var(--admin-text))' }}>{customer.company_name}</h1>
          <p className="mt-0.5 text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>
            {[customer.industry, customer.company_type].filter(Boolean).join(' · ')} · managing users on behalf of this customer
          </p>
        </div>
      </div>
      <AdminCard flush>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3" style={{ borderColor: 'hsl(var(--admin-border))' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'hsl(var(--admin-text))' }}>Users ({rows.length})</h2>
          <InviteForm roles={ASSIGNABLE_ROLES} busy={inviteBusy} onSubmit={handleInvite} />
        </div>
        <AdminDataTable columns={columns} rows={rows} rowKey={(u) => u.company_user_id} loading={loading} empty="No users in this company." />
      </AdminCard>
    </div>
  );
}

function TeamView() {
  const { toast } = useToast();
  const { partner, listMembers, invite } = usePartner();
  const [rows, setRows] = useState<PartnerMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteBusy, setInviteBusy] = useState(false);
  const reload = useCallback(() => { setLoading(true); listMembers().then(setRows).finally(() => setLoading(false)); }, [listMembers]);
  useEffect(reload, [reload]);

  const handleInvite = async (email: string, fullName: string, role: string) => {
    if (!partner) return;
    setInviteBusy(true);
    const { data, error } = await invite({ kind: 'partner_member', partner_id: partner.partner_id, email, full_name: fullName, role });
    if (error || !data?.success) toast({ title: 'Error', description: data?.error || error?.message || 'Failed', variant: 'destructive' });
    else { toast({ title: data.invited ? 'Invitation sent' : 'Staff added', description: email }); reload(); }
    setInviteBusy(false);
  };

  const columns: AdminColumn<PartnerMember>[] = [
    { key: 'full_name', header: 'Member', render: (m) => (
      <div><div className="font-medium">{m.full_name || '—'}</div><div className="text-xs" style={{ color: 'hsl(var(--admin-text-muted))' }}>{m.email}</div></div>
    ) },
    { key: 'role', header: 'Role', render: (m) => <AdminBadge tone="info">{humanize(m.role)}</AdminBadge> },
    { key: 'status', header: 'Status', render: (m) => <AdminBadge tone={statusTone(m.status)}>{m.status}</AdminBadge> },
  ];
  return (
    <div>
      <AdminPageHeader title="My team" description="Your organization's internal staff." icon={<Users className="h-5 w-5" />}
        actions={partner?.role === 'partner_admin' ? <InviteForm roles={['partner_agent', 'partner_manager', 'partner_admin']} busy={inviteBusy} onSubmit={handleInvite} /> : undefined} />
      <AdminCard flush><AdminDataTable columns={columns} rows={rows} rowKey={(m) => m.member_id} loading={loading} empty="No team members." /></AdminCard>
    </div>
  );
}

function ActivityView() {
  const { listActivity } = usePartner();
  const [rows, setRows] = useState<PartnerActivity[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { listActivity().then(setRows).finally(() => setLoading(false)); }, [listActivity]);

  const columns: AdminColumn<PartnerActivity>[] = [
    { key: 'created_at', header: 'When', mono: true, render: (a) => new Date(a.created_at).toLocaleString() },
    { key: 'actor_name', header: 'By', render: (a) => a.actor_name || '—' },
    { key: 'action', header: 'Action', render: (a) => <AdminBadge tone="neutral">{humanize(a.action)}</AdminBadge> },
    { key: 'target_name', header: 'Target', render: (a) => a.target_name || '—' },
    { key: 'company_name', header: 'Customer', render: (a) => a.company_name },
  ];
  return (
    <div>
      <AdminPageHeader title="Activity" description="Every action your team takes on customers is logged here — and visible to the customer." icon={<Activity className="h-5 w-5" />} />
      <AdminCard flush><AdminDataTable columns={columns} rows={rows} rowKey={(a) => a.id} loading={loading} empty="No activity yet." /></AdminCard>
    </div>
  );
}
