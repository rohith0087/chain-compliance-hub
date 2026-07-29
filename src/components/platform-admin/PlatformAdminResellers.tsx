import { useCallback, useEffect, useMemo, useState } from 'react';
import { Store, ArrowLeft, Plus, Trash2, Building2, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { AdminPageHeader, AdminCard, AdminBadge, AdminDataTable, type AdminColumn, type AdminTone } from './ui';

interface Partner { id: string; name: string; status: string; contact_email: string | null; member_count: number; customer_count: number; }
interface PartnerCustomer { link_id: string; company_id: string; company_type: string; company_name: string; status: string; }
interface PartnerMember { member_id: string; profile_id: string; email: string; full_name: string; role: string; status: string; }
interface Company { company_id: string; company_type: string; company_name: string; current_partner: string | null; }

const PARTNER_ROLES = ['partner_admin', 'partner_manager', 'partner_agent'];
const humanize = (s: string) => s.replace(/_/g, ' ');
const statusTone = (s: string): AdminTone => (s === 'active' ? 'positive' : s === 'suspended' || s === 'disabled' ? 'danger' : 'neutral');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = supabase as any;

export function PlatformAdminResellers() {
  const { toast } = useToast();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Partner | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await rpc.rpc('admin_list_partners');
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    setPartners((data ?? []) as Partner[]);
    setLoading(false);
  }, [toast]);
  useEffect(() => { void load(); }, [load]);

  const createPartner = async () => {
    if (!newName.trim()) return;
    const { error } = await rpc.rpc('admin_create_partner', { p_name: newName.trim(), p_contact_email: newEmail.trim() || null });
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Reseller created', description: newName }); setNewName(''); setNewEmail(''); setCreating(false); await load(); }
  };
  const toggleStatus = async (p: Partner) => {
    const next = p.status === 'active' ? 'suspended' : 'active';
    const { error } = await rpc.rpc('admin_set_partner_status', { p_partner_id: p.id, p_status: next });
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else { toast({ title: `Reseller ${next}` }); await load(); }
  };

  if (selected) {
    const fresh = partners.find((p) => p.id === selected.id) ?? selected;
    return <ResellerDetail partner={fresh} onBack={() => { setSelected(null); void load(); }} />;
  }

  const columns: AdminColumn<Partner>[] = [
    { key: 'name', header: 'Reseller', render: (p) => <span className="font-medium">{p.name}</span> },
    { key: 'status', header: 'Status', render: (p) => <AdminBadge tone={statusTone(p.status)}>{p.status}</AdminBadge> },
    { key: 'member_count', header: 'Staff', align: 'right', mono: true },
    { key: 'customer_count', header: 'Customers', align: 'right', mono: true },
    { key: 'act', header: '', align: 'right', render: (p) => (
      <button onClick={(e) => { e.stopPropagation(); toggleStatus(p); }}
        className="rounded-md px-2 py-1 text-xs font-medium" style={{ border: '1px solid hsl(var(--admin-border))', color: 'hsl(var(--admin-text-muted))' }}>
        {p.status === 'active' ? 'Suspend' : 'Activate'}
      </button>
    ) },
  ];

  return (
    <div>
      <AdminPageHeader title="Resellers" description="Create partner organizations and assign them customer companies to manage."
        icon={<Store className="h-5 w-5" />}
        actions={<button onClick={() => setCreating((v) => !v)} className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium" style={{ background: 'hsl(var(--admin-accent-blue))', color: 'white' }}><Plus className="h-4 w-4" /> New reseller</button>} />

      {creating && (
        <AdminCard className="mb-4">
          <div className="flex flex-wrap items-end gap-3">
            <div><label className="text-xs" style={{ color: 'hsl(var(--admin-text-muted))' }}>Name</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Acme Partners"
                className="mt-1 block rounded-md px-2 py-1.5 text-sm outline-none" style={{ background: 'hsl(var(--admin-surface))', border: '1px solid hsl(var(--admin-border))', color: 'hsl(var(--admin-text))' }} /></div>
            <div><label className="text-xs" style={{ color: 'hsl(var(--admin-text-muted))' }}>Contact email</label>
              <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="ops@acme.com"
                className="mt-1 block rounded-md px-2 py-1.5 text-sm outline-none" style={{ background: 'hsl(var(--admin-surface))', border: '1px solid hsl(var(--admin-border))', color: 'hsl(var(--admin-text))' }} /></div>
            <button onClick={createPartner} className="rounded-md px-3 py-1.5 text-sm font-medium" style={{ background: 'hsl(var(--admin-accent-blue))', color: 'white' }}>Create</button>
          </div>
        </AdminCard>
      )}

      <AdminCard flush>
        <AdminDataTable columns={columns} rows={partners} rowKey={(p) => p.id} loading={loading} empty="No resellers yet." onRowClick={setSelected} />
      </AdminCard>
    </div>
  );
}

