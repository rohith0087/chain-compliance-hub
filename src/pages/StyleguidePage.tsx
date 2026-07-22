// ============================================================================
// TraceR2C living styleguide — the canonical reference every page is
// cross-checked against while the design system rolls out (buyer + supplier).
//
// It renders the tokens, the type scale, and every shared primitive from
// `@/design/system` in whichever theme is active. Mounted at /__test/styleguide
// (dev + test builds only; excluded from production). This file stays in the
// repo — it is the reference, not a throwaway sandbox.
// ============================================================================
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun, Search, FileText, ShieldCheck, Boxes, Bell, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchInput } from '@/components/ui/search-input';
import { Badge } from '@/components/ui/badge';
import {
  cardClass,
  cardLiftedClass,
  cardPadClass,
  pageTitleClass,
  sectionTitleClass,
  sectionLabelClass,
  bodyClass,
  mutedBodyClass,
  inputClass,
  pillClass,
  pillAccentClass,
  navItemClass,
  navItemActiveClass,
  emptyStateClass,
  navIconClass,
  inlineIconClass,
  STATUS_BADGE_CONFIG,
} from '@/design/system';

const TYPE_SCALE: { key: string; cls: string; note: string }[] = [
  { key: 'display', cls: 'text-display font-display font-bold', note: '32 · page hero figure' },
  { key: 'h1', cls: 'text-h1 font-display font-bold', note: '24 · page title' },
  { key: 'h2', cls: 'text-h2 font-display font-semibold', note: '20 · section title' },
  { key: 'h3', cls: 'text-h3 font-semibold', note: '16 · card / group title' },
  { key: 'body', cls: 'text-body', note: '14 · default body' },
  { key: 'small', cls: 'text-small', note: '13 · secondary text' },
  { key: 'caption', cls: 'text-caption', note: '12 · labels, meta' },
  { key: 'micro', cls: 'text-micro', note: '11 · dense chrome' },
];

const TOKEN_SWATCHES: { name: string; cls: string; fg?: string }[] = [
  { name: 'background', cls: 'bg-background', fg: 'text-foreground' },
  { name: 'card', cls: 'bg-card', fg: 'text-card-foreground' },
  { name: 'muted', cls: 'bg-muted', fg: 'text-muted-foreground' },
  { name: 'primary', cls: 'bg-primary', fg: 'text-primary-foreground' },
  { name: 'secondary', cls: 'bg-secondary', fg: 'text-secondary-foreground' },
  { name: 'success', cls: 'bg-success', fg: 'text-success-foreground' },
  { name: 'warning', cls: 'bg-warning', fg: 'text-warning-foreground' },
  { name: 'danger', cls: 'bg-danger', fg: 'text-danger-foreground' },
];

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className={sectionLabelClass}>{label}</h2>
      {children}
    </section>
  );
}

