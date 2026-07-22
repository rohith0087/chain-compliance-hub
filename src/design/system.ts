// ============================================================================
// TraceR2C design system — the one authoritative source of shared UI classes
// for the WHOLE app (buyer + supplier).
//
// This module is intentionally a superset of the older, buyer-named
// `components/documents/buyerReviewDesignSystem.ts`: it re-exports everything
// from there (so its 27 existing importers keep working with zero changes) and
// adds the app-wide primitives that both the buyer and supplier sides need but
// that module never had. New code should import from `@/design/system`.
//
// Everything here reads from the tokens in `index.css` / `tailwind.config.ts`
// (the type scale `text-h1…text-micro`, radii `rounded-card/-control/-pill`,
// elevation `shadow-e1/-e2/-e3`, and the semantic color tokens). Nothing here
// hardcodes a hex or a raw pixel size — that's the whole point of the layer.
// ============================================================================

export * from '@/components/documents/buyerReviewDesignSystem';

// ── Surfaces ────────────────────────────────────────────────────────────────
// The standard card: rounded, hairline border, softly lifted off the canvas.
export const cardClass =
  'rounded-card border border-border bg-card shadow-e2';
// The one panel on a screen the user primarily acts on — sits a step forward
// with a whisper of accent ring, so a grid of cards doesn't read flat.
export const cardLiftedClass =
  'rounded-card border border-border/80 bg-card shadow-e3 ring-1 ring-primary/[0.07]';
// Padding companion for the above (kept separate so a card can be pad-less,
// e.g. when it wraps an edge-to-edge table).
export const cardPadClass = 'p-5';

// ── Typography roles ─────────────────────────────────────────────────────────
// Page H1. font-display pins Archivo even when rendered on a non-heading tag.
export const pageTitleClass =
  'text-h1 font-display font-bold text-foreground';
export const sectionTitleClass =
  'text-h2 font-display font-semibold text-foreground';
// The small uppercase label that heads a group ("PRIORITY QUEUE").
export const sectionLabelClass =
  'text-caption font-bold uppercase tracking-[0.06em] text-muted-foreground';
export const bodyClass = 'text-body text-foreground';
export const mutedBodyClass = 'text-body text-muted-foreground';

// ── Controls ─────────────────────────────────────────────────────────────────
// Hand-rolled input shell for the rare cases the shadcn <Input> / <SearchInput>
// primitives don't fit. Prefer those primitives first.
export const inputClass =
  'h-11 w-full rounded-control border border-input bg-card px-3 text-body ' +
  'text-foreground placeholder:text-muted-foreground shadow-e1 ' +
  'focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50';
// Generic status/label pill.
export const pillClass =
  'inline-flex items-center gap-1 rounded-pill border border-border bg-muted ' +
  'px-2.5 py-0.5 text-caption font-medium text-foreground';
// Accent-filled pill (selected / primary state).
export const pillAccentClass =
  'inline-flex items-center gap-1 rounded-pill bg-primary px-2.5 py-0.5 ' +
  'text-caption font-medium text-primary-foreground';

// ── Navigation ───────────────────────────────────────────────────────────────
// A single nav row (rail or tier-2). Idle is muted; hover lifts the surface;
// the active state is applied by the consumer via navItemActiveClass.
export const navItemClass =
  'flex items-center gap-2.5 rounded-control px-3 py-2 text-small font-medium ' +
  'text-muted-foreground transition-colors hover:bg-muted hover:text-foreground';
export const navItemActiveClass =
  'bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary';

// ── Empty state ──────────────────────────────────────────────────────────────
export const emptyStateClass =
  'flex flex-col items-center justify-center gap-2 rounded-card border border-dashed ' +
  'border-border bg-card/50 px-6 py-12 text-center text-body text-muted-foreground';

// ── Focus ring (compose onto any interactive element) ────────────────────────
export const focusRingClass =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-background';

// ── Hover affordances (named so pages stop hand-picking hover colors) ────────
export const hoverSurfaceClass = 'transition-colors hover:bg-muted';
export const hoverAccentTextClass = 'transition-colors hover:text-primary';

// ── Icon scale ───────────────────────────────────────────────────────────────
// Re-exported from buyerReviewDesignSystem: navIconClass (20), navSubIconClass
// (18), cardActionIconClass (18). Inline-with-text icons use this (16). Global
// stroke width is retuned to 1.5 in index.css.
export const inlineIconClass = 'h-4 w-4';
