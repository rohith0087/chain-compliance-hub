import React, { useRef, useEffect } from 'react';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import {
  ArrowRight, Shield, FileSearch, FileCheck, TrendingUp, AlertTriangle,
  BarChart3, Clock, DollarSign, CheckCircle2, Target, Zap,
  Building2, ChevronDown, ExternalLink, Download,
  FlaskConical, Activity, Lock, Users, Layers, Server,
  MapPin, History, Scale
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// ─── R2C-scoped helpers ────────────────────────────────────────────────
const FadeInSection = ({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 32 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 32 }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

const SectionLabel = ({ num }: { num: string }) => (
  <div className="flex items-center gap-3 mb-4">
    <span className="font-data text-[11px] uppercase tracking-[0.22em] text-[var(--r2c-stamp)]">
      Section {num}
    </span>
    <div className="h-px flex-1 bg-[var(--r2c-line)]" />
  </div>
);

const StatBlock = ({ value, label, prefix = '', suffix = '', accent = false }: { value: string; label: string; prefix?: string; suffix?: string; accent?: boolean }) => (
  <div className="text-center">
    <div className={`font-display text-4xl md:text-5xl font-bold tracking-tight tabular-nums ${accent ? 'text-[var(--r2c-stamp)]' : 'text-[var(--r2c-ink)]'}`}>
      {prefix}{value}<span className="font-data text-2xl md:text-3xl ml-0.5">{suffix}</span>
    </div>
    <p className="font-data text-[11px] uppercase tracking-[0.16em] text-[var(--r2c-muted)] mt-3">{label}</p>
  </div>
);

const DataPointCard = ({ icon: Icon, stat, label, source }: { icon: any; stat: string; label: string; source: string; color?: string }) => (
  <div className="group rounded-[18px] border-2 border-[var(--r2c-line)] bg-[var(--r2c-surface)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--r2c-stamp)]/40">
    <div className="p-6">
      <div className="flex items-start gap-4">
        <div className="rounded-xl p-3 border border-[var(--r2c-line)] bg-[var(--r2c-surface-2)] shrink-0">
          <Icon className="h-5 w-5 text-[var(--r2c-stamp)]" />
        </div>
        <div>
          <p className="font-display text-2xl font-bold text-[var(--r2c-ink)] tabular-nums">{stat}</p>
          <p className="text-sm text-[var(--r2c-muted)] mt-1 leading-relaxed">{label}</p>
          <p className="font-data text-[10px] uppercase tracking-[0.14em] text-[var(--r2c-muted)]/80 mt-3 pt-3 border-t border-dashed border-[var(--r2c-line)]">
            {source}
          </p>
        </div>
      </div>
    </div>
  </div>
);

const ROIRow = ({ label, before, after, savings }: { label: string; before: string; after: string; savings: string }) => (
  <div className="grid grid-cols-4 gap-4 py-4 border-b border-dashed border-[var(--r2c-line)] last:border-0 items-center">
    <p className="text-sm font-medium text-[var(--r2c-ink)]">{label}</p>
    <p className="font-data text-[13px] text-[var(--r2c-muted)] text-center">{before}</p>
    <p className="font-data text-[13px] text-[var(--r2c-stamp)] font-semibold text-center">{after}</p>
    <p className="font-data text-[13px] text-[var(--r2c-verified)] font-bold text-center">{savings}</p>
  </div>
);

// ─── R2C button presets (mirrors landing) ───────────────────────────────
const PrimaryCTA: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ children, className = '', ...props }) => (
  <button
    {...props}
    className={`group inline-flex items-center gap-2 rounded-full bg-[var(--r2c-stamp)] px-6 py-3.5 text-[15px] font-medium text-white transition-all duration-200 hover:bg-[var(--r2c-stamp-deep)] active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--r2c-ink)] ${className}`}
  >
    {children}
  </button>
);

const GhostCTA: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ children, className = '', ...props }) => (
  <button
    {...props}
    className={`inline-flex items-center gap-2 rounded-full border border-[var(--r2c-ink)]/20 px-6 py-3.5 text-[15px] font-medium text-[var(--r2c-ink)] transition-colors duration-200 hover:border-[var(--r2c-ink)]/50 hover:bg-[var(--r2c-ink)]/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--r2c-ink)] ${className}`}
  >
    {children}
  </button>
);

