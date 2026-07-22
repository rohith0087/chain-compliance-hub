import { useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Plus, Sparkles, UserPlus } from 'lucide-react';

interface BentoOverviewDashboardProps {
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

/* ------------------------------------------------------------------ */
/* Soft-brutalist bento overview.                                      */
/* Palette: charcoal ink, deep forest, warm stone, muted sage, amber.  */
/* One viewport, no scrolling. Every number is a real stat; every card */
/* is a door into the page that owns it.                               */
/* ------------------------------------------------------------------ */

const INK = '#191C19';
const DISPLAY = { fontFamily: "'Archivo', 'IBM Plex Sans', system-ui, sans-serif" } as const;

// Signature texture: thin diagonal stripes used in meters and accents.
const STRIPES =
  'repeating-linear-gradient(-45deg, transparent 0 5px, rgba(25,28,25,0.16) 5px 7px)';
const STRIPES_LIGHT =
  'repeating-linear-gradient(-45deg, transparent 0 5px, rgba(251,250,246,0.22) 5px 7px)';

function Card({
  className = '',
  onClick,
  children,
}: {
  className?: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const interactive = Boolean(onClick);
  return (
    <div
      onClick={onClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive ? (e) => { if (e.key === 'Enter') onClick?.(); } : undefined}
      className={`relative overflow-hidden rounded-[22px] border-[1.5px] border-[#191C19]/[0.16] dark:border-white/[0.14] transition-all duration-150 ${
        interactive
          ? 'cursor-pointer hover:-translate-y-[2px] hover:shadow-[5px_6px_0_0_rgba(25,28,25,0.16)] dark:hover:shadow-[5px_6px_0_0_rgba(0,0,0,0.5)]'
          : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}

function Micro({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`text-[10.5px] font-bold uppercase tracking-[0.16em] ${className}`} style={DISPLAY}>
      {children}
    </p>
  );
}

function CornerArrow({ dark = false }: { dark?: boolean }) {
  return (
    <span
      className={`absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full border-[1.5px] ${
        dark ? 'border-white/25 text-white/80' : 'border-[#191C19]/20 text-[#191C19]/70 dark:border-white/20 dark:text-white/70'
      }`}
    >
      <ArrowUpRight className="h-3.5 w-3.5" />
    </span>
  );
}

export const BentoOverviewDashboard = ({
  stats,
  onTabChange,
  onNewRequest,
  onAddSupplier,
}: BentoOverviewDashboardProps) => {
  const navigate = useNavigate();
  const score = stats.totalDocs > 0 ? Math.round((stats.approvedDocs / stats.totalDocs) * 100) : 0;
  const openReqs = Math.max(stats.totalDocs - stats.approvedDocs - stats.pendingReview, 0);
  const mixMax = Math.max(stats.approvedDocs, stats.pendingReview, openReqs, 1);
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const nextActions = [
    stats.pendingReview > 0 && {
      label: `Review ${stats.pendingReview} submitted document${stats.pendingReview > 1 ? 's' : ''}`,
      cta: 'Review',
      tab: 'documents',
      tone: 'amber' as const,
    },
    stats.expiringSoon > 0 && {
      label: `${stats.expiringSoon} document${stats.expiringSoon > 1 ? 's' : ''} expiring within 30 days`,
      cta: 'Renew',
      tab: 'documents',
      tone: 'amber' as const,
    },
    stats.onboardingCount > 0 && {
      label: `${stats.onboardingCount} supplier${stats.onboardingCount > 1 ? 's' : ''} waiting in onboarding`,
      cta: 'Advance',
      tab: 'onboarding',
      tone: 'sage' as const,
    },
  ].filter(Boolean) as { label: string; cta: string; tab: string; tone: 'amber' | 'sage' }[];

  return (
    <div
      className="grid h-[calc(100vh-114px)] min-h-[560px] grid-cols-12 grid-rows-6 gap-3 text-[#191C19] dark:text-zinc-100"
      style={DISPLAY}
    >
      {/* ---- A · Compliance pulse (hero) ---- */}
      <Card
        className="col-span-4 row-span-4 bg-[#16382C] text-[#F4F1E8]"
        onClick={() => onTabChange('compliance')}
      >
        {/* ring texture */}
        <div className="pointer-events-none absolute -bottom-16 -right-16 h-56 w-56 rounded-full border-[1.5px] border-white/10" />
        <div className="pointer-events-none absolute -bottom-8 -right-8 h-36 w-36 rounded-full border-[1.5px] border-[#D9952B]/30" />
        <div className="flex h-full flex-col p-6">
          <div className="flex items-start justify-between">
            <div>
              <Micro className="text-[#A9C3B4]">Compliance pulse</Micro>
              <p className="mt-0.5 text-[11px] text-white/50">{today}</p>
            </div>
            <CornerArrow dark />
          </div>
          <div className="mt-auto">
            <p className="text-[clamp(4rem,9vh,6.5rem)] font-black leading-[0.95] tracking-tighter tabular-nums">
              {score}
              <span className="text-[0.4em] font-bold text-[#A9C3B4]">%</span>
            </p>
            <p className="mt-1 text-[13px] text-white/70">
              {stats.approvedDocs} of {stats.totalDocs} requests fully approved
            </p>
            {/* striped meter */}
            <div className="mt-4 h-4 w-full overflow-hidden rounded-full border-[1.5px] border-white/20 bg-white/5">
              <div
                className="h-full rounded-full bg-[#D9952B]"
                style={{ width: `${Math.max(score, 3)}%`, backgroundImage: STRIPES_LIGHT }}
              />
            </div>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border-[1.5px] border-white/25 px-3.5 py-1.5 text-[12px] font-semibold">
              Open Command Center <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </div>
        </div>
      </Card>

      {/* ---- B · Suppliers ---- */}
      <Card
        className="col-span-3 row-span-2 bg-[#FBFAF6] dark:bg-[#1E221E]"
        onClick={() => onTabChange('suppliers')}
      >
        <div className="flex h-full flex-col justify-between p-5">
          <Micro className="text-[#191C19]/55 dark:text-zinc-400">Suppliers connected</Micro>
          <div>
            <p className="text-[clamp(2.2rem,5.2vh,3.4rem)] font-black leading-none tracking-tight tabular-nums">
              {stats.connectedSuppliers}
            </p>
            <p className="mt-1 text-[12px] text-[#191C19]/55 dark:text-zinc-400">across your network</p>
          </div>
        </div>
        <CornerArrow />
      </Card>

      {/* ---- C · Pending review ---- */}
      <Card
        className="col-span-3 row-span-2 bg-[#DFE7DA] dark:bg-[#26302A]"
        onClick={() => onTabChange('documents')}
      >
        <div className="flex h-full flex-col justify-between p-5">
          <Micro className="text-[#2C4437]/70 dark:text-[#A9C3B4]">Awaiting your review</Micro>
          <div>
            <p className="text-[clamp(2.2rem,5.2vh,3.4rem)] font-black leading-none tracking-tight tabular-nums">
              {stats.pendingReview}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-[12px] text-[#2C4437]/70 dark:text-[#A9C3B4]">
              {stats.pendingReview > 0 && <span className="h-2 w-2 rounded-full bg-[#D9952B]" />}
              {stats.pendingReview > 0 ? 'supplier submissions in queue' : 'queue is clear'}
            </p>
          </div>
        </div>
        <CornerArrow />
      </Card>

      {/* ---- D · Expiring ---- */}
      <Card
        className="col-span-2 row-span-2 bg-[#F2E3C4] dark:bg-[#3A2F1B]"
        onClick={() => onTabChange('documents')}
      >
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-3"
          style={{ backgroundImage: STRIPES }}
        />
        <div className="flex h-full flex-col justify-between p-5">
          <Micro className="text-[#7A5A18] dark:text-[#E4BD72]">Expiring ≤ 30d</Micro>
          <div>
            <p className="text-[clamp(2.2rem,5.2vh,3.4rem)] font-black leading-none tracking-tight tabular-nums">
              {stats.expiringSoon}
            </p>
            <p className="mt-1 text-[12px] text-[#7A5A18]/80 dark:text-[#E4BD72]/80">renewals to chase</p>
          </div>
        </div>
        <CornerArrow />
      </Card>

      {/* ---- E · Request pipeline ---- */}
      <Card className="col-span-4 row-span-2 bg-[#FBFAF6] dark:bg-[#1E221E]" onClick={() => onTabChange('requests')}>
        <div className="flex h-full flex-col p-5">
          <Micro className="text-[#191C19]/55 dark:text-zinc-400">Request pipeline · live mix</Micro>
          <div className="mt-auto space-y-2.5">
            {[
              { label: 'Approved', v: stats.approvedDocs, fill: '#16382C', striped: false },
              { label: 'In review', v: stats.pendingReview, fill: '#D9952B', striped: true },
              { label: 'Open', v: openReqs, fill: '#C9CFC5', striped: true },
            ].map((r) => (
              <div key={r.label} className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-[11px] font-bold uppercase tracking-wide text-[#191C19]/55 dark:text-zinc-400">
                  {r.label}
                </span>
                <div className="h-5 flex-1 overflow-hidden rounded-md border-[1.5px] border-[#191C19]/12 dark:border-white/10 bg-transparent">
                  <div
                    className="h-full"
                    style={{
                      width: `${Math.max((r.v / mixMax) * 100, r.v > 0 ? 6 : 0)}%`,
                      backgroundColor: r.fill,
                      backgroundImage: r.striped ? STRIPES : undefined,
                    }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-[15px] font-black tabular-nums">{r.v}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* ---- F · Onboarding ---- */}
      <Card className="col-span-2 row-span-2 bg-[#FBFAF6] dark:bg-[#1E221E]" onClick={() => onTabChange('onboarding')}>
        <div className="flex h-full flex-col justify-between p-5">
          <Micro className="text-[#191C19]/55 dark:text-zinc-400">In onboarding</Micro>
          <div>
            <p className="text-[clamp(2.2rem,5.2vh,3.4rem)] font-black leading-none tracking-tight tabular-nums">
              {stats.onboardingCount}
            </p>
            <p className="mt-1 text-[12px] text-[#191C19]/55 dark:text-zinc-400">pipeline stage</p>
          </div>
        </div>
        <CornerArrow />
      </Card>

      {/* ---- G · Approved docs (charcoal) ---- */}
      <Card className="col-span-2 row-span-2 bg-[#191C19] text-[#F4F1E8]" onClick={() => onTabChange('documents')}>
        <div className="flex h-full flex-col justify-between p-5">
          <Micro className="text-white/45">Docs approved</Micro>
          <div>
            <p className="text-[clamp(2.2rem,5.2vh,3.4rem)] font-black leading-none tracking-tight tabular-nums text-[#DFE7DA]">
              {stats.approvedDocs}
            </p>
            <p className="mt-1 text-[12px] text-white/50">verified evidence on file</p>
          </div>
        </div>
        <CornerArrow dark />
      </Card>

      {/* ---- H · Quick actions ---- */}
      <Card className="col-span-4 row-span-2 bg-[#191C19] text-[#F4F1E8]">
        <div className="flex h-full flex-col p-5">
          <Micro className="text-white/45">Quick actions</Micro>
          <div className="mt-auto grid grid-cols-3 gap-2.5">
            <button
              onClick={onNewRequest}
              className="flex h-[52px] flex-col items-center justify-center gap-0.5 rounded-[14px] bg-[#D9952B] text-[11.5px] font-bold text-[#191C19] transition-transform hover:-translate-y-[2px]"
              style={DISPLAY}
            >
              <Plus className="h-4 w-4" /> New request
            </button>
            <button
              onClick={onAddSupplier}
              className="flex h-[52px] flex-col items-center justify-center gap-0.5 rounded-[14px] border-[1.5px] border-white/30 text-[11.5px] font-bold transition-transform hover:-translate-y-[2px]"
              style={DISPLAY}
            >
              <UserPlus className="h-4 w-4" /> Add supplier
            </button>
            <button
              onClick={() => navigate('/chat')}
              className="flex h-[52px] flex-col items-center justify-center gap-0.5 rounded-[14px] bg-[#DFE7DA] text-[11.5px] font-bold text-[#16382C] transition-transform hover:-translate-y-[2px]"
              style={DISPLAY}
            >
              <Sparkles className="h-4 w-4" /> Ask AI
            </button>
          </div>
        </div>
      </Card>

      {/* ---- I · Do these next ---- */}
      <Card className="col-span-5 row-span-2 bg-[#FBFAF6] dark:bg-[#1E221E]">
        <div className="flex h-full flex-col p-5">
          <Micro className="text-[#191C19]/55 dark:text-zinc-400">Do these next</Micro>
          <div className="mt-3 flex flex-1 flex-col justify-center gap-2">
            {nextActions.length === 0 ? (
              <p className="text-[13px] text-[#191C19]/55 dark:text-zinc-400">
                All clear — nothing needs your attention right now.
              </p>
            ) : (
              nextActions.slice(0, 3).map((a) => (
                <div
                  key={a.label}
                  className="flex items-center justify-between gap-3 rounded-[12px] border-[1.5px] border-[#191C19]/12 dark:border-white/10 px-3 py-1.5"
                >
                  <span className="flex min-w-0 items-center gap-2 text-[12.5px] font-semibold">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${a.tone === 'amber' ? 'bg-[#D9952B]' : 'bg-[#5F7F6C]'}`}
                    />
                    <span className="truncate">{a.label}</span>
                  </span>
                  <button
                    onClick={() => onTabChange(a.tab)}
                    className="shrink-0 rounded-full border-[1.5px] border-[#191C19]/25 dark:border-white/25 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wide hover:bg-[#191C19] hover:text-[#F4F1E8] dark:hover:bg-white dark:hover:text-[#191C19] transition-colors"
                  >
                    {a.cta}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </Card>

      {/* ---- J · AI briefing ---- */}
      <Card className="col-span-3 row-span-2 bg-[#DFE7DA] dark:bg-[#26302A]" onClick={() => navigate('/chat')}>
        <div className="flex h-full flex-col p-5">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-[#2C4437] dark:text-[#A9C3B4]" />
            <Micro className="text-[#2C4437]/80 dark:text-[#A9C3B4]">AI briefing</Micro>
          </div>
          <p className="mt-2 flex-1 text-[12.5px] leading-relaxed text-[#22352B] dark:text-zinc-200">
            Compliance sits at <strong>{score}%</strong>.{' '}
            {stats.expiringSoon > 0
              ? `Renewing ${stats.expiringSoon} expiring document${stats.expiringSoon > 1 ? 's' : ''} is the fastest lift.`
              : stats.pendingReview > 0
                ? `Clearing ${stats.pendingReview} review${stats.pendingReview > 1 ? 's' : ''} is the fastest lift.`
                : 'Network is steady — a good moment to activate another framework.'}
          </p>
          <p className="mt-1 flex items-center gap-1 text-[11.5px] font-bold text-[#2C4437] dark:text-[#A9C3B4]">
            Open the assistant <ArrowRight className="h-3 w-3" />
          </p>
        </div>
      </Card>
    </div>
  );
};
