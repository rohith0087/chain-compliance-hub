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
  ArrowDownRight,
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

const months = ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'];

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

  // Derived chart data — illustrative trend built from current snapshot
  const approvalData = months.map((m, i) => {
    const base = Math.max(stats.approvedDocs / 6, 4);
    return {
      month: `${m} '25`,
      approved: Math.round(base + i * 2),
      pending: Math.max(2, Math.round(stats.pendingReview / 2 + (i % 3))),
      rejected: Math.max(1, Math.round(stats.rejectedDocs / 4 + ((i + 1) % 3))),
    };
  });

  const high = Math.max(1, Math.round(stats.connectedSuppliers * 0.18));
  const medium = Math.max(1, Math.round(stats.connectedSuppliers * 0.32));
  const low = Math.max(1, stats.connectedSuppliers - high - medium);

  const riskData = [
    { name: 'High Risk', value: high, color: '#ef4444' },
    { name: 'Medium Risk', value: medium, color: '#f59e0b' },
    { name: 'Low Risk', value: low, color: '#10b981' },
  ];

  const complianceTrend = months.map((m, i) => ({
    month: `${m} '25`,
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
    <div className="h-[calc(100vh-120px)] overflow-y-auto bg-slate-50/40 -m-6 p-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="space-y-5 max-w-[1600px] mx-auto"
      >
        {/* Stat Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            label="Total Suppliers"
            value={stats.connectedSuppliers}
            sub="All time"
            subIcon={<Users className="w-3 h-3" />}
            icon={<Users className="w-5 h-5 text-sky-600" />}
            iconBg="bg-sky-100/70"
            onClick={() => onTabChange('suppliers')}
          />
          <StatCard
            label="Active Suppliers"
            value={stats.activeRequests}
            sub={<span className="text-emerald-600 font-medium">↑ {Math.max(1, Math.round(stats.activeRequests * 0.07))} this month</span>}
            icon={<UserCheck className="w-5 h-5 text-emerald-600" />}
            iconBg="bg-emerald-100/70"
            onClick={() => onTabChange('suppliers')}
          />
          <StatCard
            label="Technical Approvals Pending"
            value={stats.pendingReview}
            sub={<span className="text-amber-600 font-medium">{Math.min(2, stats.pendingReview)} blocked</span>}
            icon={<Clock className="w-5 h-5 text-amber-600" />}
            iconBg="bg-amber-100/70"
            onClick={() => onTabChange('documents')}
          />
          <StatCard
            label="Critical Issues / Expiring Soon"
            value={stats.expiringSoon}
            sub={<span className="text-rose-600 font-medium">Within 30 days</span>}
            icon={<AlertTriangle className="w-5 h-5 text-rose-600" />}
            iconBg="bg-rose-100/70"
            onClick={() => onTabChange('documents')}
          />
          {/* Compliance Score with ring */}
          <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-5 hover:shadow-md transition-all">
            <div className="flex items-center justify-between h-full">
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-500">Overall Compliance Score</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-bold text-slate-900 tabular-nums tracking-tight">
                    {complianceScore}%
                  </p>
                  <span className="text-xs text-emerald-600 font-medium inline-flex items-center gap-0.5">
                    <ArrowUpRight className="w-3 h-3" /> 4%
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">vs last month</p>
              </div>
              <ComplianceRing score={complianceScore} size={62} strokeWidth={6} />
            </div>
          </div>
        </div>

        {/* Middle Row: Approvals + Risk + Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Technical Approval Overview */}
          <div className="lg:col-span-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-900">Technical Approval Overview</h3>
              <select className="text-xs font-medium text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none">
                <option>Last 6 Months</option>
              </select>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-slate-500 mb-2">
              <Legend dot="#10b981" label="Approved" />
              <Legend dot="#f59e0b" label="Pending" />
              <Legend dot="#ef4444" label="Rejected" />
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={approvalData} barCategoryGap={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 12 }}
                />
                <Bar dataKey="approved" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                <Bar dataKey="pending" stackId="a" fill="#f59e0b" />
                <Bar dataKey="rejected" stackId="a" fill="#ef4444" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-[11px] text-slate-400 mt-2">
              Total approvals this month: <span className="font-semibold text-slate-700">{stats.approvedDocs}</span>
            </p>
          </div>

          {/* Compliance Risk Breakdown */}
          <div className="lg:col-span-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Compliance Risk Breakdown</h3>
            <div className="flex items-center gap-4">
              <div className="relative" style={{ width: 160, height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={riskData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
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
                  <p className="text-2xl font-bold text-slate-900 tabular-nums">{stats.connectedSuppliers}</p>
                  <p className="text-[10px] text-slate-500 font-medium">Suppliers</p>
                </div>
              </div>
              <div className="flex-1 space-y-2.5">
                {riskData.map((r) => {
                  const pct = stats.connectedSuppliers ? Math.round((r.value / stats.connectedSuppliers) * 100) : 0;
                  return (
                    <div key={r.name} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 text-slate-700 font-medium">
                        <span className="w-2 h-2 rounded-full" style={{ background: r.color }} />
                        {r.name}
                      </span>
                      <span className="text-slate-500 tabular-nums">
                        {r.value} ({pct}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <button
              onClick={() => onTabChange('suppliers')}
              className="mt-4 text-xs font-semibold text-sky-600 hover:text-sky-700 inline-flex items-center gap-1"
            >
              View all suppliers <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          {/* Quick Actions */}
          <div className="lg:col-span-3 rounded-2xl bg-white border border-slate-200/80 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <ActionRow
                icon={<FileCheck className="w-4 h-4 text-sky-600" />}
                iconBg="bg-sky-100/70"
                label="New Compliance Request"
                onClick={onNewRequest}
              />
              <ActionRow
                icon={<FlaskConical className="w-4 h-4 text-violet-600" />}
                iconBg="bg-violet-100/70"
                label="COA Analysis"
                onClick={() => onTabChange('coa-analysis')}
              />
              <ActionRow
                icon={<ShieldAlert className="w-4 h-4 text-emerald-600" />}
                iconBg="bg-emerald-100/70"
                label="Supplier Risk Review"
                onClick={() => onTabChange('supplier-risk')}
              />
              <ActionRow
                icon={<UserPlus className="w-4 h-4 text-indigo-600" />}
                iconBg="bg-indigo-100/70"
                label="Add New Supplier"
                onClick={onAddSupplier}
              />
            </div>
          </div>
        </div>

        {/* Lower Row: Trends + AI + Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Compliance Trend */}
          <div className="lg:col-span-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-900">Compliance Trend</h3>
              <select className="text-xs font-medium text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none">
                <option>Last 6 Months</option>
              </select>
            </div>
            <ResponsiveContainer width="100%" height={170}>
              <AreaChart data={complianceTrend}>
                <defs>
                  <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 12 }} />
                <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2.5} fill="url(#trendGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Upcoming Expiry Trend */}
          <div className="lg:col-span-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-900">Upcoming Expiry Trend</h3>
              <select className="text-xs font-medium text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none">
                <option>Next 90 Days</option>
              </select>
            </div>
            <ResponsiveContainer width="100%" height={170}>
              <LineChart data={expiryTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 12 }} />
                <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4, fill: '#6366f1' }} />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-3 flex items-center gap-2 text-xs bg-rose-50/60 border border-rose-100 rounded-lg px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
              <span className="text-slate-700">
                <span className="font-semibold text-rose-600">{stats.expiringSoon}</span> documents expire within 30 days
              </span>
              <button
                onClick={() => onTabChange('documents')}
                className="ml-auto text-sky-600 font-semibold inline-flex items-center gap-0.5"
              >
                View <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* AI Summary */}
          <div className="lg:col-span-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-600" />
                <h3 className="text-sm font-semibold text-slate-900">AI Summary</h3>
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-600 bg-violet-50 border border-violet-100 px-1.5 py-0.5 rounded">
                Beta
              </span>
            </div>
            <ul className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <li className="flex gap-2">
                <span className="text-slate-300 mt-1.5">•</span>
                <span>Compliance score moved <span className="font-semibold text-slate-900">+4%</span> this month, driven by {stats.approvedDocs} new approvals.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-slate-300 mt-1.5">•</span>
                <span><span className="font-semibold text-slate-900">{stats.pendingReview}</span> technical approvals are pending review.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-slate-300 mt-1.5">•</span>
                <span><span className="font-semibold text-slate-900">{stats.expiringSoon}</span> supplier documents are due within 30 days — prioritize highest-risk first.</span>
              </li>
            </ul>
            <button className="mt-4 text-xs font-semibold text-violet-600 hover:text-violet-700 inline-flex items-center gap-1">
              View AI Recommendations <Sparkles className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Manager Attention */}
        <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-900">Manager Attention (Priority Actions)</h3>
            <button
              onClick={() => onTabChange('documents')}
              className="text-xs font-semibold text-sky-600 hover:text-sky-700 inline-flex items-center gap-1"
            >
              View all actions <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-400 font-medium border-b border-slate-100">
                  <th className="pb-2 pr-4 font-medium">Priority</th>
                  <th className="pb-2 pr-4 font-medium">Supplier</th>
                  <th className="pb-2 pr-4 font-medium">Issue</th>
                  <th className="pb-2 pr-4 font-medium">Due / Since</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                <AttentionRow priority="high" supplier="Logic Foods" issue="ISO 9001 Certificate expired" due="18 days ago" dueColor="text-rose-600" status="Overdue" statusBg="bg-rose-50 text-rose-700 border-rose-100" />
                <AttentionRow priority="high" supplier="Test Supplier" issue="2 technical approvals pending" due="2 days" dueColor="text-amber-600" status="Pending Review" statusBg="bg-amber-50 text-amber-700 border-amber-100" />
                <AttentionRow priority="medium" supplier="Manufacturing License" issue="Document expiring soon" due="12 days" dueColor="text-amber-600" status="Expiring Soon" statusBg="bg-amber-50 text-amber-700 border-amber-100" />
                <AttentionRow priority="medium" supplier="OHSAS 18001 Certificate" issue="Certificate will expire" due="27 days" dueColor="text-amber-600" status="Expiring Soon" statusBg="bg-amber-50 text-amber-700 border-amber-100" />
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
    className="text-left rounded-2xl bg-white border border-slate-200/80 shadow-sm p-5 hover:shadow-md hover:border-slate-300 transition-all group"
  >
    <div className="flex items-start gap-3">
      <div className={`p-2.5 rounded-xl ${iconBg} shrink-0`}>{icon}</div>
      <div className="min-w-0 space-y-0.5">
        <p className="text-xs font-medium text-slate-500 leading-tight">{label}</p>
        <p className="text-3xl font-bold text-slate-900 tabular-nums tracking-tight">{value}</p>
        <p className="text-[11px] text-slate-500 inline-flex items-center gap-1">
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
    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-200/70 hover:border-slate-300 hover:bg-slate-50/60 transition-all group"
  >
    <div className={`p-1.5 rounded-lg ${iconBg}`}>{icon}</div>
    <span className="text-xs font-medium text-slate-700 flex-1 text-left">{label}</span>
    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all" />
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
    priority === 'high' ? 'bg-rose-500' : priority === 'medium' ? 'bg-amber-500' : 'bg-emerald-500';
  const label = priority.charAt(0).toUpperCase() + priority.slice(1);
  return (
    <tr className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
      <td className="py-3 pr-4">
        <span className="inline-flex items-center gap-2 text-slate-700 font-medium">
          <span className={`w-2 h-2 rounded-full ${dot}`} />
          {label}
        </span>
      </td>
      <td className="py-3 pr-4 font-medium text-slate-900">{supplier}</td>
      <td className="py-3 pr-4 text-slate-600">{issue}</td>
      <td className={`py-3 pr-4 font-semibold tabular-nums ${dueColor}`}>{due}</td>
      <td className="py-3">
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border ${statusBg}`}>
          {status}
        </span>
      </td>
    </tr>
  );
};

export default BuyerOverviewDashboard;
