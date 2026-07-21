// Industry risk templates — the baseline weights a buyer starts from and tunes
// (see docs/supplier-risk-integration-plan.md, product.md §4). Weights are over
// the eight scored dimensions and should sum to ~1.0.

export type RiskLevel = 'High' | 'Medium' | 'Low';

/**
 * Canonical score -> band mapping. Higher score = higher risk (0-100).
 * This lived in three places (adapters.ts, SupplierRiskPanel.tsx, and the
 * dashboard was about to add a fourth); every surface must band identically or
 * the same supplier reads "High" on one screen and "Medium" on another.
 */
export function riskLevelOf(score: number): RiskLevel {
  return score >= 67 ? 'High' : score >= 34 ? 'Medium' : 'Low';
}

export const RISK_DIMENSIONS = [
  'regulatory',
  'product_safety',
  'labor_esg',
  'geopolitical',
  'operational',
  'financial',
  'legal',
  'cyber',
] as const;

export type RiskDimension = (typeof RISK_DIMENSIONS)[number];

export const RISK_DIMENSION_LABELS: Record<RiskDimension, string> = {
  regulatory: 'Regulatory & Sanctions',
  product_safety: 'Product Safety',
  labor_esg: 'Labor & ESG',
  geopolitical: 'Geopolitical',
  operational: 'Operational',
  financial: 'Financial',
  legal: 'Legal & Adverse Media',
  cyber: 'Cybersecurity',
};

export interface RiskTemplate {
  key: string;
  label: string;
  industry: string;
  dimensions: Record<RiskDimension, number>;
  critical_topics: string[];
}

export const RISK_TEMPLATES: RiskTemplate[] = [
  {
    key: 'footwear',
    label: 'Footwear / Consumer Goods',
    industry: 'footwear',
    dimensions: {
      labor_esg: 0.25,
      regulatory: 0.15,
      product_safety: 0.15,
      geopolitical: 0.15,
      operational: 0.1,
      financial: 0.1,
      legal: 0.05,
      cyber: 0.05,
    },
    critical_topics: ['uflpa', 'child_labor', 'restricted_chemicals', 'undisclosed_subcontracting'],
  },
  {
    key: 'food',
    label: 'Food / Co-packer',
    industry: 'food',
    dimensions: {
      product_safety: 0.3,
      regulatory: 0.25,
      operational: 0.2,
      labor_esg: 0.05,
      geopolitical: 0.05,
      financial: 0.05,
      legal: 0.05,
      cyber: 0.05,
    },
    critical_topics: ['product_recall', 'restricted_chemical', 'facility_safety'],
  },
  {
    key: 'pharma',
    label: 'Pharma / Medical Device',
    industry: 'pharma',
    dimensions: {
      product_safety: 0.3,
      regulatory: 0.25,
      operational: 0.15,
      financial: 0.1,
      labor_esg: 0.05,
      geopolitical: 0.05,
      legal: 0.05,
      cyber: 0.05,
    },
    critical_topics: ['product_recall', 'regulatory_enforcement', 'restricted_chemical'],
  },
];

export function templateByKey(key: string): RiskTemplate | undefined {
  return RISK_TEMPLATES.find((t) => t.key === key);
}

export function dimensionsSum(dimensions: Record<string, number>): number {
  return Object.values(dimensions).reduce((a, b) => a + (Number(b) || 0), 0);
}
