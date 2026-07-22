import type { RiskEvent, RiskScore } from '@/features/supplier-risk/scoreApi';
import { RISK_DIMENSION_LABELS, RISK_DIMENSIONS, riskLevelOf, type RiskDimension } from '@/features/supplier-risk/templates';
import type { Supplier } from '@/hooks/useSuppliers';
import type { SupplierPerformance } from '@/hooks/useSupplierPerformance';
import type {
  DocumentItem,
  NewsSignal,
  RecallItem,
  RiskDriver,
  SupplierRiskProfile,
  WebSignal,
} from './riskData';

// Bridges the real risk engine (src/features/supplier-risk) into the templated
// SupplierRiskProfile the assessment page's components render. Children stay
// untouched; only the data source changes.

const fmtDate = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return '—'; }
};

const levelOf = riskLevelOf;

const confidenceBand = (c: number): 'High' | 'Medium' | 'Low' =>
  c >= 0.8 ? 'High' : c >= 0.5 ? 'Medium' : 'Low';

const severityBand = (s: number): 'Critical' | 'High' | 'Medium' | 'Low' =>
  s >= 80 ? 'Critical' : s >= 60 ? 'High' : s >= 40 ? 'Medium' : 'Low';

const OPEN_STATUSES = new Set(['active', 'under_review', 'open', 'new']);

export interface RealProfileInputs {
  supplier: Supplier;
  score: RiskScore | null;
  events: RiskEvent[];
  performance: SupplierPerformance | null;
  documents: DocumentItem[];
  connectedDate: string | null;
  facilities: number;
}

export function buildRealProfile({
  supplier, score, events, performance, documents, connectedDate, facilities,
}: RealProfileInputs): SupplierRiskProfile {
  const overall = score?.overall_score ?? 0;
  const prev = score?.previous_score ?? null;

  // Breakdown chips: the dimensions actually contributing, highest first.
  const breakdown = RISK_DIMENSIONS
    .map((d: RiskDimension) => ({ label: RISK_DIMENSION_LABELS[d], value: score?.dimension_scores[d] ?? 0 }))
    .filter((b) => b.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // "Explain score" bullets from the engine's own change reasons.
  const scoreExplanation = (score?.change_reasons ?? [])
    .map((r) => {
      const label = RISK_DIMENSION_LABELS[r.dimension as RiskDimension] ?? r.dimension;
      return `${label}: ${r.events} event${r.events === 1 ? '' : 's'} contributing ${r.score} point${r.score === 1 ? '' : 's'}.`;
    })
    .concat(score ? [`Computed deterministically by engine ${score.engine_version} on ${fmtDate(score.calculated_at)} — same inputs always produce the same score.`] : []);

  // Key drivers: one per contributing dimension, confidence from entity matching.
  const drivers: RiskDriver[] = breakdown.map((b) => {
    const dim = (Object.keys(RISK_DIMENSION_LABELS) as RiskDimension[])
      .find((d) => RISK_DIMENSION_LABELS[d] === b.label);
    const dimEvents = events.filter((e) => e.dimension === dim);
    const avgConf = dimEvents.length
      ? dimEvents.reduce((a, e) => a + (e.entity_match_confidence ?? 0), 0) / dimEvents.length
      : 0.9;
    return {
      description: `${b.label} signals`,
      impact: Math.max(1, Math.round(b.value / 10)),
      confidence: confidenceBand(avgConf),
      source: dimEvents.length ? `${dimEvents.length} monitored event${dimEvents.length === 1 ? '' : 's'}` : 'Risk engine',
    };
  });
  if (performance) {
    drivers.push({
      description: 'Document & submission performance',
      impact: Math.max(1, Math.round((performance.risk_score ?? 0) / 10)),
      confidence: 'High',
      source: 'Compliance engine',
    });
  }

  // Human-readable label for the origin feed of a cited signal.
  const sourceLabel = (e: RiskEvent): string => {
    switch (e.source_type) {
      case 'adverse_media': return 'Adverse media';
      case 'openfda_enforcement': return 'FDA enforcement';
      case 'cpsc_recall': return 'CPSC recall';
      case 'sanctions':
      case 'ofac_sanctions': return 'OFAC sanctions';
      default: return e.connector ? e.connector.replace(/^ingest-/, '').replace(/-/g, ' ') : 'Monitored feed';
    }
  };

  // Recalls tab = product-safety events; News tab = real adverse-media records;
  // Web Presence = the remaining (internal / engine) signals.
  const recalls: RecallItem[] = events
    .filter((e) => e.dimension === 'product_safety')
    .map((e) => ({
      eventType: e.source_title || e.event_type.replace(/_/g, ' '),
      date: e.source_published ? fmtDate(e.source_published) : fmtDate(e.detected_at),
      product: e.source_summary || `Entity match ${Math.round((e.entity_match_confidence ?? 0) * 100)}%`,
      severity: severityBand(e.severity),
      status: OPEN_STATUSES.has(e.status) ? 'Open' : 'Resolved',
      agency: sourceLabel(e),
      url: e.source_url ?? undefined,
    }));

  const news: NewsSignal[] = events
    .filter((e) => e.source_type === 'adverse_media')
    .map((e) => ({
      headline: e.source_title || e.event_type.replace(/_/g, ' '),
      source: sourceLabel(e),
      timestamp: e.source_published ? fmtDate(e.source_published) : fmtDate(e.detected_at),
      tags: [RISK_DIMENSION_LABELS[e.dimension] ?? e.dimension],
      riskImpact: Math.max(0, Math.round((e.severity ?? 0) * 10)),
      reason: e.source_summary || '',
      url: e.source_url ?? undefined,
    }));

  const webSignals: WebSignal[] = events
    .filter((e) => e.dimension !== 'product_safety' && e.source_type !== 'adverse_media')
    .map((e) => ({
      title: e.source_title || e.event_type.replace(/_/g, ' '),
      type: RISK_DIMENSION_LABELS[e.dimension] ?? e.dimension,
      confidence: confidenceBand(e.entity_match_confidence ?? 0),
      detail: `Severity ${e.severity} · detected ${fmtDate(e.detected_at)} · ${e.status.replace(/_/g, ' ')}`,
      url: e.source_url ?? undefined,
    }));

  return {
    id: supplier.id,
    name: supplier.company_name,
    hq: supplier.address || '—',
    industry: supplier.industry || 'General',
    industryDetail: 'Connected supplier',
    facilities,
    connectedDate: connectedDate ?? '—',
    score: overall,
    scoreLevel: levelOf(overall),
    trend: prev != null ? overall - prev : 0,
    trendData: [prev ?? overall, overall],
    breakdown,
    scoreExplanation: scoreExplanation.length
      ? scoreExplanation
      : ['No external risk score yet — use Recompute to generate one from current monitored events.'],
    drivers,
    news, // real adverse-media records (with source URLs) from the risk engine
    recalls,
    webSignals,
    documents,
    documentSubscore: performance?.risk_score ?? 0,
    monitoringSources: [
      'OFAC sanctions list (weekly scan)',
      'FDA & CPSC recall / enforcement feeds',
      'Compliance engine signals (15-minute scan)',
    ],
    nextRefresh: 'Connectors: weekly · compliance signals: every 15 min',
    operations: [],
    quality: [],
    riskResilience: [],
  };
}
