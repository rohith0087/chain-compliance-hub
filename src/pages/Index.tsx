import { useEffect, useRef, useState, useLayoutEffect } from 'react';
import {
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(ScrollTrigger, SplitText);

/* ============================================================================
 * TraceR2C — marketing landing
 * Brand: "System of record". Cool steel + charcoal-navy + deep pine green.
 * Type: Archivo Expanded (display) / IBM Plex Sans (body) / IBM Plex Mono (data).
 *       Instrument Serif is used for the wordmark ONLY (brand equity).
 * Accent rule: Deep pine green = the verified stamp, CTAs, brand moments. 
 * Status spectrum: verified (pine green), caution (amber), ALERT/RECALL (vermilion/orange).
 * Signature: an evidence card where a raw certificate resolves field-by-field
 * into validated data, then a VERIFIED customs stamp presses into the manifest.
 * All styling is scoped under `.r2c` (see index.css).
 * ========================================================================== */

const EASE = [0.22, 1, 0.36, 1] as const;

/* ------------------------------- primitives ------------------------------- */

const Reveal = ({
  children,
  delay = 0,
  y = 18,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) => {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={reduce ? { duration: 0 } : { duration: 0.6, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
};

/* Masked line reveal — text slides up from behind a clip. CSS-driven via an
   IntersectionObserver so it always settles to its final, visible position
   (a JS rAF tween can freeze off-screen if the tab is backgrounded mid-scroll). */
const ClipReveal = ({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -80px 0px', threshold: 0.01 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <span ref={ref} className={`r2c-rise ${inView ? 'is-in' : ''}`}>
      <span className={className} style={{ ['--rise-delay' as string]: `${delay}s` } as React.CSSProperties}>
        {children}
      </span>
    </span>
  );
};

const PrimaryButton = ({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) => (
  <button
    onClick={onClick}
    className="group inline-flex items-center gap-2 rounded-full bg-[var(--r2c-stamp)] px-6 py-3.5 text-[15px] font-medium text-white transition-all duration-200 hover:bg-[var(--r2c-stamp-deep)] active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--r2c-ink)]"
  >
    {children}
    <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
  </button>
);

const GhostButton = ({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) => (
  <button
    onClick={onClick}
    className="inline-flex items-center gap-2 rounded-full border border-[var(--r2c-ink)]/20 px-6 py-3.5 text-[15px] font-medium text-[var(--r2c-ink)] transition-colors duration-200 hover:border-[var(--r2c-ink)]/50 hover:bg-[var(--r2c-ink)]/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--r2c-ink)]"
  >
    {children}
  </button>
);

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <p className="font-data text-[12px] font-medium uppercase tracking-[0.18em] text-[var(--r2c-stamp)]">
    {children}
  </p>
);

const Wordmark = ({ size = 24 }: { size?: number }) => (
  <span className="flex items-center gap-3">
    <img src="/logo.png" alt="TraceR2C Logo" className="object-contain" style={{ width: size * 1.6, height: size * 1.6 }} />
    <span className="flex items-baseline gap-2">
      <span className="font-serif leading-none" style={{ fontSize: size }}>
        TraceR2C
      </span>
      <span className="hidden font-data text-[10px] uppercase tracking-[0.2em] text-[var(--r2c-muted)] sm:inline">
        / compliance OS
      </span>
    </span>
  </span>
);

/* ----------------------------- count-up hook ------------------------------ */

function useCountUp(target: number, active: boolean, reduce: boolean, delay = 0, dur = 900) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (reduce) {
      setVal(target);
      return;
    }
    if (!active) {
      setVal(0);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const e = Math.max(0, (now - start - delay) / dur);
      const p = Math.min(1, e);
      setVal(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active, reduce, delay, dur]);
  return val;
}

/* ------------------------- SIGNATURE: evidence card ----------------------- */

const FIELDS = [
  { k: 'STANDARD', v: 'ISO 9001:2015' },
  { k: 'FACILITY', v: 'Auburn Mfg · GLN 0614141000012' },
  { k: 'LABORATORY', v: 'Intertek · Lab #1187' },
  { k: 'ISSUED', v: '2025-01-04' },
  { k: 'EXPIRES', v: '2028-01-03' },
  { k: 'CERTIFICATE', v: 'ABC-123-99' },
];
const FIELD_START = 0.5;
const FIELD_STAGGER = 0.12;
const STAMP_DELAY = FIELD_START + FIELDS.length * FIELD_STAGGER + 0.15;

const EvidenceCard = () => {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.5 });
  const active = inView || !!reduce;
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    if (inView) setRunId((n) => n + 1);
  }, [inView]);

  const conf = useCountUp(0.98, active, !!reduce, FIELD_START * 1000 + 200, 900);

  return (
    <div
      ref={ref}
      className="relative w-full overflow-hidden rounded-[18px] border-2 border-[var(--r2c-line)] bg-[var(--r2c-surface)] shadow-[0_16px_32px_-12px_rgba(20,24,31,0.5)]"
    >
      {/* manifest header */}
      <div className="flex items-center justify-between border-b border-[var(--r2c-line)] bg-[var(--r2c-surface-2)] px-5 py-3">
        <span className="font-data text-[12px] text-[var(--r2c-muted)]">ISO_9001_AuburnPlant.pdf</span>
        <motion.span
          className="font-data text-[11px] font-medium uppercase tracking-widest"
          animate={{ color: active ? 'var(--r2c-verified)' : 'var(--r2c-muted)' }}
          transition={reduce ? { duration: 0 } : { delay: STAMP_DELAY, duration: 0.3 }}
        >
          {active ? '● validated' : '○ reading'}
        </motion.span>
      </div>

      <div className="relative px-5 pb-6 pt-5">
        {/* scan beam (restarts each time it re-enters view) */}
        {!reduce && active && (
          <div
            key={runId}
            aria-hidden
            className="r2c-scan pointer-events-none absolute inset-x-0 top-0 z-10 h-16"
            style={{
              background:
                'linear-gradient(to bottom, rgba(22,73,58,0) 0%, rgba(22,73,58,0.18) 50%, rgba(22,73,58,0) 100%)',
              borderTop: '1px solid rgba(22,73,58,0.5)',
            }}
          />
        )}

        {/* raw document skeleton — fades as evidence resolves */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-x-5 top-5 space-y-3"
          initial={reduce ? false : { opacity: 0.9 }}
          animate={{ opacity: active ? 0.08 : 0.9 }}
          transition={reduce ? { duration: 0 } : { delay: FIELD_START, duration: 0.6, ease: EASE }}
        >
          {[92, 76, 84, 60, 88, 70].map((w, i) => (
            <div key={i} className="h-3 rounded bg-[var(--r2c-muted)]" style={{ width: `${w}%` }} />
          ))}
        </motion.div>

        {/* resolved evidence fields */}
        <div className="relative space-y-2.5">
          {FIELDS.map((f, i) => (
            <motion.div
              key={f.k}
              className="flex items-baseline justify-between gap-4 border-b border-dashed border-[var(--r2c-line)] pb-2.5"
              initial={reduce ? false : { opacity: 0, y: 10, filter: 'blur(6px)' }}
              animate={
                active
                  ? { opacity: 1, y: 0, filter: 'blur(0px)' }
                  : { opacity: 0, y: 10, filter: 'blur(6px)' }
              }
              transition={reduce ? { duration: 0 } : { delay: FIELD_START + i * FIELD_STAGGER, duration: 0.4, ease: EASE }}
            >
              <span className="font-data text-[11px] uppercase tracking-wider text-[var(--r2c-muted)]">
                {f.k}
              </span>
              <span className="font-data text-right text-[13px] font-medium text-[var(--r2c-ink)]">
                {f.v}
              </span>
            </motion.div>
          ))}
        </div>

        {/* confidence + match line — left-aligned so the stamp lands in clear space */}
        <motion.div
          className="mt-4 flex max-w-[60%] flex-col gap-1"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: active ? 1 : 0 }}
          transition={reduce ? { duration: 0 } : { delay: STAMP_DELAY - 0.1, duration: 0.4 }}
        >
          <span className="font-data text-[12px] text-[var(--r2c-ink)]">
            confidence <span className="font-semibold">{conf.toFixed(2)}</span>
          </span>
          <span className="font-data text-[11px] text-[var(--r2c-muted)]">
            matched · SKU 4471 · lot R-2207
          </span>
        </motion.div>

        {/* VERIFIED customs stamp pressing into the manifest */}
        <motion.div
          aria-label="Verified"
          className="pointer-events-none absolute bottom-5 right-5 select-none"
          style={{ mixBlendMode: 'multiply' }}
          initial={reduce ? false : { opacity: 0, scale: 1.7, rotate: -18 }}
          animate={active ? { opacity: 1, scale: 1, rotate: -7 } : { opacity: 0, scale: 1.7, rotate: -18 }}
          transition={
            reduce
              ? { duration: 0 }
              : { type: 'spring', stiffness: 380, damping: 14, delay: STAMP_DELAY }
          }
        >
          <div className="relative flex h-[92px] w-[92px] items-center justify-center rounded-full border-[2.5px] border-[var(--r2c-stamp)]">
            <div className="absolute inset-[5px] rounded-full border border-dashed border-[var(--r2c-stamp)]/70" />
            <div className="text-center leading-none">
              <div className="font-display text-[15px] font-bold uppercase tracking-tight text-[var(--r2c-stamp)]">
                Verified
              </div>
              <div className="mt-1 font-data text-[8px] uppercase tracking-[0.15em] text-[var(--r2c-stamp)]/80">
                No. R2C-0419
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

/* ----------------------- supporting: traceability strip ------------------- */
/* Scroll-scrubbed: nodes light up and connectors fill as you move through it. */

const CHAIN = ['Requirement', 'Supplier', 'Facility', 'Product', 'Evidence', 'Decision'];

const ChainNode = ({
  node,
  i,
  n,
  progress,
  reduce,
  last,
  connector,
}: {
  node: string;
  i: number;
  n: number;
  progress: MotionValue<number>;
  reduce: boolean;
  last: boolean;
  connector: boolean;
}) => {
  const a = i / n;
  const opacity = useTransform(progress, [a, a + 0.12], [0, 1]);
  const y = useTransform(progress, [a, a + 0.12], [16, 0]);
  const fill = useTransform(progress, [a + 0.06, a + 0.2], [0, 1]);

  return (
    <div className="flex items-center gap-2">
      <motion.span
        style={reduce ? undefined : { opacity, y }}
        className={`whitespace-nowrap rounded-[7px] border px-3.5 py-2 font-data text-[12px] uppercase tracking-wider ${
          last
            ? 'border-[var(--r2c-stamp)] bg-[var(--r2c-stamp)]/[0.06] text-[var(--r2c-stamp)]'
            : 'border-[var(--r2c-line)] bg-[var(--r2c-surface)] text-[var(--r2c-ink)]'
        }`}
      >
        {node}
      </motion.span>
      {connector && (
        <span className="relative block h-px w-6 bg-[var(--r2c-line)]">
          <motion.span
            className="absolute inset-0 origin-left bg-[var(--r2c-muted)]"
            style={reduce ? { scaleX: 1 } : { scaleX: fill }}
          />
        </span>
      )}
    </div>
  );
};

const TraceStrip = () => {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.9', 'end 0.6'] });

  return (
    <div ref={ref} className="flex flex-wrap items-center gap-x-2 gap-y-4">
      {CHAIN.map((node, i) => (
        <ChainNode
          key={node}
          node={node}
          i={i}
          n={CHAIN.length}
          progress={scrollYProgress}
          reduce={!!reduce}
          last={i === CHAIN.length - 1}
          connector={i < CHAIN.length - 1}
        />
      ))}
    </div>
  );
};

/* --------------------------------- data ----------------------------------- */

/* Evidence Engine is the feature; the rest read as a spec list beside it. */
const ENGINES = [
  { label: 'REQUIREMENT ENGINE', title: 'Knows what applies', body: 'Versioned rules decide which requirements a product, facility, or supplier must meet — by category and jurisdiction.' },
  { label: 'DECISION ENGINE', title: 'Status is computed', body: 'Compliance is calculated and explainable, never hand-flagged — each decision links to its evidence and rule version.' },
  { label: 'SUPPLIER NETWORK', title: 'One passport, many buyers', body: 'Suppliers maintain evidence once and share it with every authorized buyer — no re-uploading the same certificate ten times.' },
  { label: 'RECALL COMMAND', title: 'Recall by lot, not by guess', body: 'When something goes wrong, trace affected lots and facilities in minutes and notify exactly who is impacted.', accent: true },
  { label: 'REGULATORY OUTPUT', title: 'Audit-ready in one export', body: 'Turn verified evidence into CPSC eFiling data, customer compliance packs, and regulator submissions on demand.' },
];

const SOLUTIONS = [
  { tag: 'CPSC eFILING', name: 'Consumer products' },
  { tag: 'PRODUCT & COMPONENT', name: 'Manufacturing' },
  { tag: 'RESPONSIBLE SOURCING', name: 'Retail & private label' },
  { tag: 'MARKET ACCESS', name: 'Importers' },
  { tag: 'SUPPLIER SAFETY', name: 'Food' },
  { tag: 'GPSR · DPP', name: 'EU expansion' },
];

/* ------------------------- HERO: barcode side panel ----------------------- */

const BARCODE_ROWS = 38;
// deterministic pseudo-random bar pattern (no flicker across renders)
const seededBars = (side: 'left' | 'right') => {
  const rng = (seed: number) => {
    let s = seed;
    return () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  };
  const r = rng(side === 'left' ? 17 : 91);
  return Array.from({ length: BARCODE_ROWS }, () => {
    // 1–3 bars per row, each with x-offset and width
    const segs = 1 + Math.floor(r() * 3);
    return Array.from({ length: segs }, () => ({
      x: Math.floor(r() * 70),
      w: 6 + Math.floor(r() * 60),
    }));
  });
};

const BarcodePanel = ({ side }: { side: 'left' | 'right' }) => {
  const reduce = useReducedMotion();
  const rows = seededBars(side);
  const maskId = `r2c-barcode-mask-${side}`;
  return (
    <motion.div
      aria-hidden
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 0.55 }}
      transition={reduce ? { duration: 0 } : { delay: 0.5, duration: 1.0, ease: EASE }}
      className="pointer-events-none absolute bottom-0 hidden h-[62%] w-[min(26vw,300px)] lg:block"
      style={{ [side]: 0 } as React.CSSProperties}
    >
      <svg viewBox="0 0 100 224" preserveAspectRatio="none" className="h-full w-full">
        <defs>
          <linearGradient id={maskId} x1={side === 'left' ? '0%' : '100%'} y1="0%" x2={side === 'left' ? '100%' : '0%'} y2="0%">
            <stop offset="0%" stopColor="white" stopOpacity="0.9" />
            <stop offset="60%" stopColor="white" stopOpacity="0.45" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <mask id={`${maskId}-m`}>
            <rect width="100" height="224" fill={`url(#${maskId})`} />
          </mask>
        </defs>
        <g mask={`url(#${maskId}-m)`} fill="var(--r2c-stamp)">
          {rows.flatMap((segs, i) =>
            segs.map((s, j) => (
              <rect
                key={`${i}-${j}`}
                x={s.x}
                y={i * 4 + 0.4}
                width={s.w}
                height={1.2}
                rx={0.4}
              />
            )),
          )}
        </g>
      </svg>
    </motion.div>
  );
};