function ResellerDetail({ partner, onBack }: { partner: Partner; onBack: () => void }) {
  const { toast } = useToast();
  const { users } = usePlatformAdmin();
  const [customers, setCustomers] = useState<PartnerCustomer[]>([]);
  const [members, setMembers] = useState<PartnerMember[]>([]);
  const [companyQuery, setCompanyQuery] = useState('');
  const [companyResults, setCompanyResults] = useState<Company[]>([]);
  const [userQuery, setUserQuery] = useState('');
  const [pickRole, setPickRole] = useState('partner_agent');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);

  const load = useCallback(async () => {
    const [{ data: cs }, { data: ms }] = await Promise.all([
      rpc.rpc('admin_list_partner_customers', { p_partner_id: partner.id }),
      rpc.rpc('admin_list_partner_members', { p_partner_id: partner.id }),
    ]);
    setCustomers((cs ?? []) as PartnerCustomer[]);
    setMembers((ms ?? []) as PartnerMember[]);
  }, [partner.id]);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (companyQuery.trim().length < 2) { setCompanyResults([]); return; }
    let active = true;
    rpc.rpc('admin_list_companies', { p_search: companyQuery.trim() }).then(({ data }: { data: Company[] }) => { if (active) setCompanyResults(data ?? []); });
    return () => { active = false; };
  }, [companyQuery]);

  const assign = async (c: Company) => {
    const { error } = await rpc.rpc('admin_assign_company_to_partner', { p_partner_id: partner.id, p_company_id: c.company_id, p_company_type: c.company_type });
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Company assigned', description: c.company_name }); setCompanyQuery(''); setCompanyResults([]); await load(); }
  };
  const unassign = async (c: PartnerCustomer) => {
    const { error } = await rpc.rpc('admin_unassign_company', { p_company_id: c.company_id, p_company_type: c.company_type });
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Company unassigned', description: c.company_name }); await load(); }
  };
  const addMember = async (profileId: string, label: string) => {
    const { error } = await rpc.rpc('admin_add_partner_member', { p_partner_id: partner.id, p_profile_id: profileId, p_role: pickRole });
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Staff added', description: label }); setUserQuery(''); await load(); }
  };
  const setMember = async (m: PartnerMember, patch: { status?: string; role?: string }) => {
    const { error } = await rpc.rpc('admin_set_partner_member', { p_member_id: m.member_id, p_status: patch.status ?? null, p_role: patch.role ?? null });
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else await load();
  };
  const inviteStaff = async () => {
    if (!inviteEmail.trim()) return;
    setInviteBusy(true);
    const { data, error } = await rpc.functions.invoke('create-user', {
      body: { kind: 'partner_member', partner_id: partner.id, email: inviteEmail.trim(), full_name: inviteName.trim() || null, role: pickRole },
    });
    if (error || !data?.success) toast({ title: 'Error', description: data?.error || error?.message || 'Failed', variant: 'destructive' });
    else { toast({ title: data.invited ? 'Invitation sent' : 'Staff added', description: inviteEmail }); setInviteEmail(''); setInviteName(''); await load(); }
    setInviteBusy(false);
  };

  const userMatches = useMemo(() => {
    if (userQuery.trim().length < 2) return [];
    const q = userQuery.toLowerCase();
    const taken = new Set(members.map((m) => m.profile_id));
    return (users ?? []).filter((u) => !taken.has(u.id) && (`${u.full_name} ${u.email}`.toLowerCase().includes(q))).slice(0, 6);
  }, [userQuery, users, members]);

  return (
    <div>
      <div className="mb-5 flex items-start gap-3">
        <button onClick={onBack} className="mt-1 rounded-md p-1.5" style={{ border: '1px solid hsl(var(--admin-border))', color: 'hsl(var(--admin-text))' }}><ArrowLeft className="h-4 w-4" /></button>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold" style={{ color: 'hsl(var(--admin-text))' }}>{partner.name}</h1>
          <AdminBadge tone={statusTone(partner.status)}>{partner.status}</AdminBadge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Customers */}
        <AdminCard flush>
          <div className="flex items-center gap-2 border-b px-5 py-3" style={{ borderColor: 'hsl(var(--admin-border))' }}>
            <Building2 className="h-4 w-4" style={{ color: 'hsl(var(--admin-accent-blue))' }} />
            <h2 className="text-sm font-semibold" style={{ color: 'hsl(var(--admin-text))' }}>Customers ({customers.length})</h2>
          </div>
          <div className="p-3">
            <input value={companyQuery} onChange={(e) => setCompanyQuery(e.target.value)} placeholder="Search a company to assign…"
              className="w-full rounded-md px-2 py-1.5 text-sm outline-none" style={{ background: 'hsl(var(--admin-surface))', border: '1px solid hsl(var(--admin-border))', color: 'hsl(var(--admin-text))' }} />
            {companyResults.map((c) => (
              <button key={`${c.company_type}:${c.company_id}`} onClick={() => assign(c)}
                className="mt-1 flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-[hsl(var(--admin-surface))]" style={{ color: 'hsl(var(--admin-text))' }}>
                <span>{c.company_name} <span className="text-xs" style={{ color: 'hsl(var(--admin-text-muted))' }}>· {c.company_type}</span></span>
                {c.current_partner ? <span className="text-xs" style={{ color: 'hsl(var(--admin-warning))' }}>managed by {c.current_partner}</span> : <Plus className="h-3.5 w-3.5" style={{ color: 'hsl(var(--admin-accent-blue))' }} />}
              </button>
            ))}
          </div>
          {customers.map((c) => (
            <div key={c.link_id} className="flex items-center justify-between border-t px-5 py-2.5" style={{ borderColor: 'hsl(var(--admin-border))' }}>
              <span className="text-sm" style={{ color: 'hsl(var(--admin-text))' }}>{c.company_name} <span className="text-xs" style={{ color: 'hsl(var(--admin-text-muted))' }}>· {c.company_type}</span></span>
              <button onClick={() => unassign(c)} className="rounded-md p-1.5" style={{ color: 'hsl(var(--admin-danger))' }} title="Unassign"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
          {customers.length === 0 && <p className="px-5 py-4 text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>No customers assigned.</p>}
        </AdminCard>

        {/* Team */}
        <AdminCard flush>
          <div className="flex items-center gap-2 border-b px-5 py-3" style={{ borderColor: 'hsl(var(--admin-border))' }}>
            <UserPlus className="h-4 w-4" style={{ color: 'hsl(var(--admin-accent-blue))' }} />
            <h2 className="text-sm font-semibold" style={{ color: 'hsl(var(--admin-text))' }}>Staff ({members.length})</h2>
          </div>
          <div className="p-3">
            <div className="flex gap-2">
              <input value={userQuery} onChange={(e) => setUserQuery(e.target.value)} placeholder="Search an existing user to add…"
                className="w-full rounded-md px-2 py-1.5 text-sm outline-none" style={{ background: 'hsl(var(--admin-surface))', border: '1px solid hsl(var(--admin-border))', color: 'hsl(var(--admin-text))' }} />
              <select value={pickRole} onChange={(e) => setPickRole(e.target.value)}
                className="rounded-md px-2 py-1.5 text-xs" style={{ background: 'hsl(var(--admin-surface))', border: '1px solid hsl(var(--admin-border))', color: 'hsl(var(--admin-text))' }}>
                {PARTNER_ROLES.map((r) => <option key={r} value={r}>{humanize(r)}</option>)}
              </select>
            </div>
            {userMatches.map((u) => (
              <button key={u.id} onClick={() => addMember(u.id, u.full_name || u.email)}
                className="mt-1 flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-[hsl(var(--admin-surface))]" style={{ color: 'hsl(var(--admin-text))' }}>
                <span>{u.full_name || u.email} <span className="text-xs" style={{ color: 'hsl(var(--admin-text-muted))' }}>{u.email}</span></span>
                <Plus className="h-3.5 w-3.5" style={{ color: 'hsl(var(--admin-accent-blue))' }} />
              </button>
            ))}
            <div className="mt-2 flex flex-wrap items-center gap-2 border-t pt-2" style={{ borderColor: 'hsl(var(--admin-border))' }}>
              <span className="text-xs" style={{ color: 'hsl(var(--admin-text-muted))' }}>or invite new:</span>
              <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="email@acme.com" type="email"
                className="rounded-md px-2 py-1 text-xs outline-none" style={{ background: 'hsl(var(--admin-surface))', border: '1px solid hsl(var(--admin-border))', color: 'hsl(var(--admin-text))' }} />
              <input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Full name"
                className="rounded-md px-2 py-1 text-xs outline-none" style={{ background: 'hsl(var(--admin-surface))', border: '1px solid hsl(var(--admin-border))', color: 'hsl(var(--admin-text))' }} />
              <button onClick={inviteStaff} disabled={inviteBusy || !inviteEmail} className="rounded-md px-2.5 py-1 text-xs font-medium disabled:opacity-50" style={{ background: 'hsl(var(--admin-accent-blue))', color: 'white' }}>
                {inviteBusy ? 'Inviting…' : 'Invite'}
              </button>
            </div>
          </div>
          {members.map((m) => (
            <div key={m.member_id} className="flex items-center justify-between gap-2 border-t px-5 py-2.5" style={{ borderColor: 'hsl(var(--admin-border))' }}>
              <div className="min-w-0"><div className="truncate text-sm" style={{ color: 'hsl(var(--admin-text))' }}>{m.full_name || m.email}</div><div className="truncate text-xs" style={{ color: 'hsl(var(--admin-text-muted))' }}>{m.email}</div></div>
              <div className="flex items-center gap-2">
                <select value={m.role} onChange={(e) => setMember(m, { role: e.target.value })} className="rounded-md px-1.5 py-1 text-xs" style={{ background: 'hsl(var(--admin-surface))', border: '1px solid hsl(var(--admin-border))', color: 'hsl(var(--admin-text))' }}>
                  {PARTNER_ROLES.map((r) => <option key={r} value={r}>{humanize(r)}</option>)}
                </select>
                <button onClick={() => setMember(m, { status: m.status === 'active' ? 'disabled' : 'active' })}
                  className="rounded-md px-2 py-1 text-xs" style={{ border: '1px solid hsl(var(--admin-border))', color: m.status === 'active' ? 'hsl(var(--admin-danger))' : 'hsl(var(--admin-positive))' }}>
                  {m.status === 'active' ? 'Disable' : 'Enable'}
                </button>
              </div>
            </div>
          ))}
          {members.length === 0 && <p className="px-5 py-4 text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>No staff yet. Search an existing user above to add them.</p>}
        </AdminCard>
      </div>
    </div>
  );
}
