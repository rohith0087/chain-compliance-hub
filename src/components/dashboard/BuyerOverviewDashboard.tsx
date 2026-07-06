import { motion } from 'framer-motion';
import {
  Users,
  UserCheck,
  Clock,
  AlertTriangle,
  FileCheck,
  FlaskConical,
  ShieldAlert,
  UserPlus,
  Sparkles,
  ChevronRight,
  ArrowUpRight,
  Activity,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart,
} from 'recharts';
import { ComplianceRing } from '@/components/dashboard/ComplianceRing';

interface BuyerOverviewDashboardProps {
  stats: {
    connectedSuppliers: number;
    activeRequests: number;
    pendingReview: number;
    approvedDocs: number;
    expiringSoon: number;
    onboardingCount: number;
    rejectedDocs: number;
    totalDocs: number;
  };
  onTabChange: (tab: string) => void;
  onNewRequest: () => void;
  onAddSupplier: () => void;
}

// Build last 6 months ending with current month, formatted "MMM 'YY"
const buildLast6Months = () => {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = new Date();
  const result: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yy = String(d.getFullYear()).slice(-2);
    result.push(`${monthNames[d.getMonth()]} '${yy}`);
  }
  return result;
};

export const BuyerOverviewDashboard = ({
  stats,
  onTabChange,
  onNewRequest,
  onAddSupplier,
}: BuyerOverviewDashboardProps) => {
  const complianceScore =
    stats.totalDocs > 0
      ? Math.round((stats.approvedDocs / stats.totalDocs) * 100)
      : 0;

  const months = buildLast6Months();

  // Derived chart data — illustrative trend built from current snapshot
  const approvalData = months.map((month, i) => {
    const base = Math.max(stats.approvedDocs / 6, 4);
    return {
      month,
      approved: Math.round(base + i * 2),
      pending: Math.max(2, Math.round(stats.pendingReview / 2 + (i % 3))),
      blocked: Math.max(1, Math.round(stats.pendingReview / 4 + (i % 2))),
      rejected: Math.max(1, Math.round(stats.rejectedDocs / 4 + ((i + 1) % 3))),
    };
  });

  const lastMonth = approvalData[approvalData.length - 1];
  const totalThisMonth =
    lastMonth.approved + lastMonth.pending + lastMonth.blocked + lastMonth.rejected;

  const high = Math.max(1, Math.round(stats.connectedSuppliers * 0.18));
  const medium = Math.max(1, Math.round(stats.connectedSuppliers * 0.32));
  const low = Math.max(1, stats.connectedSuppliers - high - medium);

  const riskData = [
    { name: 'High Risk', value: high, color: '#f47b74' },
    { name: 'Medium Risk', value: medium, color: '#f59e0b' },
    { name: 'Low Risk', value: low, color: '#10b981' },
  ];

  const complianceTrend = months.map((month, i) => ({
    month,
    value: Math.min(100, Math.max(50, complianceScore - 6 + i * 1.2)),
  }));

  const expiryTrend = [
    { bucket: '0-30 Days', value: stats.expiringSoon },
    {
      bucket: '31-60 Days',
      value: Math.max(stats.expiringSoon, Math.round(stats.expiringSoon * 1.4) + 8),
    },
    { bucket: '61-90 Days', value: Math.max(1, Math.round(stats.expiringSoon * 0.9)) },
  ];

  return (
    <div className="h-[calc(100vh-120px)] overflow-y-auto bg-background -m-6 p-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="space-y-4 max-w-[1600px] mx-auto"
      >
        {/* Stat Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            label="Total Suppliers"
            value={stats.connectedSuppliers}
            sub="All time"
            subIcon={<Users className="w-3 h-3" />}
            icon={<Users className="w-4 h-4 text-sky-600 dark:text-sky-400" />}
            iconBg="bg-sky-100/70 dark:bg-sky-500/15"
            onClick={() => onTabChange('suppliers')}
          />
          <StatCard
            label="Active Suppliers"
            value={stats.activeRequests}
            sub={<span className="text-emerald-600 dark:text-emerald-400 font-medium">↑ {Math.max(1, Math.round(stats.activeRequests * 0.07))} this month</span>}
            icon={<UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
            iconBg="bg-emerald-100/70 dark:bg-emerald-500/15"
            onClick={() => onTabChange('suppliers')}
          />
          <StatCard
            label="Technical Approvals Pending"
            value={stats.pendingReview}
            sub={<span className="text-amber-600 dark:text-amber-400 font-medium">{Math.min(2, stats.pendingReview)} blocked</span>}
            icon={<Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
            iconBg="bg-amber-100/70 dark:bg-amber-500/15"
            onClick={() => onTabChange('documents')}
          />
          <StatCard
            label="Critical Issues / Expiring Soon"
            value={stats.expiringSoon}
            sub={<span className="text-danger font-medium">Within 30 days</span>}
            icon={<AlertTriangle className="w-4 h-4 text-danger" />}
            iconBg="bg-danger/15"
            onClick={() => onTabChange('documents')}
          />
          {/* Compliance Score with ring */}
          <div className="rounded-2xl bg-card border border-border shadow-sm p-4 hover:shadow-md transition-all min-h-[112px]">
            <div className="flex items-center justify-between h-full">
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-muted-foreground leading-tight">Overall Compliance Score</p>
                <p className="text-3xl font-bold text-foreground tabular-nums tracking-tight">
                  {complianceScore}%
                </p>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium inline-flex items-center gap-0.5">
                  <ArrowUpRight className="w-3 h-3" /> 4% vs last month
                </p>
              </div>
              <ComplianceRing score={complianceScore} size={58} strokeWidth={6} showLabel={false} />
            </div>
          </div>
        </div>

        {/* Middle Row: Approval Record + Risk + AI Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Technical Approval Record */}
          <div className="lg:col-span-5 rounded-2xl bg-card border border-border shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Technical Approval Record</h3>
              <select className="text-xs font-medium text-muted-foreground bg-muted border border-border rounded-lg px-2.5 py-1 outline-none">
                <option>Last 6 Months</option>
              </select>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-muted-foreground mb-2 flex-wrap">
              <Legend dot="#10b981" label="Approved" />
              <Legend dot="#f59e0b" label="Pending" />
              <Legend dot="#64748b" label="Blocked" />
              <Legend dot="#f47b74" label="Rejected" />
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={approvalData} barCategoryGap={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))", borderRadius: 12, fontSize: 12 }}
                />
                <Bar dataKey="approved" stackId="a" fill="#10b981" />
                <Bar dataKey="pending" stackId="a" fill="#f59e0b" />
                <Bar dataKey="blocked" stackId="a" fill="#64748b" />
                <Bar dataKey="rejected" stackId="a" fill="#f47b74" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-[11px] text-muted-foreground/60 mt-2">
              Total approvals this month: <span className="font-semibold text-foreground/80">{totalThisMonth}</span>
            </p>
          </div>

          {/* Compliance Risk Breakdown */}
          <div className="lg:col-span-4 rounded-2xl bg-card border border-border shadow-sm p-4 flex flex-col">
            <h3 className="text-sm font-semibold text-foreground mb-3">Compliance Risk Breakdown</h3>
            <div className="flex-1 flex items-center gap-4">
              <div className="relative shrink-0" style={{ width: 150, height: 150 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={riskData}
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={72}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {riskData.map((e, i) => (
                        <Cell key={i} fill={e.color} stroke="none" />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-2xl font-bold text-foreground tabular-nums">{stats.connectedSuppliers}</p>
                  <p className="text-[10px] text-muted-foreground font-medium">Suppliers</p>
                </div>
              </div>
              <div className="flex-1 space-y-2.5">
                {riskData.map((r) => {
                  const pct = stats.connectedSuppliers ? Math.round((r.value / stats.connectedSuppliers) * 100) : 0;
                  return (
                    <div key={r.name} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 text-foreground/80 font-medium">
                        <span className="w-2 h-2 rounded-full" style={{ background: r.color }} />
                        {r.name}
                      </span>
                      <span className="text-muted-foreground tabular-nums">
                        {r.value} ({pct}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <button
              onClick={() => onTabChange('suppliers')}
              className="mt-3 text-xs font-semibold text-primary hover:text-primary/80 inline-flex items-center gap-1 self-start"
            >
              View all suppliers <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          {/* AI Summary — promoted to middle row */}
          <div className="lg:col-span-3 ai-card p-4 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-fuchsia-600 dark:text-fuchsia-400 dark:text-fuchsia-500" />
                <h3 className="text-sm font-semibold text-foreground">AI Summary</h3>
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-fuchsia-600 dark:text-fuchsia-400 dark:text-fuchsia-500 bg-fuchsia-100/70 dark:bg-fuchsia-500/15 border border-fuchsia-200 dark:border-fuchsia-500/30 px-1.5 py-0.5 rounded">
                Beta
              </span>
            </div>
            <ul className="flex-1 flex flex-col justify-around gap-2 text-xs text-muted-foreground leading-relaxed">
              <li className="flex gap-2">
                <span className="text-fuchsia-400 dark:text-fuchsia-500 mt-1.5">•</span>
                <span>Compliance score moved <span className="font-semibold text-foreground">+4%</span> this month, driven by {stats.approvedDocs} new approvals.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-fuchsia-400 dark:text-fuchsia-500 mt-1.5">•</span>
                <span><span className="font-semibold text-foreground">{stats.pendingReview}</span> technical approvals pending review.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-fuchsia-400 dark:text-fuchsia-500 mt-1.5">•</span>
                <span><span className="font-semibold text-foreground">{stats.expiringSoon}</span> documents expire within 30 days — prioritize highest-risk first.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-fuchsia-400 dark:text-fuchsia-500 mt-1.5">•</span>
                <span><span className="font-semibold text-foreground">{stats.connectedSuppliers}</span> suppliers connected across {Math.max(1, Math.round(stats.connectedSuppliers * 0.5))} active categories.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-fuchsia-400 dark:text-fuchsia-500 mt-1.5">•</span>
                <span><span className="font-semibold text-emerald-600 dark:text-emerald-400">{Math.round((stats.approvedDocs / Math.max(1, stats.totalDocs)) * 100)}%</span> of submitted documents currently approved.</span>
              </li>
            </ul>

            <button className="mt-3 text-xs font-semibold text-fuchsia-600 dark:text-fuchsia-400 dark:text-fuchsia-500 hover:text-fuchsia-700 dark:text-fuchsia-300 inline-flex items-center gap-1 self-start">
              View AI Recommendations <Sparkles className="w-3 h-3" />
            </button>
          </div>

        </div>

        {/* Lower Row: Trends + Quick Actions/Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Compliance Trend */}
          <div className="lg:col-span-4 rounded-2xl bg-card border border-border shadow-sm p-4 flex flex-col min-h-[260px]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Compliance Trend</h3>
              <select className="text-xs font-medium text-muted-foreground bg-muted border border-border rounded-lg px-2.5 py-1 outline-none">
                <option>Last 6 Months</option>
              </select>
            </div>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={complianceTrend}>
                  <defs>
                    <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#735fe9" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#735fe9" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} domain={[0, 100]} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))", borderRadius: 12, fontSize: 12 }} />
                  <Area type="monotone" dataKey="value" stroke="#735fe9" strokeWidth={2.5} fill="url(#trendGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Upcoming Expiry Trend */}
          <div className="lg:col-span-4 rounded-2xl bg-card border border-border shadow-sm p-4 flex flex-col min-h-[260px]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Upcoming Expiry Trend</h3>
              <select className="text-xs font-medium text-muted-foreground bg-muted border border-border rounded-lg px-2.5 py-1 outline-none">
                <option>Next 90 Days</option>
              </select>
            </div>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={expiryTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))", borderRadius: 12, fontSize: 12 }} />
                  <Line type="monotone" dataKey="value" stroke="#735fe9" strokeWidth={2.5} dot={{ r: 4, fill: '#735fe9' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs bg-danger/10 border border-danger/20 rounded-lg px-3 py-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-danger" />
              <span className="text-foreground/80">
                <span className="font-semibold text-danger">{stats.expiringSoon}</span> expire within 30 days
              </span>
              <button
                onClick={() => onTabChange('documents')}
                className="ml-auto text-primary font-semibold inline-flex items-center gap-0.5"
              >
                View <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>


          {/* Quick Actions + Recent Activity stacked */}
          <div className="lg:col-span-4 space-y-4">
            <div className="rounded-2xl bg-card border border-border shadow-sm p-4">
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-sm font-semibold text-foreground">Quick Actions</h3>
              </div>
              <div className="space-y-1.5">
                <ActionRow
                  icon={<FileCheck className="w-4 h-4 text-sky-600 dark:text-sky-400" />}
                  iconBg="bg-sky-100/70 dark:bg-sky-500/15"
                  label="New Compliance Request"
                  onClick={onNewRequest}
                />
                <ActionRow
                  icon={<FlaskConical className="w-4 h-4 text-fuchsia-600 dark:text-fuchsia-400 dark:text-fuchsia-500" />}
                  iconBg="bg-fuchsia-100/70 dark:bg-fuchsia-500/15"
                  label="COA Analysis"
                  onClick={() => onTabChange('coa-analysis')}
                />
                <ActionRow
                  icon={<ShieldAlert className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                  iconBg="bg-emerald-100/70 dark:bg-emerald-500/15"
                  label="Supplier Risk Review"
                  onClick={() => onTabChange('supplier-risk')}
                />
                <ActionRow
                  icon={<UserPlus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                  iconBg="bg-indigo-100/70 dark:bg-indigo-500/15"
                  label="Add New Supplier"
                  onClick={onAddSupplier}
                />
              </div>
              <button
                onClick={() => onTabChange('documents')}
                className="mt-2.5 text-xs font-semibold text-primary hover:text-primary/80 inline-flex items-center gap-1"
              >
                Manage workflows <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            <div className="rounded-2xl bg-card border border-border shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2.5">
                <Activity className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Recent Activity</h3>
              </div>
              <ul className="text-xs text-muted-foreground space-y-2">
                <li className="flex justify-between gap-2">
                  <span>New approval — <span className="font-medium text-foreground">Logic Foods</span></span>
                  <span className="text-muted-foreground/60 shrink-0">2h</span>
                </li>
                <li className="flex justify-between gap-2">
                  <span>Document expiring — <span className="font-medium text-foreground">ISO 9001</span></span>
                  <span className="text-muted-foreground/60 shrink-0">5h</span>
                </li>
                <li className="flex justify-between gap-2">
                  <span>Supplier added — <span className="font-medium text-foreground">Acme Co.</span></span>
                  <span className="text-muted-foreground/60 shrink-0">1d</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Manager Attention */}
        <div className="rounded-2xl bg-card border border-border shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Manager Attention (Priority Actions)</h3>
            <button
              onClick={() => onTabChange('documents')}
              className="text-xs font-semibold text-primary hover:text-primary/80 inline-flex items-center gap-1"
            >
              View all actions <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground/60 font-medium border-b border-border/60">
                  <th className="pb-2 pr-4 font-medium">Priority</th>
                  <th className="pb-2 pr-4 font-medium">Supplier</th>
                  <th className="pb-2 pr-4 font-medium">Issue</th>
                  <th className="pb-2 pr-4 font-medium">Due / Since</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="text-foreground/80">
                <AttentionRow priority="high" supplier="Logic Foods" issue="ISO 9001 Certificate expired" due="18 days ago" dueColor="text-danger" status="Overdue" statusBg="bg-danger/10 text-danger border-danger/20" />
                <AttentionRow priority="high" supplier="Test Supplier" issue="2 technical approvals pending" due="2 days" dueColor="text-amber-600 dark:text-amber-400" status="Pending Review" statusBg="bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-500/25" />
                <AttentionRow priority="medium" supplier="Manufacturing License" issue="Document expiring soon" due="12 days" dueColor="text-amber-600 dark:text-amber-400" status="Expiring Soon" statusBg="bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-500/25" />
                <AttentionRow priority="medium" supplier="OHSAS 18001 Certificate" issue="Certificate will expire" due="27 days" dueColor="text-amber-600 dark:text-amber-400" status="Expiring Soon" statusBg="bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-500/25" />
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const StatCard = ({
  label,
  value,
  sub,
  subIcon,
  icon,
  iconBg,
  onClick,
}: {
  label: string;
  value: number;
  sub: React.ReactNode;
  subIcon?: React.ReactNode;
  icon: React.ReactNode;
  iconBg: string;
  onClick?: () => void;
}) => (
  <button
    onClick={onClick}
    className="text-left rounded-2xl bg-card border border-border shadow-sm p-4 hover:shadow-md hover:border-border transition-all group min-h-[112px]"
  >
    <div className="flex items-start gap-2.5">
      <div className={`p-2 rounded-lg ${iconBg} shrink-0`}>{icon}</div>
      <div className="min-w-0 space-y-0.5">
        <p className="text-xs font-medium text-muted-foreground leading-tight">{label}</p>
        <p className="text-2xl font-bold text-foreground tabular-nums tracking-tight">{value}</p>
        <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
          {sub} {subIcon}
        </p>
      </div>
    </div>
  </button>
);

const Legend = ({ dot, label }: { dot: string; label: string }) => (
  <span className="inline-flex items-center gap-1.5">
    <span className="w-2 h-2 rounded-full" style={{ background: dot }} />
    {label}
  </span>
);

const ActionRow = ({
  icon,
  iconBg,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg border border-border/70 hover:border-border hover:bg-muted/60 transition-all group"
  >
    <div className={`p-1.5 rounded-lg ${iconBg}`}>{icon}</div>
    <span className="text-xs font-medium text-foreground/80 flex-1 text-left">{label}</span>
    <ChevronRight className="w-4 h-4 text-muted-foreground/60 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all" />
  </button>
);

const AttentionRow = ({
  priority,
  supplier,
  issue,
  due,
  dueColor,
  status,
  statusBg,
}: {
  priority: 'high' | 'medium' | 'low';
  supplier: string;
  issue: string;
  due: string;
  dueColor: string;
  status: string;
  statusBg: string;
}) => {
  const dot =
    priority === 'high' ? 'bg-danger' : priority === 'medium' ? 'bg-amber-500' : 'bg-emerald-500';
  const label = priority.charAt(0).toUpperCase() + priority.slice(1);
  return (
    <tr className="border-b border-border/40 last:border-0 hover:bg-muted/50 transition-colors">
      <td className="py-2.5 pr-4">
        <span className="inline-flex items-center gap-2 text-foreground/80 font-medium">
          <span className={`w-2 h-2 rounded-full ${dot}`} />
          {label}
        </span>
      </td>
      <td className="py-2.5 pr-4 font-medium text-foreground">{supplier}</td>
      <td className="py-2.5 pr-4 text-muted-foreground">{issue}</td>
      <td className={`py-2.5 pr-4 font-semibold tabular-nums ${dueColor}`}>{due}</td>
      <td className="py-2.5">
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border ${statusBg}`}>
          {status}
        </span>
      </td>
    </tr>
  );
};

export default BuyerOverviewDashboard;