/* ------------------------- HERO: supplier app mockup ---------------------- */

type Status = 'verified' | 'pending' | 'expired';
const SUPPLIER_ROWS: Array<{
  name: string;
  initial: string;
  dot: string;
  cert: string;
  standard: string;
  expires: string;
  auditor: string;
  status: Status;
}> = [
  { name: 'Auburn Foods',     initial: 'A', dot: '#16493A', cert: 'ISO22000_AuburnPlant.pdf',  standard: 'ISO 22000',  expires: '2027-04-12', auditor: 'Intertek',   status: 'verified' },
  { name: 'Pacific Mills',    initial: 'P', dot: '#0F4C4A', cert: 'BRCGS_Pacific_v9.pdf',      standard: 'BRCGS v9',   expires: '2026-11-03', auditor: 'SGS',        status: 'verified' },
  { name: 'Granaria Co',      initial: 'G', dot: '#B8731A', cert: 'SQF_Granaria_Ed9.pdf',      standard: 'SQF Ed 9',   expires: '2026-02-28', auditor: 'NSF',        status: 'pending'  },
  { name: 'Hokkaido Dairy',   initial: 'H', dot: '#1F6B4A', cert: 'HACCP_Hokkaido_2025.pdf',   standard: 'HACCP',      expires: '2027-01-19', auditor: 'Bureau V.',  status: 'verified' },
  { name: 'Sierra Produce',   initial: 'S', dot: '#D8462A', cert: 'GLOBALGAP_Sierra.pdf',      standard: 'GLOBALG.A.P', expires: '2025-09-30', auditor: 'Control U.', status: 'expired'  },
  { name: 'Maple Ridge',      initial: 'M', dot: '#16493A', cert: 'ISO9001_MapleRidge.pdf',    standard: 'ISO 9001',   expires: '2028-03-14', auditor: 'DNV',        status: 'verified' },
  { name: 'Andes Cacao',      initial: 'A', dot: '#B8731A', cert: 'FairTrade_Andes_25.pdf',    standard: 'Fairtrade',  expires: '2026-06-22', auditor: 'FLOCERT',    status: 'pending'  },
  { name: 'Nordic Seafood',   initial: 'N', dot: '#0F4C4A', cert: 'MSC_Nordic_Chain.pdf',      standard: 'MSC CoC',    expires: '2027-08-08', auditor: 'Lloyd\u2019s',     status: 'verified' },
];