export default function StyleguidePage() {
  const { resolvedTheme, setTheme } = useTheme();
  // next-themes returns undefined for resolvedTheme until mounted; acting on
  // that stale value makes the toggle no-op on the first click. Gate on mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === 'dark';
  const [search, setSearch] = useState('');

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-6 py-10 space-y-12">
        {/* Header */}
        <header className="flex items-end justify-between gap-4">
          <div className="space-y-1">
            <p className={sectionLabelClass}>TraceR2C</p>
            <h1 className={pageTitleClass}>Design system</h1>
            <p className={mutedBodyClass}>One default for the buyer + supplier app — tokens, type, and primitives.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setTheme(isDark ? 'light' : 'dark')}>
            {isDark ? <Sun className={inlineIconClass} /> : <Moon className={inlineIconClass} />}
            {isDark ? 'Light' : 'Dark'}
          </Button>
        </header>

        {/* Color tokens */}
        <Section label="Color tokens">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {TOKEN_SWATCHES.map((s) => (
              <div key={s.name} className={`${cardClass} overflow-hidden`}>
                <div className={`${s.cls} ${s.fg ?? ''} flex h-16 items-center justify-center text-caption font-medium`}>
                  Aa
                </div>
                <div className="px-3 py-2 text-caption text-muted-foreground">{s.name}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* Type scale */}
        <Section label="Type scale">
          <div className={`${cardClass} ${cardPadClass} space-y-4`}>
            {TYPE_SCALE.map((t) => (
              <div key={t.key} className="flex items-baseline justify-between gap-6 border-b border-border pb-3 last:border-0 last:pb-0">
                <span className={`${t.cls} text-foreground`}>The quick brown fox</span>
                <span className="shrink-0 text-caption text-muted-foreground">
                  <code className="font-mono">text-{t.key}</code> · {t.note}
                </span>
              </div>
            ))}
            <p className="pt-2 text-caption text-muted-foreground">
              Data / IDs use <span className="font-mono text-foreground">font-mono</span>:{' '}
              <span className="font-mono text-foreground">DOC-2026-00184</span>
            </p>
          </div>
        </Section>

        {/* Radii + elevation */}
        <Section label="Radii + elevation">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {[
              { label: 'rounded-control (12)', cls: 'rounded-control' },
              { label: 'rounded-card (16)', cls: 'rounded-card' },
              { label: 'rounded-pill', cls: 'rounded-pill' },
            ].map((r) => (
              <div key={r.cls} className={`${r.cls} border border-border bg-card p-4 text-caption text-muted-foreground shadow-e2`}>
                {r.label}
              </div>
            ))}
            {[
              { label: 'shadow-e1 · rests', cls: 'shadow-e1' },
              { label: 'shadow-e2 · standard card', cls: 'shadow-e2' },
              { label: 'shadow-e3 · action panel', cls: 'shadow-e3' },
            ].map((e) => (
              <div key={e.cls} className={`rounded-card border border-border bg-card p-4 text-caption text-muted-foreground ${e.cls}`}>
                {e.label}
              </div>
            ))}
          </div>
        </Section>

        {/* Cards */}
        <Section label="Cards">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className={`${cardClass} ${cardPadClass} space-y-1`}>
              <h3 className="text-h3 font-semibold text-foreground">Standard card</h3>
              <p className={mutedBodyClass}>cardClass — hairline border, soft e2 lift. The default surface.</p>
            </div>
            <div className={`${cardLiftedClass} ${cardPadClass} space-y-1`}>
              <h3 className="text-h3 font-semibold text-foreground">Lifted card</h3>
              <p className={mutedBodyClass}>cardLiftedClass — e3 + accent ring, for the panel the user acts on.</p>
            </div>
          </div>
        </Section>

        {/* Buttons */}
        <Section label="Buttons">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button size="sm"><Plus className={inlineIconClass} /> Small</Button>
            <Button disabled>Disabled</Button>
          </div>
        </Section>

        {/* Inputs */}
        <Section label="Inputs">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <p className={sectionLabelClass}>SearchInput (primitive)</p>
              <SearchInput value={search} onValueChange={setSearch} placeholder="Search suppliers…" />
            </div>
            <div className="space-y-2">
              <p className={sectionLabelClass}>Input (shadcn)</p>
              <Input placeholder="you@company.com" />
            </div>
            <div className="space-y-2">
              <p className={sectionLabelClass}>inputClass (hand-rolled fallback)</p>
              <input className={inputClass} placeholder="Only when the primitives don't fit" />
            </div>
          </div>
        </Section>

        {/* Nav items */}
        <Section label="Navigation">
          <div className={`${cardClass} max-w-xs p-2`}>
            {[
              { icon: FileText, label: 'Documents', active: true },
              { icon: ShieldCheck, label: 'Compliance', active: false },
              { icon: Boxes, label: 'Suppliers', active: false },
              { icon: Bell, label: 'Notifications', active: false },
            ].map((n) => {
              const Icon = n.icon;
              return (
                <div key={n.label} className={`${navItemClass} ${n.active ? navItemActiveClass : ''}`}>
                  <Icon className={navIconClass} />
                  {n.label}
                </div>
              );
            })}
          </div>
        </Section>

        {/* Pills + status badges */}
        <Section label="Pills + status">
          <div className="flex flex-wrap items-center gap-2">
            <span className={pillClass}><Search className="h-3 w-3" /> Neutral pill</span>
            <span className={pillAccentClass}>Selected</span>
            <Badge>Badge</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {Object.entries(STATUS_BADGE_CONFIG).map(([key, cfg]) => {
              const Icon = cfg.icon;
              return (
                <span key={key} className={`inline-flex items-center gap-1 rounded-pill border px-2.5 py-0.5 text-caption font-medium ${cfg.className}`}>
                  <Icon className="h-3 w-3" /> {cfg.label}
                </span>
              );
            })}
          </div>
        </Section>

        {/* Empty state */}
        <Section label="Empty state">
          <div className={emptyStateClass}>
            <FileText className="h-6 w-6 text-muted-foreground" />
            No documents yet — uploads and email replies will land here.
          </div>
        </Section>

        <p className={`${bodyClass} text-center text-muted-foreground`}>End of styleguide.</p>
      </div>
    </div>
  );
}
