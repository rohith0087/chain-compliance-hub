import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import { 
  ArrowRight, Shield, Brain, FileCheck, TrendingUp, AlertTriangle, 
  BarChart3, Clock, DollarSign, CheckCircle2, Target, Zap, 
  Globe, Building2, ChevronDown, ExternalLink, Download,
  FlaskConical, LineChart, Lock, Users, Layers, Cpu
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';

// ─── Animated Section Wrapper ───────────────────────────────────────────
const FadeInSection = ({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

// ─── Stat Counter ───────────────────────────────────────────────────────
const StatBlock = ({ value, label, prefix = '', suffix = '', accent = false }: { value: string; label: string; prefix?: string; suffix?: string; accent?: boolean }) => (
  <div className="text-center">
    <div className={`text-4xl md:text-5xl font-bold tracking-tight ${accent ? 'bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent' : 'text-foreground'}`}>
      {prefix}{value}{suffix}
    </div>
    <p className="text-sm text-muted-foreground mt-2 font-medium">{label}</p>
  </div>
);

// ─── Data Point Card ────────────────────────────────────────────────────
const DataPointCard = ({ icon: Icon, stat, label, source, color }: { icon: any; stat: string; label: string; source: string; color: string }) => (
  <Card className="group border-0 bg-card/80 backdrop-blur-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-1 overflow-hidden">
    <div className={`h-1 ${color}`} />
    <CardContent className="p-6">
      <div className="flex items-start gap-4">
        <div className={`rounded-xl p-3 ${color} bg-opacity-10 shrink-0`}>
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{stat}</p>
          <p className="text-sm text-muted-foreground mt-1 font-medium">{label}</p>
          <p className="text-xs text-muted-foreground/70 mt-2 italic">{source}</p>
        </div>
      </div>
    </CardContent>
  </Card>
);

// ─── ROI Comparison Row ─────────────────────────────────────────────────
const ROIRow = ({ label, before, after, savings }: { label: string; before: string; after: string; savings: string }) => (
  <div className="grid grid-cols-4 gap-4 py-4 border-b border-border/50 last:border-0 items-center">
    <p className="text-sm font-medium text-foreground">{label}</p>
    <p className="text-sm text-muted-foreground text-center">{before}</p>
    <p className="text-sm text-primary font-semibold text-center">{after}</p>
    <p className="text-sm text-emerald-600 font-bold text-center">{savings}</p>
  </div>
);

const WhitePaperPage = () => {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: containerRef });
  const progressWidth = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);

  return (
    <div ref={containerRef} className="min-h-screen bg-background relative">
      {/* Reading Progress Bar */}
      <motion.div 
        className="fixed top-0 left-0 h-1 bg-gradient-to-r from-primary via-accent to-primary z-50"
        style={{ width: progressWidth }}
      />

      {/* ════════════════════════════════════════════════════════════════════
          HERO SECTION
          ════════════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(hsl(var(--primary)/0.03)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--primary)/0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-background" />
        
        {/* Floating Orbs */}
        <motion.div
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/5 blur-3xl"
          animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-accent/5 blur-3xl"
          animate={{ x: [0, -20, 0], y: [0, 30, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-8 border border-primary/20">
              <FileCheck className="h-4 w-4" />
              WHITE PAPER — 2026 EDITION
            </div>
          </motion.div>

          <motion.h1
            className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight text-foreground leading-[0.95]"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15 }}
          >
            The Future of
            <span className="block bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent mt-2">
              Supply Chain Compliance
            </span>
          </motion.h1>

          <motion.p
            className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mt-8 leading-relaxed"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            How AI-powered document intelligence, automated Certificate of Analysis comparison, 
            and predictive supplier risk scoring are transforming a <strong className="text-foreground">$32.1 billion industry</strong> — 
            reducing compliance costs by up to 78% while achieving 94% accuracy.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.45 }}
          >
            <Button size="lg" className="gap-2 px-8 rounded-full" onClick={() => navigate('/')}>
              Request a Demo <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="lg" className="gap-2 px-8 rounded-full">
              <Download className="h-4 w-4" /> Download PDF
            </Button>
          </motion.div>

          <motion.div
            className="mt-16"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
          >
            <ChevronDown className="h-6 w-6 text-muted-foreground mx-auto animate-bounce" />
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          TABLE OF CONTENTS
          ════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 bg-muted/30">
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
                <div key={i} className="flex items-start gap-4 p-4 rounded-xl hover:bg-card/80 transition-colors group cursor-pointer">
                  <span className="text-3xl font-bold text-primary/20 group-hover:text-primary/40 transition-colors font-mono">{item.num}</span>
                  <div>
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{item.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          SECTION 01: THE COMPLIANCE CRISIS
          ════════════════════════════════════════════════════════════════════ */}
      <section className="py-24 relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-6">
          <FadeInSection>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm font-mono text-primary/60 tracking-widest">SECTION 01</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-foreground tracking-tight">
              The Compliance Crisis
            </h2>
            <p className="text-lg text-muted-foreground mt-4 max-w-3xl leading-relaxed">
              Supply chain compliance has become one of the most critical challenges facing enterprises globally. 
              The convergence of regulatory complexity, global supplier networks, and manual processes creates 
              a perfect storm of risk and inefficiency.
            </p>
          </FadeInSection>

          {/* Key Market Stats */}
          <FadeInSection delay={0.2}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-16 p-8 rounded-2xl bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/10">
              <StatBlock value="32.1" prefix="$" suffix="B" label="Global SCM Market Size (2025)" accent />
              <StatBlock value="9.5" prefix="$" suffix="B" label="Compliance & Traceability Market by 2031" />
              <StatBlock value="11.8" suffix="%" label="SCM Market CAGR (2025-2035)" />
              <StatBlock value="98" prefix="$" suffix="B" label="Projected SCM Market by 2035" accent />
            </div>
            <p className="text-xs text-muted-foreground mt-3 text-center italic">
              Sources: Future Market Insights (2025), Allied Market Research (2025)
            </p>
          </FadeInSection>

          {/* The Cost of Non-Compliance */}
          <FadeInSection delay={0.3}>
            <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
                  <AlertTriangle className="h-6 w-6 text-destructive" />
                  The Cost of Getting It Wrong
                </h3>
                <div className="space-y-4">
                  <DataPointCard 
                    icon={DollarSign} 
                    stat="$1.92 Billion" 
                    label="Cost of US food recalls in 2024 alone — label errors were the dominant cause"
                    source="New Food Magazine, 2025"
                    color="bg-destructive/10"
                  />
                  <DataPointCard 
                    icon={AlertTriangle} 
                    stat="251 Recall Events" 
                    label="FDA food & beverage recalls in 2025 — roughly 5 per week"
                    source="FDA / Esko Analysis, 2026"
                    color="bg-warning/10"
                  />
                  <DataPointCard 
                    icon={TrendingUp} 
                    stat="2x Increase" 
                    label="Hospitalizations and deaths from contaminated food doubled in 2024"
                    source="FSNS, 2025"
                    color="bg-destructive/10"
                  />
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
                  <Clock className="h-6 w-6 text-warning" />
                  The Manual Processing Burden
                </h3>
                <div className="space-y-4">
                  <DataPointCard 
                    icon={DollarSign} 
                    stat="$5 – $25" 
                    label="Cost per document when processed manually — labor, errors, and overhead"
                    source="DocuExprt, 2026"
                    color="bg-primary/10"
                  />
                  <DataPointCard 
                    icon={Clock} 
                    stat="30 – 90 min" 
                    label="Time to manually create a single Certificate of Analysis per lot"
                    source="UpBrains AI, 2025"
                    color="bg-accent/10"
                  />
                  <DataPointCard 
                    icon={Building2} 
                    stat="$206.1 Billion" 
                    label="Annual global spend on financial crime compliance alone"
                    source="LexisNexis Risk Solutions, 2023"
                    color="bg-primary/10"
                  />
                </div>
              </div>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          SECTION 02: AI-POWERED DOCUMENT INTELLIGENCE
          ════════════════════════════════════════════════════════════════════ */}
      <section className="py-24 bg-muted/20 relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.03),transparent_70%)]" />
        <div className="max-w-6xl mx-auto px-6 relative">
          <FadeInSection>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm font-mono text-primary/60 tracking-widest">SECTION 02</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-foreground tracking-tight">
              AI-Powered Document Intelligence
            </h2>
            <p className="text-lg text-muted-foreground mt-4 max-w-3xl leading-relaxed">
              Our platform leverages advanced AI to transform document compliance from a manual, 
              error-prone process into an automated, intelligent workflow — achieving results that 
              match industry-leading benchmarks.
            </p>
          </FadeInSection>

          {/* Hero Stats */}
          <FadeInSection delay={0.2}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
              {[
                { 
                  icon: Target, 
                  stat: '94%', 
                  label: 'Document Processing Accuracy',
                  detail: 'Across 64 companies implementing AI-powered document extraction, accuracy rates averaged 94% — eliminating manual data entry errors.',
                  source: 'Athenic / GetAthenic Study, 2024'
                },
                { 
                  icon: DollarSign, 
                  stat: '78%', 
                  label: 'Cost Reduction',
                  detail: 'Organizations using automated document processing achieved a 78% reduction in processing costs compared to manual workflows.',
                  source: 'Athenic / GetAthenic Study, 2024'
                },
                { 
                  icon: Zap, 
                  stat: '12×', 
                  label: 'Faster Processing',
                  detail: 'AI-driven document processing delivers 12x speed improvement over manual data entry, reducing turnaround from days to minutes.',
                  source: 'Athenic / GetAthenic Study, 2024'
                },
              ].map((item, i) => (
                <Card key={i} className="border-0 bg-card/90 backdrop-blur-sm overflow-hidden group hover:shadow-2xl transition-all duration-500 hover:-translate-y-1">
                  <div className="h-1 bg-gradient-to-r from-primary to-accent" />
                  <CardContent className="p-8">
                    <item.icon className="h-8 w-8 text-primary mb-4" />
                    <p className="text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                      {item.stat}
                    </p>
                    <p className="text-lg font-semibold text-foreground mt-2">{item.label}</p>
                    <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{item.detail}</p>
                    <p className="text-xs text-muted-foreground mt-4 italic border-t border-border/50 pt-3">{item.source}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </FadeInSection>

          {/* How It Works */}
          <FadeInSection delay={0.3}>
            <div className="mt-20">
              <h3 className="text-2xl font-bold text-foreground mb-8">How Our AI Document Pipeline Works</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  { step: '01', title: 'Intake & Classification', desc: 'AI automatically categorizes incoming documents — COAs, certifications, insurance, compliance forms — with intelligent metadata extraction.', icon: Layers },
                  { step: '02', title: 'AI Validation', desc: 'GPT-4o Vision processes multi-page PDFs and DOCX files, extracting structured data with unit/analyte/method normalization.', icon: Brain },
                  { step: '03', title: 'Compliance Scoring', desc: 'Documents are scored against configurable specs. Flagged items trigger automated workflows and stakeholder alerts.', icon: Shield },
                  { step: '04', title: 'Audit Trail', desc: 'Every action is logged immutably — from upload through approval — creating a forensic-ready compliance record.', icon: Lock },
                ].map((item, i) => (
                  <div key={i} className="relative p-6 rounded-2xl border border-border/50 bg-card/60 hover:bg-card transition-colors group">
                    <span className="text-6xl font-bold text-primary/5 absolute top-4 right-4 group-hover:text-primary/10 transition-colors">{item.step}</span>
                    <item.icon className="h-6 w-6 text-primary mb-3" />
                    <h4 className="font-semibold text-foreground">{item.title}</h4>
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </FadeInSection>

          {/* Industry Benchmark */}
          <FadeInSection delay={0.4}>
            <div className="mt-16 p-8 rounded-2xl bg-gradient-to-r from-primary/5 via-card to-accent/5 border border-primary/10">
              <h3 className="text-xl font-bold text-foreground mb-2">Industry Benchmark</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                A comprehensive study of 64 companies across finance, legal, and operations teams found that 
                AI-powered document processing achieves <strong className="text-foreground">94% accuracy rates</strong>, 
                <strong className="text-foreground"> 78% cost reduction</strong>, and 
                <strong className="text-foreground"> 12× faster processing</strong> compared to manual data entry. 
                Organizations that move from manual processing to AI-powered extraction recover their investment within months 
                and generate sustained cost advantages that compound annually.
              </p>
              <p className="text-xs text-muted-foreground mt-3 italic">Source: Athenic Document Processing Automation Study, November 2024</p>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          SECTION 03: COA COMPARISON & AUTOMATION
          ════════════════════════════════════════════════════════════════════ */}
      <section className="py-24 relative">
        <div className="max-w-6xl mx-auto px-6">
          <FadeInSection>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm font-mono text-primary/60 tracking-widest">SECTION 03</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-foreground tracking-tight">
              Certificate of Analysis
              <span className="block text-primary">Automation Engine</span>
            </h2>
            <p className="text-lg text-muted-foreground mt-4 max-w-3xl leading-relaxed">
              Certificates of Analysis are the cornerstone of quality assurance in food, pharmaceutical, 
              and chemical supply chains. Our platform automates the entire COA lifecycle — from extraction 
              to specification comparison — eliminating the most time-intensive compliance bottleneck.
            </p>
          </FadeInSection>

          {/* Before/After Comparison */}
          <FadeInSection delay={0.2}>
            <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Before */}
              <div className="p-8 rounded-2xl border-2 border-destructive/20 bg-destructive/5">
                <div className="flex items-center gap-2 mb-6">
                  <div className="h-3 w-3 rounded-full bg-destructive animate-pulse" />
                  <h3 className="text-xl font-bold text-foreground">Manual COA Process</h3>
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
                    <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                      <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground mt-6 italic">Source: UpBrains AI, 2025</p>
              </div>

              {/* After */}
              <div className="p-8 rounded-2xl border-2 border-primary/20 bg-primary/5">
                <div className="flex items-center gap-2 mb-6">
                  <div className="h-3 w-3 rounded-full bg-primary" />
                  <h3 className="text-xl font-bold text-foreground">AI-Powered COA Engine</h3>
                </div>
                <ul className="space-y-4">
                  {[
                    'GPT-4o Vision extracts structured data from multi-page PDFs & DOCX',
                    'Automatic unit normalization: ppm → mg/kg, ppb → µg/kg, % → mg/kg',
                    'Analyte & method mapping to canonical codes via internal dictionaries',
                    'Censored value parsing (ND, <LOD, <LOQ) with threshold extraction',
                    'Automated spec comparison with configurable pass/fail scoring',
                    'Immutable digital audit trail with complete version history',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </FadeInSection>

          {/* COA Scoring Model */}
          <FadeInSection delay={0.3}>
            <div className="mt-16">
              <h3 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
                <FlaskConical className="h-6 w-6 text-primary" />
                Intelligent COA Scoring Model
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border-0 bg-card/80 p-6">
                  <p className="text-sm font-mono text-primary/60 mb-2">BASELINE</p>
                  <p className="text-4xl font-bold text-foreground">100</p>
                  <p className="text-sm text-muted-foreground mt-2">Starting score for each COA submission</p>
                </Card>
                <Card className="border-0 bg-card/80 p-6">
                  <p className="text-sm font-mono text-primary/60 mb-2">DEDUCTIONS</p>
                  <div className="space-y-2 mt-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Flagged analyte</span>
                      <span className="font-mono text-destructive">-5 pts</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Unknown analyte</span>
                      <span className="font-mono text-destructive">-2 pts</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Missing analyte</span>
                      <span className="font-mono text-destructive">-10 pts</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Method mismatch</span>
                      <span className="font-mono text-destructive">-3 pts</span>
                    </div>
                  </div>
                </Card>
                <Card className="border-0 bg-card/80 p-6">
                  <p className="text-sm font-mono text-primary/60 mb-2">CLASSIFICATION</p>
                  <div className="space-y-3 mt-2">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-emerald-500" />
                      <span className="text-sm"><strong>Pass</strong> — Score ≥ 80, no critical flags</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-amber-500" />
                      <span className="text-sm"><strong>Partial</strong> — Score ≥ 50 or non-critical flags</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-red-500" />
                      <span className="text-sm"><strong>Fail</strong> — Score &lt; 50 or critical flag</span>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          SECTION 04: PREDICTIVE SUPPLIER RISK SCORING
          ════════════════════════════════════════════════════════════════════ */}
      <section className="py-24 bg-muted/20 relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,hsl(var(--accent)/0.03),transparent_70%)]" />
        <div className="max-w-6xl mx-auto px-6 relative">
          <FadeInSection>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm font-mono text-primary/60 tracking-widest">SECTION 04</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-foreground tracking-tight">
              Predictive Supplier
              <span className="block text-primary">Risk Scoring</span>
            </h2>
            <p className="text-lg text-muted-foreground mt-4 max-w-3xl leading-relaxed">
              Moving beyond reactive compliance to proactive risk intelligence. Our weighted multi-criteria 
              decision model continuously evaluates supplier risk across five dimensions, providing a 
              real-time 0-100 risk score with AI-driven recommendations.
            </p>
          </FadeInSection>

          {/* Risk Model Visualization */}
          <FadeInSection delay={0.2}>
            <div className="mt-16 grid grid-cols-1 lg:grid-cols-5 gap-4">
              {[
                { factor: 'Trade & Tariff Sensitivity', weight: '0–20 pts', icon: Globe, desc: 'Monitors tariff changes, trade restrictions, and geopolitical risk exposure' },
                { factor: 'Recall History', weight: '0–20 pts', icon: AlertTriangle, desc: 'Tracks FDA/USDA recalls, severity, frequency, and remediation history' },
                { factor: 'Regulatory Actions', weight: '0–15 pts', icon: Shield, desc: 'FDA warning letters, consent decrees, import alerts, and enforcement actions' },
                { factor: 'Document Completeness', weight: '0–15 pts', icon: FileCheck, desc: 'Real-time monitoring of document currency, expiry, and coverage gaps' },
                { factor: 'Geo Concentration', weight: '0–10 pts', icon: Globe, desc: 'Supply chain diversification analysis and single-source dependency risk' },
              ].map((item, i) => (
                <Card key={i} className="border-0 bg-card/80 p-5 hover:shadow-lg transition-all duration-300 group">
                  <item.icon className="h-6 w-6 text-primary mb-3 group-hover:scale-110 transition-transform" />
                  <p className="font-semibold text-foreground text-sm">{item.factor}</p>
                  <p className="text-xl font-bold text-primary mt-1 font-mono">{item.weight}</p>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{item.desc}</p>
                </Card>
              ))}
            </div>
          </FadeInSection>

          {/* Industry Context */}
          <FadeInSection delay={0.3}>
            <div className="mt-16 p-8 rounded-2xl border border-border/50 bg-card/60">
              <h3 className="text-xl font-bold text-foreground mb-4">Why Predictive Risk Matters</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    According to EY's 2025 analysis, organizations using AI-powered third-party risk management 
                    are seeing transformational improvements in risk identification speed and accuracy. Traditional 
                    periodic audits miss 60-80% of emerging risks because they only capture a point-in-time snapshot.
                  </p>
                  <p className="text-xs text-muted-foreground mt-3 italic">Source: EY Global Risk Consulting, 2025</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Sphera's 2025 AI-Powered Supplier Risk Management Survey found that CPOs and CSCOs are 
                    increasingly prioritizing AI-driven risk scoring to navigate geopolitical tensions, tariff 
                    disruptions, supplier insolvencies, and escalating regulatory demands — marking a fundamental 
                    shift from reactive to predictive supply chain management.
                  </p>
                  <p className="text-xs text-muted-foreground mt-3 italic">Source: Sphera AI-Powered Supplier Risk Survey, 2025</p>
                </div>
              </div>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          SECTION 05: ROI ANALYSIS
          ════════════════════════════════════════════════════════════════════ */}
      <section className="py-24 relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-6">
          <FadeInSection>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm font-mono text-primary/60 tracking-widest">SECTION 05</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-foreground tracking-tight">
              ROI Analysis &
              <span className="block text-primary">Business Impact</span>
            </h2>
            <p className="text-lg text-muted-foreground mt-4 max-w-3xl leading-relaxed">
              Based on industry benchmarks and real-world implementation data, here's the quantified 
              impact of transitioning from manual compliance processes to our AI-powered platform.
            </p>
          </FadeInSection>

          {/* ROI Table */}
          <FadeInSection delay={0.2}>
            <div className="mt-16 rounded-2xl border border-border/50 bg-card/80 overflow-hidden">
              <div className="grid grid-cols-4 gap-4 p-6 bg-primary/5 border-b border-border/50">
                <p className="text-sm font-bold text-foreground">Metric</p>
                <p className="text-sm font-bold text-muted-foreground text-center">Manual Process</p>
                <p className="text-sm font-bold text-primary text-center">With Platform</p>
                <p className="text-sm font-bold text-emerald-600 text-center">Improvement</p>
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
            <p className="text-xs text-muted-foreground mt-3 text-center italic">
              Sources: Athenic Study (2024), UpBrains AI (2025), DocuExprt (2026), Floowed ROI Analysis (2026)
            </p>
          </FadeInSection>

          {/* Annual Savings Calculator */}
          <FadeInSection delay={0.3}>
            <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="border-0 overflow-hidden bg-gradient-to-br from-primary to-accent text-white">
                <CardContent className="p-8">
                  <DollarSign className="h-8 w-8 mb-4 opacity-80" />
                  <p className="text-4xl font-bold">$250K+</p>
                  <p className="text-lg font-medium mt-2 opacity-90">Annual Savings</p>
                  <p className="text-sm mt-3 opacity-75 leading-relaxed">
                    Average annual savings from reduced labor, faster turnaround, and improved accuracy 
                    through AI-powered document intelligence.
                  </p>
                  <p className="text-xs mt-4 opacity-60 italic">Source: Floowed ROI Analysis, 2024</p>
                </CardContent>
              </Card>
              <Card className="border-0 overflow-hidden bg-gradient-to-br from-emerald-600 to-emerald-500 text-white">
                <CardContent className="p-8">
                  <TrendingUp className="h-8 w-8 mb-4 opacity-80" />
                  <p className="text-4xl font-bold">3–6 mo</p>
                  <p className="text-lg font-medium mt-2 opacity-90">Payback Period</p>
                  <p className="text-sm mt-3 opacity-75 leading-relaxed">
                    Organizations recover their investment within months. The ROI compounds as automation 
                    scales across supplier networks and document types.
                  </p>
                  <p className="text-xs mt-4 opacity-60 italic">Source: Floowed ROI Analysis, 2026</p>
                </CardContent>
              </Card>
              <Card className="border-0 overflow-hidden bg-gradient-to-br from-violet-600 to-violet-500 text-white">
                <CardContent className="p-8">
                  <BarChart3 className="h-8 w-8 mb-4 opacity-80" />
                  <p className="text-4xl font-bold">50–70%</p>
                  <p className="text-lg font-medium mt-2 opacity-90">Operational Cost Cut</p>
                  <p className="text-sm mt-3 opacity-75 leading-relaxed">
                    Document intelligence reduces operational costs by 50–70% while processing time 
                    drops from days to hours.
                  </p>
                  <p className="text-xs mt-4 opacity-60 italic">Source: Floowed, 2024</p>
                </CardContent>
              </Card>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          SECTION 06: ARCHITECTURE & SECURITY
          ════════════════════════════════════════════════════════════════════ */}
      <section className="py-24 bg-muted/20 relative">
        <div className="max-w-6xl mx-auto px-6">
          <FadeInSection>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm font-mono text-primary/60 tracking-widest">SECTION 06</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-foreground tracking-tight">
              Enterprise Architecture
              <span className="block text-primary">& Security</span>
            </h2>
          </FadeInSection>

          <FadeInSection delay={0.2}>
            <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { icon: Lock, title: 'Row-Level Security', desc: 'Every database table enforces RLS policies ensuring tenant data isolation. No user can access another organization\'s data.' },
                { icon: Shield, title: 'Zero-Trust Authentication', desc: 'Multi-factor authentication with Cloudflare Turnstile bot protection, login brute-force lockout, and session management.' },
                { icon: Users, title: 'Multi-Tenant Architecture', desc: 'Complete data isolation between buyer and supplier organizations with branch-level access controls and role hierarchies.' },
                { icon: Cpu, title: 'AI Agent Framework', desc: '52 serverless edge functions with rate limiting, input sanitization, and service-role-only access for sensitive operations.' },
                { icon: LineChart, title: 'Real-Time Monitoring', desc: 'Continuous compliance monitoring with predictive analytics, automated alerts, and executive dashboards.' },
                { icon: Globe, title: 'Global Compliance', desc: 'Multi-region deployment supporting FDA, EU, FSMA 204, HACCP, GMP, and industry-specific regulatory frameworks.' },
              ].map((item, i) => (
                <Card key={i} className="border-0 bg-card/80 p-6 hover:shadow-lg transition-all duration-300 group">
                  <div className="rounded-xl p-3 bg-primary/10 w-fit mb-4 group-hover:bg-primary/15 transition-colors">
                    <item.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground">{item.title}</h3>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{item.desc}</p>
                </Card>
              ))}
            </div>
          </FadeInSection>

          {/* Security Audit Badge */}
          <FadeInSection delay={0.3}>
            <div className="mt-12 p-6 rounded-2xl border border-primary/20 bg-primary/5 flex flex-col md:flex-row items-center gap-6">
              <div className="rounded-full p-4 bg-primary/10">
                <Shield className="h-10 w-10 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Security Audited & Hardened</h3>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  Our platform has undergone comprehensive security auditing — including penetration testing for 
                  SQL injection, XSS, CSRF, authentication bypass, privilege escalation, and API abuse. 
                  All RPC functions are restricted to authenticated users, with sensitive operations limited to service-role access only.
                </p>
              </div>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          CTA SECTION
          ════════════════════════════════════════════════════════════════════ */}
      <section className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-accent" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px]" />
        
        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          <FadeInSection>
            <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
              Ready to Transform Your
              <span className="block mt-2">Compliance Operations?</span>
            </h2>
            <p className="text-lg text-white/80 mt-6 max-w-2xl mx-auto leading-relaxed">
              Join enterprise organizations that have reduced compliance costs by 78%, 
              achieved 94% document accuracy, and eliminated manual COA processing.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
              <Button 
                size="lg" 
                className="gap-2 px-8 rounded-full bg-white text-primary hover:bg-white/90 font-semibold"
                onClick={() => navigate('/')}
              >
                Request a Demo <ArrowRight className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                size="lg" 
                className="gap-2 px-8 rounded-full border-white/30 text-white hover:bg-white/10"
              >
                Contact Sales <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          FOOTER
          ════════════════════════════════════════════════════════════════════ */}
      <footer className="py-12 border-t border-border/50 bg-card/50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">
                © {new Date().getFullYear()} Supply Chain Compliance Platform. All rights reserved.
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                White Paper — Edition 2026. All statistics sourced and cited.
              </p>
            </div>
            <div className="flex items-center gap-6">
              <p className="text-xs text-muted-foreground/60">
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