const STATUS_STYLES: Record<Status, { label: string; bg: string; fg: string; border: string }> = {
  verified: { label: 'Verified', bg: 'rgba(31,107,74,0.10)',  fg: 'var(--r2c-verified)', border: 'rgba(31,107,74,0.35)' },
  pending:  { label: 'Pending',  bg: 'rgba(184,115,26,0.10)', fg: 'var(--r2c-caution)',  border: 'rgba(184,115,26,0.35)' },
  expired:  { label: 'Expired',  bg: 'rgba(216,70,42,0.10)',  fg: 'var(--r2c-recall)',   border: 'rgba(216,70,42,0.35)' },
};

const SupplierAppMockup = () => {
  const reduce = useReducedMotion();
  const sidebar = [
    { label: 'Suppliers',  icon: '◫', active: true  },
    { label: 'Documents',  icon: '▤', active: false },
    { label: 'Requests',   icon: '◧', active: false },
    { label: 'Audits',     icon: '◇', active: false },
    { label: 'Reports',    icon: '◔', active: false },
    { label: 'Settings',   icon: '⚙', active: false },
  ];

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 40, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={reduce ? { duration: 0 } : { delay: 0.35, duration: 0.8, ease: EASE }}
      className="relative mx-auto w-full max-w-[1040px] overflow-hidden rounded-[14px] border border-[var(--r2c-line)] bg-[var(--r2c-surface)] shadow-[0_40px_80px_-30px_rgba(20,24,31,0.45),0_18px_36px_-18px_rgba(20,24,31,0.25)]"
    >
      {/* macOS title bar */}
      <div className="relative grid h-9 grid-cols-[1fr_auto_1fr] items-center border-b border-[var(--r2c-line)] bg-[var(--r2c-surface-2)] px-4">
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-[#FF5F57]" />
          <span className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
          <span className="h-3 w-3 rounded-full bg-[#28C840]" />
        </div>
        <span className="font-data text-[12px] font-medium tracking-wide text-[var(--r2c-ink)]">TraceR2C</span>
        <span />
      </div>

      <div className="grid grid-cols-[212px_1fr]">
        {/* sidebar */}
        <aside className="border-r border-[var(--r2c-line)] bg-[var(--r2c-surface-2)]/60 p-3">
          {/* workspace selector */}
          <div className="flex items-center justify-between rounded-md border border-[var(--r2c-line)] bg-[var(--r2c-surface)] px-2.5 py-1.5">
            <span className="flex items-center gap-2">
              <span className="grid h-5 w-5 place-items-center rounded-[5px] bg-[var(--r2c-stamp)] font-data text-[10px] font-bold text-white">A</span>
              <span className="font-body text-[12.5px] font-medium text-[var(--r2c-ink)]">Acme Foods</span>
            </span>
            <span className="font-data text-[10px] text-[var(--r2c-muted)]">▾</span>
          </div>

          {/* quick icons row */}
          <div className="mt-3 flex items-center gap-1.5">
            <button className="grid h-7 w-7 place-items-center rounded-md border border-[var(--r2c-line)] bg-[var(--r2c-surface)] font-data text-[11px] text-[var(--r2c-muted)]">⌂</button>
            <button className="grid h-7 w-7 place-items-center rounded-md border border-[var(--r2c-line)] bg-[var(--r2c-surface)] font-data text-[11px] text-[var(--r2c-muted)]">⌕</button>
            <button className="ml-auto rounded-md border border-[var(--r2c-line)] bg-[var(--r2c-surface)] px-2 py-1 font-data text-[10px] text-[var(--r2c-muted)]">+ New</button>
          </div>

          {/* Favorites */}
          <div className="mt-4">
            <p className="px-1 font-data text-[10px] uppercase tracking-[0.14em] text-[var(--r2c-muted)]">Favorites</p>
            <div className="mt-1 flex items-center gap-2 rounded-md px-2 py-1.5">
              <span className="grid h-4 w-4 place-items-center rounded bg-[var(--r2c-caution)]/15 font-data text-[9px] font-bold text-[var(--r2c-caution)]">C</span>
              <span className="font-body text-[12px] text-[var(--r2c-ink)]">Compliance Dashboard</span>
            </div>
          </div>

          {/* Workspace */}
          <div className="mt-4">
            <p className="px-1 font-data text-[10px] uppercase tracking-[0.14em] text-[var(--r2c-muted)]">Workspace</p>
            <ul className="mt-1 space-y-0.5">
              {sidebar.map((item) => (
                <li
                  key={item.label}
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${
                    item.active
                      ? 'bg-[var(--r2c-stamp)]/10 text-[var(--r2c-stamp)]'
                      : 'text-[var(--r2c-ink)]'
                  }`}
                >
                  <span className="font-data w-4 text-[12px] leading-none">{item.icon}</span>
                  <span className="font-body text-[12.5px] font-medium">{item.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* main panel */}
        <div className="bg-[var(--r2c-surface)]">
          {/* toolbar */}
          <div className="flex items-center justify-between border-b border-[var(--r2c-line)] px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="font-data text-[11px] text-[var(--r2c-muted)]">≣</span>
              <span className="font-body text-[13px] font-medium text-[var(--r2c-ink)]">All Suppliers</span>
              <span className="font-data text-[11px] text-[var(--r2c-muted)]">· {SUPPLIER_ROWS.length} ▾</span>
            </div>
            <div className="flex items-center gap-4">
              {['Filter', 'Sort', 'Options'].map((l) => (
                <span key={l} className="font-data text-[11px] uppercase tracking-wider text-[var(--r2c-muted)]">{l}</span>
              ))}
            </div>
          </div>

          {/* table */}
          <div className="overflow-hidden">
            {/* header */}
            <div className="grid grid-cols-[28px_1.4fr_1.6fr_1fr_0.9fr_1fr_0.8fr] items-center border-b border-[var(--r2c-line)] bg-[var(--r2c-surface-2)]/60 px-3 py-2">
              <span />
              {['Supplier', 'Certificate', 'Standard', 'Expires', 'Auditor', 'Status'].map((h) => (
                <span key={h} className="font-data text-[10.5px] uppercase tracking-[0.12em] text-[var(--r2c-muted)]">{h}</span>
              ))}
            </div>

            {/* rows */}
            {SUPPLIER_ROWS.map((row, i) => {
              const s = STATUS_STYLES[row.status];
              return (
                <div
                  key={row.name}
                  className={`grid grid-cols-[28px_1.4fr_1.6fr_1fr_0.9fr_1fr_0.8fr] items-center border-b border-[var(--r2c-line)] px-3 py-2.5 ${
                    i % 2 === 1 ? 'bg-[var(--r2c-surface-2)]/30' : ''
                  }`}
                >
                  <span className="grid h-3.5 w-3.5 place-items-center rounded-[3px] border border-[var(--r2c-line)] bg-[var(--r2c-surface)]" />
                  <span className="flex items-center gap-2">
                    <span
                      className="grid h-5 w-5 place-items-center rounded-full font-data text-[10px] font-bold text-white"
                      style={{ background: row.dot }}
                    >
                      {row.initial}
                    </span>
                    <span className="font-body text-[12.5px] font-medium text-[var(--r2c-ink)]">{row.name}</span>
                  </span>
                  <span className="truncate font-data text-[11.5px] text-[var(--r2c-ink)]">
                    <span className="rounded border border-[var(--r2c-line)] bg-[var(--r2c-surface)] px-1.5 py-0.5">{row.cert}</span>
                  </span>
                  <span className="font-data text-[11.5px] text-[var(--r2c-ink)]">{row.standard}</span>
                  <span className="font-data text-[11.5px] text-[var(--r2c-muted)]">{row.expires}</span>
                  <span className="font-body text-[12px] text-[var(--r2c-ink)]">{row.auditor}</span>
                  <span>
                    <span
                      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-data text-[10.5px] font-medium uppercase tracking-wider"
                      style={{ background: s.bg, color: s.fg, borderColor: s.border }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.fg }} />
                      {s.label}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

/* --------------------------------- page ----------------------------------- */


const Index = () => {
  const navigate = useNavigate();
  const goAuth = () => navigate('/auth');

  const reduce = useReducedMotion();
  const { scrollYProgress: pageProgress } = useScroll();
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const gridY = useTransform(scrollYProgress, [0, 1], ['0%', '14%']);

  /* ---- GSAP: magnetic CTA button ---- */
  const magneticRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (reduce) return;
    const btn = magneticRef.current;
    if (!btn) return;
    const xTo = gsap.quickTo(btn, 'x', { duration: 0.4, ease: 'power3' });
    const yTo = gsap.quickTo(btn, 'y', { duration: 0.4, ease: 'power3' });
    const onMove = (e: MouseEvent) => {
      const { left, top, width, height } = btn.getBoundingClientRect();
      xTo((e.clientX - left - width / 2) * 0.25);
      yTo((e.clientY - top - height / 2) * 0.25);
    };
    const onLeave = () => { xTo(0); yTo(0); };
    btn.addEventListener('mousemove', onMove);
    btn.addEventListener('mouseleave', onLeave);
    return () => { btn.removeEventListener('mousemove', onMove); btn.removeEventListener('mouseleave', onLeave); };
  }, [reduce]);

  /* ---- GSAP: CTA headline SplitText stagger ---- */
  const ctaHeadlineRef = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    if (reduce) return;
    const el = ctaHeadlineRef.current;
    if (!el) return;
    let cancelled = false;
    let split: SplitText | null = null;
    let trigger: ScrollTrigger | null = null;
    // Wait for fonts
    document.fonts.ready.then(() => {
      if (cancelled || !el.isConnected) return;
      split = SplitText.create(el, { type: 'words,chars' });
      gsap.set(split.chars, { opacity: 0, yPercent: 40 });
      trigger = ScrollTrigger.create({
        trigger: el,
        start: 'top 85%',
        once: true,
        onEnter: () => {
          gsap.to(split!.chars, {
            opacity: 1,
            yPercent: 0,
            stagger: 0.025,
            duration: 0.7,
            ease: 'power3.out',
          });
        },
      });
    });
    return () => {
      cancelled = true;
      trigger?.kill();
      split?.revert();
    };
  }, [reduce]);

  /* ---- GSAP: CTA background parallax scrub ---- */
  const ctaGridRef = useRef<HTMLDivElement>(null);
  const ctaSectionRef = useRef<HTMLElement>(null);
  const ctaLightRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (reduce) return;
    const grid = ctaGridRef.current;
    const section = ctaSectionRef.current;
    const light = ctaLightRef.current;
    if (!grid || !section) return;

    const parallaxTween = gsap.to(grid, {
      yPercent: -20,
      ease: 'none',
      scrollTrigger: {
        trigger: section,
        start: 'top bottom',
        end: 'bottom top',
        scrub: 0.4,
      },
    });

    // Light sweep — plays continuously while CTA is in viewport
    let sweepAnim: gsap.core.Tween | null = null;
    let sweepTrigger: ScrollTrigger | null = null;
    if (light) {
      sweepAnim = gsap.fromTo(
        light,
        { x: '-100%' },
        {
          x: '100%',
          duration: 3.5,
          ease: 'none',
          repeat: -1,
          repeatDelay: 1.5,
          paused: true,
        }
      );

      sweepTrigger = ScrollTrigger.create({
        trigger: section,
        start: 'top bottom',
        end: 'bottom top',
        onEnter: () => sweepAnim?.play(),
        onLeave: () => sweepAnim?.pause(),
        onEnterBack: () => sweepAnim?.play(),
        onLeaveBack: () => sweepAnim?.pause(),
      });
    }

    return () => {
      parallaxTween.scrollTrigger?.kill();
      parallaxTween.kill();
      sweepTrigger?.kill();
      sweepAnim?.kill();
    };
  }, [reduce]);

  const nav = [
    { label: 'Platform', href: '#platform' },
    { label: 'How it reads', href: '#how' },
    { label: 'Solutions', href: '#solutions' },
  ];

  const heroIn = (delay: number) =>
    reduce
      ? { initial: false as const, animate: { opacity: 1, y: 0 } }
      : { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { delay, duration: 0.6, ease: EASE } };

  return (
    <div className="r2c min-h-screen selection:bg-[var(--r2c-stamp)]/20">
      {/* scroll progress hairline */}
      <motion.div
        aria-hidden
        className="fixed inset-x-0 top-0 z-[60] h-[2px] origin-left bg-[var(--r2c-stamp)]"
        style={{ scaleX: pageProgress }}
      />

      {/* ============================== top bar ============================== */}
      <header className="sticky top-0 z-50 border-b border-[var(--r2c-line)] bg-[var(--r2c-bg)]/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-5 sm:px-8">
          <button onClick={() => navigate('/')} aria-label="TraceR2C home">
            <Wordmark size={23} />
          </button>

          <nav className="hidden items-center gap-8 md:flex">
            {nav.map((n) => (
              <a key={n.label} href={n.href} className="r2c-link font-data text-[12px] uppercase tracking-wider text-[var(--r2c-ink)]">
                {n.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <button onClick={goAuth} className="r2c-link hidden font-data text-[12px] uppercase tracking-wider text-[var(--r2c-ink)] sm:inline">
              Sign in
            </button>
            <PrimaryButton onClick={goAuth}>Book a demo</PrimaryButton>
          </div>
        </div>
      </header>

      {/* ================================ hero =============================== */}
      <section ref={heroRef} className="relative overflow-hidden border-b border-[var(--r2c-line)]">
        <motion.div className="r2c-grid pointer-events-none absolute inset-0 opacity-40" style={{ y: reduce ? 0 : gridY }} />
        {/* soft radial wash */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(60% 50% at 50% 35%, rgba(255,255,255,0.6), transparent 70%)' }}
        />

        {/* side barcode panels */}
        <BarcodePanel side="left" />
        <BarcodePanel side="right" />

        <div className="relative mx-auto flex max-w-[1180px] flex-col items-center px-5 pb-16 pt-20 text-center sm:px-8 lg:pb-24 lg:pt-24">
          <motion.h1
            {...heroIn(0.04)}
            className="mt-2 max-w-[20ch] font-normal leading-[1.05] tracking-[-0.02em] text-[var(--r2c-ink)] text-[42px] sm:text-[60px] lg:text-[72px]"
            style={{ fontFamily: 'Instrument Serif, "Cormorant Garamond", Georgia, serif' }}
          >
            Supplier compliance,{' '}
            <span className="italic text-[var(--r2c-stamp)]">defensible at audit speed</span>
          </motion.h1>


          <motion.p
            {...heroIn(0.16)}
            className="mt-7 max-w-2xl text-[16px] leading-[1.6] text-[var(--r2c-muted)] sm:text-[17px]"
          >
            TraceR2C gives compliance teams a system of record for supplier evidence — reading every
            certificate, validating it against the rule that applies, and stamping it as product-level
            proof that holds up in customs, audits, and recalls.
          </motion.p>

          <motion.div {...heroIn(0.24)} className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={goAuth}
              className="font-data inline-flex items-center rounded-full bg-[var(--r2c-ink)] px-7 py-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-white transition-all hover:bg-[var(--r2c-stamp)] active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--r2c-stamp)]"
            >
              Get started
            </button>
            <button
              onClick={() => document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' })}
              className="font-data inline-flex items-center rounded-full border border-[var(--r2c-ink)] bg-transparent px-7 py-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--r2c-ink)] transition-colors hover:bg-[var(--r2c-ink)]/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--r2c-ink)]"
            >
              Talk to us
            </button>
          </motion.div>

          {/* dashboard mockup */}
          <div className="relative z-[1] mt-16 w-full">
            <SupplierAppMockup />
          </div>
        </div>
      </section>


      {/* ============================== platform ============================ */}
      <section id="platform" className="mx-auto max-w-[1180px] px-5 py-24 sm:px-8">
        {/* heading band */}
        <div className="max-w-2xl">
          <Reveal>
            <Eyebrow>The platform</Eyebrow>
          </Reveal>
          <h2 className="font-display mt-4 text-[31px] font-semibold leading-[1.1] sm:text-[40px]">
            <ClipReveal delay={0.04}>Most tools store documents.</ClipReveal>
            <ClipReveal delay={0.12}>We turn them into a record.</ClipReveal>
          </h2>
          <Reveal delay={0.18}>
            <p className="mt-5 max-w-xl text-[16px] leading-[1.6] text-[var(--r2c-muted)]">
              Six engines own the relationship between requirement, supplier, facility, product, evidence,
              and decision — so compliance is something you can prove, not just file.
            </p>
          </Reveal>
        </div>

        {/* feature card (signature carried in) + spec list */}
        <div className="mt-12 grid grid-cols-1 gap-x-12 gap-y-10 lg:grid-cols-[0.92fr_1.08fr]">
          {/* Evidence Engine — the feature */}
          <Reveal>
            <div className="flex h-full flex-col rounded-[20px] border-2 border-[var(--r2c-line)] bg-[var(--r2c-surface)] p-8 shadow-[0_16px_32px_-12px_rgba(20,24,31,0.4)]">
              <div className="flex items-center gap-2.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--r2c-stamp)]" />
                <span className="font-data text-[11px] uppercase tracking-[0.15em] text-[var(--r2c-muted)]">
                  Evidence Engine
                </span>
              </div>
              <h3 className="font-display mt-4 text-[27px] font-semibold leading-[1.1]">
                Documents become evidence
              </h3>
              <p className="mt-3 text-[15px] leading-[1.6] text-[var(--r2c-muted)]">
                Every certificate is read into structured, sourced fields — standard, lab, dates, identifiers —
                then validated against the rule that actually applies. Mismatched dates, wrong labs, and expired
                scopes are caught on the way in.
              </p>

              {/* embedded proof chip — the stamp motif, out of the hero */}
              <div className="mt-7 rounded-[12px] border border-[var(--r2c-line)] bg-[var(--r2c-surface-2)] p-4">
                <div className="flex items-center justify-between">
                  <span className="font-data text-[11px] text-[var(--r2c-muted)]">ISO_9001_AuburnPlant.pdf</span>
                  <span className="font-data text-[11px] font-medium uppercase tracking-widest text-[var(--r2c-verified)]">
                    ● verified
                  </span>
                </div>
                <div className="mt-3 space-y-1.5">
                  {[
                    ['STANDARD', 'ISO 9001:2015'],
                    ['CERTIFICATE', 'ABC-123-99'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-baseline justify-between border-b border-dashed border-[var(--r2c-line)] pb-1.5">
                      <span className="font-data text-[10.5px] uppercase tracking-wider text-[var(--r2c-muted)]">{k}</span>
                      <span className="font-data text-[12px] font-medium text-[var(--r2c-ink)]">{v}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="font-data text-[11px] text-[var(--r2c-muted)]">
                    confidence <span className="font-semibold text-[var(--r2c-ink)]">0.98</span>
                  </span>
                  <span className="-rotate-6 rounded-[5px] border border-[var(--r2c-stamp)] px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-tight text-[var(--r2c-stamp)]">
                    Verified
                  </span>
                </div>
              </div>
            </div>
          </Reveal>

          {/* the remaining engines as a spec list */}
          <div className="border-t border-[var(--r2c-line)]">
            {ENGINES.map((e, i) => (
              <Reveal key={e.label} delay={i * 0.05}>
                <div
                  className={`group grid grid-cols-1 gap-1 border-b border-b-[var(--r2c-line)] border-l-2 p-5 pl-[18px] transition-colors sm:grid-cols-[176px_1fr] sm:gap-6 ${
                    e.accent ? 'border-l-[var(--r2c-recall)]' : 'border-l-transparent'
                  } ${i % 2 === 0 ? 'bg-[var(--r2c-surface-2)]/50' : 'bg-transparent'}`}
                >
                  <div className="flex items-center gap-2.5 self-start pt-0.5">
                    <span
                      className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${
                        e.accent ? 'bg-[var(--r2c-recall)]' : 'bg-[var(--r2c-muted)] group-hover:bg-[var(--r2c-ink)]'
                      }`}
                    />
                    <span
                      className={`font-data text-[11px] uppercase tracking-[0.15em] ${
                        e.accent ? 'text-[var(--r2c-recall)]' : 'text-[var(--r2c-muted)]'
                      }`}
                    >
                      {e.label}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-display flex items-center gap-2 text-[19px] font-semibold leading-tight">
                      {e.title}
                      <span
                        aria-hidden
                        className={`opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:opacity-100 ${
                          e.accent ? 'text-[var(--r2c-recall)]' : 'text-[var(--r2c-stamp)]'
                        }`}
                      >
                        →
                      </span>
                    </h3>
                    <p className="mt-1.5 text-[14px] leading-[1.55] text-[var(--r2c-muted)]">{e.body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ========================= how it reads (calm) ===================== */}
      <section id="how" className="border-y border-[var(--r2c-line)] bg-[var(--r2c-surface-2)]">
        <div className="mx-auto max-w-[1180px] px-5 py-20 sm:px-8">
          <Reveal>
            <Eyebrow>How it reads</Eyebrow>
          </Reveal>
          <h2 className="font-display mt-4 max-w-2xl text-[28px] font-semibold leading-[1.15] sm:text-[34px]">
            <ClipReveal delay={0.04}>One connected chain — from the rule</ClipReveal>
            <ClipReveal delay={0.12}>that applies to the decision you defend.</ClipReveal>
          </h2>
          <div className="mt-10">
            <TraceStrip />
          </div>
          <Reveal delay={0.1}>
            <p className="mt-8 max-w-xl font-data text-[13px] leading-[1.7] text-[var(--r2c-muted)]">
              Each node carries its own evidence, status, and audit trail. Change a rule version and the
              decisions downstream recompute — with a record of exactly why.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ============================== solutions =========================== */}
      <section id="solutions" className="mx-auto max-w-[1180px] px-5 py-24 sm:px-8">
        <Reveal>
          <Eyebrow>Solutions</Eyebrow>
        </Reveal>
        <h2 className="font-display mt-4 max-w-2xl text-[31px] font-semibold leading-[1.12] sm:text-[38px]">
          <ClipReveal delay={0.04}>Enter through one compliance problem.</ClipReveal>
          <ClipReveal delay={0.12}>Expand across the supply chain.</ClipReveal>
        </h2>

        {/* CPSC dated callout — concrete, not decorative */}
        <Reveal delay={0.05}>
          <div className="mt-10 flex flex-col gap-4 rounded-[14px] border border-[var(--r2c-stamp)]/35 bg-[var(--r2c-stamp)]/[0.05] p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="font-data text-[11px] uppercase tracking-[0.15em] text-[var(--r2c-stamp)]">
                Deadline · July 8, 2026
              </span>
              <p className="font-display mt-1.5 text-[20px] font-semibold">
                CPSC eFiling becomes mandatory for regulated consumer product imports.
              </p>
              <p className="mt-1 text-[14px] text-[var(--r2c-muted)]">
                Certificate data, applicable rules, labs, and exclusions — filed electronically per shipment.
              </p>
            </div>
            <GhostButton onClick={goAuth}>Get eFiling-ready</GhostButton>
          </div>
        </Reveal>

        <div className="mt-6 grid grid-cols-1 gap-px overflow-hidden rounded-[14px] border border-[var(--r2c-line)] bg-[var(--r2c-line)] sm:grid-cols-2 lg:grid-cols-3">
          {SOLUTIONS.map((s, i) => (
            <Reveal key={s.name} delay={(i % 3) * 0.05}>
              <div className="group flex h-full items-center justify-between bg-[var(--r2c-surface)] px-6 py-7 transition-colors duration-300 hover:bg-[var(--r2c-bg)]">
                <div>
                  <span className="font-data text-[10.5px] uppercase tracking-[0.15em] text-[var(--r2c-muted)]">
                    {s.tag}
                  </span>
                  <p className="font-display mt-1.5 text-[19px] font-semibold">{s.name}</p>
                </div>
                <span aria-hidden className="text-[var(--r2c-muted)] opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-[var(--r2c-stamp)] group-hover:opacity-100">
                  →
                </span>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* =============================== scope ============================== */}
      <section className="border-y border-[var(--r2c-line)] bg-[var(--r2c-surface-2)]">
        <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-12 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:items-center">
          <div>
            <Reveal>
              <Eyebrow>Why TraceR2C</Eyebrow>
            </Reveal>
            <h2 className="font-display mt-4 text-[28px] font-semibold leading-[1.14] sm:text-[34px]">
              <ClipReveal delay={0.04}>Works without an ERP.</ClipReveal>
              <ClipReveal delay={0.12}>Sharper when connected to one.</ClipReveal>
            </h2>
            <Reveal delay={0.18}>
              <p className="mt-5 max-w-md text-[16px] leading-[1.6] text-[var(--r2c-muted)]">
                We are the system of record for compliance — not for inventory, accounting, or manufacturing.
                TraceR2C reads limited product and shipment data and returns status, risk, gaps, and approvals.
              </p>
            </Reveal>
          </div>

          <Reveal delay={0.08}>
            <div className="overflow-hidden rounded-[14px] border border-[var(--r2c-line)] bg-[var(--r2c-surface)]">
              <div className="flex items-start gap-4 border-b border-[var(--r2c-line)] p-6">
                <span className="mt-0.5 font-data text-[var(--r2c-verified)]">✓</span>
                <div>
                  <p className="font-display text-[15px] font-semibold uppercase tracking-wide">Belongs in TraceR2C</p>
                  <p className="mt-1 text-[15px] text-[var(--r2c-muted)]">“Is this compliant, and can we prove it?”</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-6">
                <span className="mt-0.5 font-data text-[var(--r2c-muted)]">×</span>
                <div>
                  <p className="font-display text-[15px] font-semibold uppercase tracking-wide text-[var(--r2c-muted)]">
                    Belongs in your WMS / ERP
                  </p>
                  <p className="mt-1 text-[15px] text-[var(--r2c-muted)]">“Where should this inventory be stored or shipped?”</p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============================ security row ========================== */}
      <section className="mx-auto max-w-[1180px] px-5 py-14 sm:px-8">
        <Reveal>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-y border-[var(--r2c-line)] py-5">
            <span className="font-data text-[11px] uppercase tracking-[0.18em] text-[var(--r2c-ink)]">
              Built for audit
            </span>
            {['SOC 2 Type II', 'ISO 27001', 'Enforced MFA', 'Role-based access', 'Immutable audit log', 'Tenant isolation'].map(
              (t) => (
                <span key={t} className="font-data text-[12px] text-[var(--r2c-muted)]">
                  {t}
                </span>
              ),
            )}
          </div>
        </Reveal>
      </section>

      {/* ================================ CTA =============================== */}
      <section ref={ctaSectionRef} className="relative mx-auto max-w-[1180px] px-5 pb-24 sm:px-8">
        {/* Subtle ambient glow behind the card so the glass has something to refract */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[300px] bg-[var(--r2c-stamp)]/10 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="r2c-glass-cta relative overflow-hidden rounded-[13px] bg-[rgba(0,0,0,0.89)] backdrop-blur-[4px] px-8 py-20 text-center sm:px-16 border border-[rgba(0,0,0,0.53)] shadow-[0_0_38px_7px_rgba(0,0,0,0.44)]">
          {/* Glass Noise Texture */}
          <div 
            className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-overlay" 
            style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")" }} 
          />
          
          {/* Subtle inner top reflection */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-[1px]"
            style={{ background: 'linear-gradient(90deg, transparent 20%, rgba(255,255,255,0.15) 50%, transparent 80%)' }}
          />
          {/* Sweeping light reflection — GSAP animates this */}
          <div
            ref={ctaLightRef}
            className="pointer-events-none absolute inset-0"
            style={{
              background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.06) 45%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0.06) 55%, transparent 60%)',
              transform: 'translateX(-100%)',
            }}
          />
          {/* Background grid with parallax */}
          <div ref={ctaGridRef} className="r2c-grid pointer-events-none absolute inset-0 opacity-[0.04]" />
          {/* Radial glow at bottom */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: 'radial-gradient(70% 50% at 50% 110%, rgba(22,73,58,0.2), transparent 70%)' }}
          />

          <Reveal className="relative">
            <Eyebrow>Prove it</Eyebrow>
          </Reveal>
          <h2 ref={ctaHeadlineRef} className="font-display relative mx-auto mt-4 max-w-2xl text-[34px] font-bold leading-[1.06] text-[var(--r2c-bg)] sm:text-[46px]">
            Stop filing documents. Start stamping evidence.
          </h2>
          <Reveal delay={0.2} className="relative">
            <p className="mx-auto mt-5 max-w-xl text-[17px] leading-[1.6] text-[#9BA1A8]">
              See TraceR2C read one of your certificates and resolve it into defensible, product-level evidence.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <button
                ref={magneticRef}
                onClick={goAuth}
                className="group inline-flex items-center gap-2 rounded-full bg-[var(--r2c-stamp)] px-6 py-3.5 text-[15px] font-medium text-white transition-colors duration-200 hover:bg-[var(--r2c-stamp-deep)] active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--r2c-ink)]"
              >
                Book a demo
                <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
              </button>
              <button
                onClick={goAuth}
                className="r2c-link font-data text-[13px] uppercase tracking-wider text-[#9BA1A8] hover:text-white transition-colors"
              >
                Sign in
              </button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* =============================== footer ============================= */}
      <footer className="border-t border-[var(--r2c-line)]">
        <div className="mx-auto flex max-w-[1180px] flex-col items-center justify-between gap-5 px-5 py-10 sm:flex-row sm:px-8">
          <Wordmark size={19} />
          <div className="flex flex-wrap items-center justify-center gap-6">
            {['Platform', 'Solutions', 'Sign in'].map((l) => (
              <button
                key={l}
                onClick={l === 'Sign in' ? goAuth : () => document.getElementById(l.toLowerCase())?.scrollIntoView({ behavior: 'smooth' })}
                className="r2c-link font-data text-[12px] uppercase tracking-wider text-[var(--r2c-muted)]"
              >
                {l}
              </button>
            ))}
          </div>
          <span className="font-data text-[11px] text-[var(--r2c-muted)]">© {new Date().getFullYear()} TraceR2C LLC</span>
        </div>
      </footer>
    </div>
  );
};

export default Index;