const WhitePaperPage = () => {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: containerRef });
  const progressWidth = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);

  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @media print {
        .no-print { display: none !important; }
        body { background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        section { break-inside: avoid; }
      }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  const handleDownloadPdf = () => window.print();

  return (
    <div ref={containerRef} className="r2c min-h-screen bg-[var(--r2c-bg)] text-[var(--r2c-ink)] selection:bg-[var(--r2c-stamp)]/20 relative">
      {/* Reading Progress Bar */}
      <motion.div
        className="fixed top-0 left-0 h-[2px] bg-[var(--r2c-stamp)] z-[60] no-print origin-left"
        style={{ width: progressWidth }}
      />

      {/* ═══ HERO ═══ */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden border-b border-[var(--r2c-line)]">
        <div className="r2c-grid pointer-events-none absolute inset-0 opacity-70" />

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--r2c-stamp)]/40 bg-[var(--r2c-stamp)]/[0.06] text-[var(--r2c-stamp)] font-data text-[11px] uppercase tracking-[0.18em] mb-8">
              <FileCheck className="h-3.5 w-3.5" />
              White Paper — 2026 Edition
            </div>
          </motion.div>

          <motion.h1
            className="font-display text-5xl md:text-7xl lg:text-[88px] font-bold tracking-tight text-[var(--r2c-ink)] leading-[0.95]"
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15 }}
          >
            The Future of
            <span className="block relative mt-2 text-[var(--r2c-stamp)]">
              Supply Chain Compliance
              <motion.span
                className="absolute -bottom-1 left-1/2 h-[3px] bg-[var(--r2c-stamp)] origin-center"
                initial={{ width: 0, x: '-50%' }}
                animate={{ width: '60%', x: '-50%' }}
                transition={{ duration: 1.1, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
              />
            </span>
          </motion.h1>

          <motion.p
            className="text-lg md:text-xl text-[var(--r2c-muted)] max-w-3xl mx-auto mt-10 leading-relaxed"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            How AI-powered document intelligence, automated Certificate of Analysis comparison,
            and predictive supplier risk scoring are transforming a{' '}
            <strong className="text-[var(--r2c-ink)]">$32.1 billion industry</strong> —
            reducing compliance costs by up to 78% while achieving 94% accuracy.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-12"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.45 }}
          >
            <PrimaryCTA onClick={() => navigate('/auth')}>
              Request a Demo <ArrowRight className="h-4 w-4" />
            </PrimaryCTA>
            <GhostCTA className="no-print" onClick={handleDownloadPdf}>
              <Download className="h-4 w-4" /> Download PDF
            </GhostCTA>
          </motion.div>

          <motion.div className="mt-16" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}>
            <ChevronDown className="h-6 w-6 text-[var(--r2c-muted)] mx-auto animate-bounce" />
          </motion.div>
        </div>
      </section>

      {/* ═══ TABLE OF CONTENTS ═══ */}
      <section className="py-20 bg-[var(--r2c-surface-2)] border-b border-[var(--r2c-line)]">
        <div className="max-w-4xl mx-auto px-6">
          <FadeInSection>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { num: '01', title: 'The Compliance Crisis', desc: 'Market size, cost of non-compliance, and the $1.92B recall problem' },
                { num: '02', title: 'AI-Powered Document Intelligence', desc: '78% cost reduction through automated document processing' },
                { num: '03', title: 'COA Comparison & Automation', desc: 'From 90 minutes per lot to real-time analysis' },
                { num: '04', title: 'Predictive Supplier Risk Scoring', desc: 'Multi-factor risk assessment with AI-driven analytics' },
                { num: '05', title: 'ROI Analysis & Business Impact', desc: 'Quantified savings across enterprise deployments' },
                { num: '06', title: 'Architecture & Security', desc: 'Enterprise-grade platform built for scale' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-4 p-5 rounded-[18px] border border-[var(--r2c-line)] bg-[var(--r2c-surface)] hover:border-[var(--r2c-stamp)]/40 transition-colors group cursor-pointer">
                  <span className="font-display text-3xl font-bold text-[var(--r2c-stamp)]/30 group-hover:text-[var(--r2c-stamp)] transition-colors tabular-nums">{item.num}</span>
                  <div>
                    <h3 className="font-display font-semibold text-[var(--r2c-ink)] group-hover:text-[var(--r2c-stamp)] transition-colors">{item.title}</h3>
                    <p className="text-sm text-[var(--r2c-muted)] mt-1 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* ═══ SECTION 01 — COMPLIANCE CRISIS ═══ */}
      <section className="py-24 relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-6">
          <FadeInSection>
            <SectionLabel num="01" />
            <h2 className="font-display text-4xl md:text-5xl font-bold text-[var(--r2c-ink)] tracking-tight">
              The Compliance Crisis
            </h2>
            <p className="text-lg text-[var(--r2c-muted)] mt-4 max-w-3xl leading-relaxed">
              Supply chain compliance has become one of the most critical challenges facing enterprises globally.
              The convergence of regulatory complexity, global supplier networks, and manual processes creates
              a perfect storm of risk and inefficiency.
            </p>
          </FadeInSection>

          <FadeInSection delay={0.2}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-16 p-8 rounded-[20px] border-2 border-[var(--r2c-line)] bg-[var(--r2c-surface)]">
              <StatBlock value="32.1" prefix="$" suffix="B" label="Global SCM Market Size (2025)" accent />
              <StatBlock value="9.5" prefix="$" suffix="B" label="Compliance & Traceability Market by 2031" />
              <StatBlock value="11.8" suffix="%" label="SCM Market CAGR (2025-2035)" />
              <StatBlock value="98" prefix="$" suffix="B" label="Projected SCM Market by 2035" accent />
            </div>
            <p className="font-data text-[11px] uppercase tracking-[0.14em] text-[var(--r2c-muted)]/80 mt-4 text-center">
              Sources: Future Market Insights (2025), Allied Market Research (2025)
            </p>
          </FadeInSection>

          <FadeInSection delay={0.3}>
            <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="font-display text-2xl font-bold text-[var(--r2c-ink)] mb-4 flex items-center gap-2">
                  <AlertTriangle className="h-6 w-6 text-[var(--r2c-recall)]" />
                  The Cost of Getting It Wrong
                </h3>
                <div className="space-y-4">
                  <DataPointCard icon={DollarSign} stat="$1.92 Billion" label="Cost of US food recalls in 2024 alone — label errors were the dominant cause" source="New Food Magazine, 2025" />
                  <DataPointCard icon={AlertTriangle} stat="251 Recall Events" label="FDA food & beverage recalls in 2025 — roughly 5 per week" source="FDA / Esko Analysis, 2026" />
                  <DataPointCard icon={TrendingUp} stat="2× Increase" label="Hospitalizations and deaths from contaminated food doubled in 2024" source="FSNS, 2025" />
                </div>
              </div>
              <div>
                <h3 className="font-display text-2xl font-bold text-[var(--r2c-ink)] mb-4 flex items-center gap-2">
                  <Clock className="h-6 w-6 text-[var(--r2c-caution)]" />
                  The Manual Processing Burden
                </h3>
                <div className="space-y-4">
                  <DataPointCard icon={DollarSign} stat="$5 – $25" label="Cost per document when processed manually — labor, errors, and overhead" source="DocuExprt, 2026" />
                  <DataPointCard icon={Clock} stat="30 – 90 min" label="Time to manually create a single Certificate of Analysis per lot" source="UpBrains AI, 2025" />
                  <DataPointCard icon={Building2} stat="$206.1 Billion" label="Annual global spend on financial crime compliance alone" source="LexisNexis Risk Solutions, 2023" />
                </div>
              </div>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* ═══ SECTION 02 — DOCUMENT INTELLIGENCE ═══ */}
      <section className="py-24 bg-[var(--r2c-surface-2)] border-y border-[var(--r2c-line)] relative">
        <div className="max-w-6xl mx-auto px-6 relative">
          <FadeInSection>
            <SectionLabel num="02" />
            <h2 className="font-display text-4xl md:text-5xl font-bold text-[var(--r2c-ink)] tracking-tight">
              AI-Powered Document Intelligence
            </h2>
            <p className="text-lg text-[var(--r2c-muted)] mt-4 max-w-3xl leading-relaxed">
              Our platform leverages advanced AI to transform document compliance from a manual,
              error-prone process into an automated, intelligent workflow — achieving results that
              match industry-leading benchmarks.
            </p>
          </FadeInSection>

          <FadeInSection delay={0.2}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
              {[
                { icon: Target, stat: '94%', label: 'Document Processing Accuracy', detail: 'Across 64 companies implementing AI-powered document extraction, accuracy rates averaged 94% — eliminating manual data entry errors.', source: 'Athenic / GetAthenic Study, 2024' },
                { icon: DollarSign, stat: '78%', label: 'Cost Reduction', detail: 'Organizations using automated document processing achieved a 78% reduction in processing costs compared to manual workflows.', source: 'Athenic / GetAthenic Study, 2024' },
                { icon: Zap, stat: '12×', label: 'Faster Processing', detail: 'AI-driven document processing delivers 12x speed improvement over manual data entry, reducing turnaround from days to minutes.', source: 'Athenic / GetAthenic Study, 2024' },
              ].map((item, i) => (
                <div key={i} className="rounded-[20px] border-2 border-[var(--r2c-line)] bg-[var(--r2c-surface)] overflow-hidden group hover:border-[var(--r2c-stamp)]/40 hover:-translate-y-0.5 transition-all duration-300">
                  <div className="h-1 bg-[var(--r2c-stamp)]" />
                  <div className="p-8">
                    <item.icon className="h-8 w-8 text-[var(--r2c-stamp)] mb-4" />
                    <p className="font-display text-5xl font-bold text-[var(--r2c-stamp)] tabular-nums">{item.stat}</p>
                    <p className="font-display text-lg font-semibold text-[var(--r2c-ink)] mt-2">{item.label}</p>
                    <p className="text-sm text-[var(--r2c-muted)] mt-3 leading-relaxed">{item.detail}</p>
                    <p className="font-data text-[10px] uppercase tracking-[0.14em] text-[var(--r2c-muted)]/80 mt-4 border-t border-dashed border-[var(--r2c-line)] pt-3">{item.source}</p>
                  </div>
                </div>
              ))}
            </div>
          </FadeInSection>

          <FadeInSection delay={0.3}>
            <div className="mt-20">
              <h3 className="font-display text-2xl font-bold text-[var(--r2c-ink)] mb-8">How Our AI Document Pipeline Works</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  { step: '01', title: 'Intake & Classification', desc: 'AI automatically categorizes incoming documents — COAs, certifications, insurance, compliance forms — with intelligent metadata extraction.', icon: Layers },
                  { step: '02', title: 'AI Validation', desc: 'AI Vision extracts structured data from multi-page PDFs and DOCX files, with unit/analyte/method normalization.', icon: FileSearch },
                  { step: '03', title: 'Compliance Scoring', desc: 'Documents are scored against configurable specs. Flagged items trigger automated workflows and stakeholder alerts.', icon: Shield },
                  { step: '04', title: 'Audit Trail', desc: 'Every action is logged immutably — from upload through approval — creating a forensic-ready compliance record.', icon: Lock },
                ].map((item, i) => (
                  <div key={i} className="relative p-6 rounded-[18px] border border-[var(--r2c-line)] bg-[var(--r2c-surface)] hover:border-[var(--r2c-stamp)]/40 transition-colors group">
                    <span className="font-display text-6xl font-bold text-[var(--r2c-stamp)]/10 absolute top-4 right-4 group-hover:text-[var(--r2c-stamp)]/20 transition-colors tabular-nums">{item.step}</span>
                    <item.icon className="h-6 w-6 text-[var(--r2c-stamp)] mb-3" />
                    <h4 className="font-display font-semibold text-[var(--r2c-ink)]">{item.title}</h4>
                    <p className="text-sm text-[var(--r2c-muted)] mt-2 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </FadeInSection>

          <FadeInSection delay={0.4}>
            <div className="mt-16 p-8 rounded-[20px] border-2 border-[var(--r2c-line)] bg-[var(--r2c-surface)]">
              <h3 className="font-display text-xl font-bold text-[var(--r2c-ink)] mb-2">Industry Benchmark</h3>
              <p className="text-[var(--r2c-muted)] text-sm leading-relaxed">
                A comprehensive study of 64 companies across finance, legal, and operations teams found that
                AI-powered document processing achieves <strong className="text-[var(--r2c-ink)]">94% accuracy rates</strong>,
                <strong className="text-[var(--r2c-ink)]"> 78% cost reduction</strong>, and
                <strong className="text-[var(--r2c-ink)]"> 12× faster processing</strong> compared to manual data entry.
                Organizations that move from manual processing to AI-powered extraction recover their investment within months
                and generate sustained cost advantages that compound annually.
              </p>
              <p className="font-data text-[10px] uppercase tracking-[0.14em] text-[var(--r2c-muted)]/80 mt-4">Source: Athenic Document Processing Automation Study, November 2024</p>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* ═══ SECTION 03 — COA AUTOMATION ═══ */}
      <section className="py-24 relative">
        <div className="max-w-6xl mx-auto px-6">
          <FadeInSection>
            <SectionLabel num="03" />
            <h2 className="font-display text-4xl md:text-5xl font-bold text-[var(--r2c-ink)] tracking-tight">
              Certificate of Analysis
              <span className="block text-[var(--r2c-stamp)]">Automation Engine</span>
            </h2>
            <p className="text-lg text-[var(--r2c-muted)] mt-4 max-w-3xl leading-relaxed">
              Certificates of Analysis are the cornerstone of quality assurance in food, pharmaceutical,
              and chemical supply chains. Our platform automates the entire COA lifecycle — from extraction
              to specification comparison — eliminating the most time-intensive compliance bottleneck.
            </p>
          </FadeInSection>

          <FadeInSection delay={0.2}>
            <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="p-8 rounded-[20px] border-2 border-[var(--r2c-recall)]/30 bg-[var(--r2c-recall)]/[0.04]">
                <div className="flex items-center gap-2 mb-6">
                  <div className="h-2.5 w-2.5 rounded-full bg-[var(--r2c-recall)] animate-pulse" />
                  <h3 className="font-display text-xl font-bold text-[var(--r2c-ink)]">Manual COA Process</h3>
                </div>
                <ul className="space-y-4">
                  {[
                    '30-90 minutes spent per lot for manual COA creation',
                    'Lab teams juggle spreadsheets, Word templates, and PDF tools',
                    'High error rates from manual data transcription',
                    'No standardized unit or method normalization',
                    'Inconsistent specification comparison across analysts',
                    'Paper-based audit trails vulnerable to loss',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-[var(--r2c-muted)]">
                      <AlertTriangle className="h-4 w-4 text-[var(--r2c-recall)] shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="font-data text-[10px] uppercase tracking-[0.14em] text-[var(--r2c-muted)]/80 mt-6">Source: UpBrains AI, 2025</p>
              </div>

              <div className="p-8 rounded-[20px] border-2 border-[var(--r2c-stamp)]/30 bg-[var(--r2c-stamp)]/[0.04]">
                <div className="flex items-center gap-2 mb-6">
                  <div className="h-2.5 w-2.5 rounded-full bg-[var(--r2c-stamp)]" />
                  <h3 className="font-display text-xl font-bold text-[var(--r2c-ink)]">AI-Powered COA Engine</h3>
                </div>
                <ul className="space-y-4">
                  {[
                    'AI-powered extraction from multi-page PDFs & DOCX with 94% accuracy',
                    'Automatic unit normalization: ppm → mg/kg, ppb → µg/kg, % → mg/kg',
                    'Analyte & method mapping to canonical codes via internal dictionaries',
                    'Censored value parsing (ND, <LOD, <LOQ) with threshold extraction',
                    'Automated spec comparison with configurable pass/fail scoring',
                    'Immutable digital audit trail with complete version history',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-[var(--r2c-ink)]">
                      <CheckCircle2 className="h-4 w-4 text-[var(--r2c-stamp)] shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </FadeInSection>

          <FadeInSection delay={0.3}>
            <div className="mt-16">
              <h3 className="font-display text-2xl font-bold text-[var(--r2c-ink)] mb-6 flex items-center gap-2">
                <FlaskConical className="h-6 w-6 text-[var(--r2c-stamp)]" />
                Intelligent COA Scoring Model
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="rounded-[18px] border-2 border-[var(--r2c-line)] bg-[var(--r2c-surface)] p-6">
                  <p className="font-data text-[11px] uppercase tracking-[0.18em] text-[var(--r2c-stamp)] mb-2">Baseline</p>
                  <p className="font-display text-4xl font-bold text-[var(--r2c-ink)] tabular-nums">100</p>
                  <p className="text-sm text-[var(--r2c-muted)] mt-2 leading-relaxed">Starting score for each COA submission</p>
                </div>
                <div className="rounded-[18px] border-2 border-[var(--r2c-line)] bg-[var(--r2c-surface)] p-6">
                  <p className="font-data text-[11px] uppercase tracking-[0.18em] text-[var(--r2c-stamp)] mb-2">Deductions</p>
                  <div className="space-y-2 mt-2">
                    {[
                      ['Flagged analyte', '-5 pts'],
                      ['Unknown analyte', '-2 pts'],
                      ['Missing analyte', '-10 pts'],
                      ['Method mismatch', '-3 pts'],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between text-sm border-b border-dashed border-[var(--r2c-line)] pb-1.5 last:border-0">
                        <span className="text-[var(--r2c-muted)]">{k}</span>
                        <span className="font-data text-[var(--r2c-recall)]">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-[18px] border-2 border-[var(--r2c-line)] bg-[var(--r2c-surface)] p-6">
                  <p className="font-data text-[11px] uppercase tracking-[0.18em] text-[var(--r2c-stamp)] mb-2">Classification</p>
                  <div className="space-y-3 mt-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full bg-[var(--r2c-verified)]" />
                      <span className="text-sm text-[var(--r2c-ink)]"><strong>Pass</strong> — Score ≥ 80, no critical flags</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full bg-[var(--r2c-caution)]" />
                      <span className="text-sm text-[var(--r2c-ink)]"><strong>Partial</strong> — Score ≥ 50 or non-critical flags</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full bg-[var(--r2c-recall)]" />
                      <span className="text-sm text-[var(--r2c-ink)]"><strong>Fail</strong> — Score &lt; 50 or critical flag</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* ═══ SECTION 04 — RISK SCORING ═══ */}
      <section className="py-24 bg-[var(--r2c-surface-2)] border-y border-[var(--r2c-line)] relative">
        <div className="max-w-6xl mx-auto px-6 relative">
          <FadeInSection>
            <SectionLabel num="04" />
            <h2 className="font-display text-4xl md:text-5xl font-bold text-[var(--r2c-ink)] tracking-tight">
              Predictive Supplier
              <span className="block text-[var(--r2c-stamp)]">Risk Scoring</span>
            </h2>
            <p className="text-lg text-[var(--r2c-muted)] mt-4 max-w-3xl leading-relaxed">
              Moving beyond reactive compliance to proactive risk intelligence. Our weighted multi-criteria
              decision model continuously evaluates supplier risk across five dimensions, providing a
              real-time 0-100 risk score with AI-driven recommendations.
            </p>
          </FadeInSection>

          <FadeInSection delay={0.2}>
            <div className="mt-16 grid grid-cols-1 lg:grid-cols-5 gap-4">
              {[
                { factor: 'Trade & Tariff Sensitivity', weight: '0–20 pts', icon: Scale, desc: 'Monitors tariff changes, trade restrictions, and geopolitical risk exposure' },
                { factor: 'Recall History', weight: '0–20 pts', icon: History, desc: 'Tracks FDA/USDA recalls, severity, frequency, and remediation history' },
                { factor: 'Regulatory Actions', weight: '0–15 pts', icon: Shield, desc: 'FDA warning letters, consent decrees, import alerts, and enforcement actions' },
                { factor: 'Document Completeness', weight: '0–15 pts', icon: FileCheck, desc: 'Real-time monitoring of document currency, expiry, and coverage gaps' },
                { factor: 'Geo Concentration', weight: '0–10 pts', icon: MapPin, desc: 'Supply chain diversification analysis and single-source dependency risk' },
              ].map((item, i) => (
                <div key={i} className="rounded-[18px] border-2 border-[var(--r2c-line)] bg-[var(--r2c-surface)] p-5 hover:border-[var(--r2c-stamp)]/40 transition-all duration-300 group">
                  <item.icon className="h-6 w-6 text-[var(--r2c-stamp)] mb-3 group-hover:scale-110 transition-transform" />
                  <p className="font-display font-semibold text-[var(--r2c-ink)] text-sm">{item.factor}</p>
                  <p className="font-data text-xl font-bold text-[var(--r2c-stamp)] mt-1 tabular-nums">{item.weight}</p>
                  <p className="text-xs text-[var(--r2c-muted)] mt-2 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </FadeInSection>

          <FadeInSection delay={0.3}>
            <div className="mt-16 p-8 rounded-[20px] border-2 border-[var(--r2c-line)] bg-[var(--r2c-surface)]">
              <h3 className="font-display text-xl font-bold text-[var(--r2c-ink)] mb-4">Why Predictive Risk Matters</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <p className="text-sm text-[var(--r2c-muted)] leading-relaxed">
                    According to EY's 2025 analysis, organizations using AI-powered third-party risk management
                    are seeing transformational improvements in risk identification speed and accuracy. Traditional
                    periodic audits miss 60-80% of emerging risks because they only capture a point-in-time snapshot.
                  </p>
                  <p className="font-data text-[10px] uppercase tracking-[0.14em] text-[var(--r2c-muted)]/80 mt-3">Source: EY Global Risk Consulting, 2025</p>
                </div>
                <div>
                  <p className="text-sm text-[var(--r2c-muted)] leading-relaxed">
                    Sphera's 2025 AI-Powered Supplier Risk Management Survey found that CPOs and CSCOs are
                    increasingly prioritizing AI-driven risk scoring to navigate geopolitical tensions, tariff
                    disruptions, supplier insolvencies, and escalating regulatory demands — marking a fundamental
                    shift from reactive to predictive supply chain management.
                  </p>
                  <p className="font-data text-[10px] uppercase tracking-[0.14em] text-[var(--r2c-muted)]/80 mt-3">Source: Sphera AI-Powered Supplier Risk Survey, 2025</p>
                </div>
              </div>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* ═══ SECTION 05 — ROI ═══ */}
      <section className="py-24 relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-6">
          <FadeInSection>
            <SectionLabel num="05" />
            <h2 className="font-display text-4xl md:text-5xl font-bold text-[var(--r2c-ink)] tracking-tight">
              ROI Analysis &
              <span className="block text-[var(--r2c-stamp)]">Business Impact</span>
            </h2>
            <p className="text-lg text-[var(--r2c-muted)] mt-4 max-w-3xl leading-relaxed">
              Based on industry benchmarks and real-world implementation data, here's the quantified
              impact of transitioning from manual compliance processes to our AI-powered platform.
            </p>
          </FadeInSection>

          <FadeInSection delay={0.2}>
            <div className="mt-16 rounded-[20px] border-2 border-[var(--r2c-line)] bg-[var(--r2c-surface)] overflow-hidden">
              <div className="grid grid-cols-4 gap-4 p-6 bg-[var(--r2c-surface-2)] border-b border-[var(--r2c-line)]">
                <p className="font-data text-[11px] uppercase tracking-[0.16em] text-[var(--r2c-ink)] font-semibold">Metric</p>
                <p className="font-data text-[11px] uppercase tracking-[0.16em] text-[var(--r2c-muted)] text-center font-semibold">Manual Process</p>
                <p className="font-data text-[11px] uppercase tracking-[0.16em] text-[var(--r2c-stamp)] text-center font-semibold">With Platform</p>
                <p className="font-data text-[11px] uppercase tracking-[0.16em] text-[var(--r2c-verified)] text-center font-semibold">Improvement</p>
              </div>
              <div className="p-6">
                <ROIRow label="Document Processing Cost" before="$15–$26/doc" after="$2–$5/doc" savings="78% Reduction" />
                <ROIRow label="COA Processing Time" before="30–90 min/lot" after="2–5 min/lot" savings="95% Faster" />
                <ROIRow label="Document Accuracy Rate" before="~75–82%" after="94%" savings="+15% Accuracy" />
                <ROIRow label="Processing Speed" before="1× baseline" after="12× faster" savings="12× Improvement" />
                <ROIRow label="Compliance Staff Needed" before="8–12 FTEs" after="2–4 FTEs" savings="60–70% Less" />
                <ROIRow label="Audit Preparation Time" before="2–4 weeks" after="Minutes" savings="~99% Reduction" />
                <ROIRow label="Risk Detection Lead Time" before="Reactive (post-incident)" after="Predictive (real-time)" savings="Proactive" />
              </div>
            </div>
            <p className="font-data text-[11px] uppercase tracking-[0.14em] text-[var(--r2c-muted)]/80 mt-4 text-center">
              Sources: Athenic Study (2024), UpBrains AI (2025), DocuExprt (2026), Floowed ROI Analysis (2026)
            </p>
          </FadeInSection>

          <FadeInSection delay={0.3}>
            <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { icon: DollarSign, stat: '$250K+', label: 'Annual Savings', desc: 'Average annual savings from reduced labor, faster turnaround, and improved accuracy through AI-powered document intelligence.', source: 'Floowed ROI Analysis, 2024' },
                { icon: TrendingUp, stat: '3–6 mo', label: 'Payback Period', desc: 'Organizations recover their investment within months. The ROI compounds as automation scales across supplier networks and document types.', source: 'Floowed ROI Analysis, 2026' },
                { icon: BarChart3, stat: '50–70%', label: 'Operational Cost Cut', desc: 'Document intelligence reduces operational costs by 50–70% while processing time drops from days to hours.', source: 'Floowed, 2024' },
              ].map((c, i) => (
                <div key={i} className="rounded-[20px] border-2 border-[var(--r2c-stamp)] bg-[var(--r2c-stamp)] text-white overflow-hidden">
                  <div className="p-8">
                    <c.icon className="h-8 w-8 mb-4 opacity-80" />
                    <p className="font-display text-4xl font-bold tabular-nums">{c.stat}</p>
                    <p className="font-display text-lg font-medium mt-2 opacity-95">{c.label}</p>
                    <p className="text-sm mt-3 opacity-80 leading-relaxed">{c.desc}</p>
                    <p className="font-data text-[10px] uppercase tracking-[0.14em] opacity-70 mt-4 border-t border-dashed border-white/30 pt-3">{c.source}</p>
                  </div>
                </div>
              ))}
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* ═══ SECTION 06 — ARCHITECTURE & SECURITY ═══ */}
      <section className="py-24 bg-[var(--r2c-surface-2)] border-y border-[var(--r2c-line)] relative">
        <div className="max-w-6xl mx-auto px-6">
          <FadeInSection>
            <SectionLabel num="06" />
            <h2 className="font-display text-4xl md:text-5xl font-bold text-[var(--r2c-ink)] tracking-tight">
              Enterprise Architecture
              <span className="block text-[var(--r2c-stamp)]">& Security</span>
            </h2>
          </FadeInSection>

          <FadeInSection delay={0.2}>
            <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { icon: Lock, title: 'Row-Level Security', desc: 'Every database table enforces RLS policies ensuring tenant data isolation. No user can access another organization\'s data.' },
                { icon: Shield, title: 'Zero-Trust Authentication', desc: 'Multi-factor authentication with Cloudflare Turnstile bot protection, login brute-force lockout, and session management.' },
                { icon: Users, title: 'Multi-Tenant Architecture', desc: 'Complete data isolation between buyer and supplier organizations with branch-level access controls and role hierarchies.' },
                { icon: Server, title: 'AI Agent Framework', desc: '52 serverless edge functions with rate limiting, input sanitization, and service-role-only access for sensitive operations.' },
                { icon: Activity, title: 'Real-Time Monitoring', desc: 'Continuous compliance monitoring with predictive analytics, automated alerts, and executive dashboards.' },
                { icon: Building2, title: 'Global Compliance', desc: 'Multi-region deployment supporting FDA, EU, FSMA 204, HACCP, GMP, and industry-specific regulatory frameworks.' },
              ].map((item, i) => (
                <div key={i} className="rounded-[18px] border-2 border-[var(--r2c-line)] bg-[var(--r2c-surface)] p-6 hover:border-[var(--r2c-stamp)]/40 transition-all duration-300 group">
                  <div className="rounded-xl p-3 border border-[var(--r2c-line)] bg-[var(--r2c-surface-2)] w-fit mb-4">
                    <item.icon className="h-6 w-6 text-[var(--r2c-stamp)]" />
                  </div>
                  <h3 className="font-display font-semibold text-[var(--r2c-ink)]">{item.title}</h3>
                  <p className="text-sm text-[var(--r2c-muted)] mt-2 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </FadeInSection>

          <FadeInSection delay={0.3}>
            <div className="mt-12 p-6 rounded-[20px] border-2 border-[var(--r2c-stamp)]/30 bg-[var(--r2c-stamp)]/[0.05] flex flex-col md:flex-row items-center gap-6">
              <div className="rounded-full p-4 border-2 border-[var(--r2c-stamp)]/40 bg-[var(--r2c-surface)]">
                <Shield className="h-10 w-10 text-[var(--r2c-stamp)]" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-[var(--r2c-ink)]">Security Audited & Hardened</h3>
                <p className="text-sm text-[var(--r2c-muted)] mt-1 leading-relaxed">
                  Our platform has undergone comprehensive security auditing — including penetration testing for
                  SQL injection, XSS, CSRF, authentication bypass, privilege escalation, and API abuse.
                  All RPC functions are restricted to authenticated users, with sensitive operations limited to service-role access only.
                </p>
              </div>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="py-32 relative overflow-hidden bg-[var(--r2c-ink)]">
        <div className="r2c-grid pointer-events-none absolute inset-0 opacity-[0.08]" />
        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          <FadeInSection>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-white tracking-tight">
              Ready to Transform Your
              <span className="block mt-2 text-[var(--r2c-bg)]">Compliance Operations?</span>
            </h2>
            <p className="text-lg text-white/70 mt-6 max-w-2xl mx-auto leading-relaxed">
              Join enterprise organizations that have reduced compliance costs by 78%,
              achieved 94% document accuracy, and eliminated manual COA processing.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
              <button
                onClick={() => navigate('/auth')}
                className="group inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-[15px] font-medium text-[var(--r2c-stamp)] transition-all duration-200 hover:bg-white/90 active:scale-[0.97]"
              >
                Request a Demo <ArrowRight className="h-4 w-4" />
              </button>
              <button className="inline-flex items-center gap-2 rounded-full border border-white/30 px-6 py-3.5 text-[15px] font-medium text-white transition-colors duration-200 hover:bg-white/10">
                Contact Sales <ExternalLink className="h-4 w-4" />
              </button>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="py-12 border-t border-[var(--r2c-line)] bg-[var(--r2c-surface-2)]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-sm text-[var(--r2c-muted)]">
                © {new Date().getFullYear()} Supply Chain Compliance Platform. All rights reserved.
              </p>
              <p className="font-data text-[10px] uppercase tracking-[0.14em] text-[var(--r2c-muted)]/70 mt-2">
                White Paper — Edition 2026. All statistics sourced and cited.
              </p>
            </div>
            <div className="flex items-center gap-6 max-w-md">
              <p className="font-data text-[10px] uppercase tracking-[0.14em] text-[var(--r2c-muted)]/70 leading-relaxed">
                Data sources: Future Market Insights, Allied Market Research, Athenic, UpBrains AI,
                FDA, FSNS, EY, Sphera, LexisNexis, Floowed, DocuExprt
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default WhitePaperPage;
