export interface RiskDriver {
  description: string;
  impact: number;
  confidence: 'High' | 'Medium' | 'Low';
  source: string;
}

export interface NewsSignal {
  headline: string;
  source: string;
  timestamp: string;
  tags: string[];
  riskImpact: number;
  reason: string;
}

export interface RecallItem {
  eventType: string;
  date: string;
  product: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  status: 'Open' | 'Resolved';
  agency: string;
}

export interface WebSignal {
  title: string;
  type: string;
  confidence: 'High' | 'Medium' | 'Low';
  detail: string;
}

export interface DocumentItem {
  name: string;
  status: 'Approved' | 'Pending' | 'Expired';
  expiryDate: string;
}

export interface QuestionnaireAnswer {
  question: string;
  answer: string;
}

export interface SupplierRiskProfile {
  id: string;
  name: string;
  hq: string;
  industry: string;
  industryDetail: string;
  facilities: number;
  connectedDate: string;
  score: number;
  scoreLevel: 'High' | 'Medium' | 'Low';
  trend: number;
  trendData: number[];
  breakdown: { label: string; value: number }[];
  scoreExplanation: string[];
  drivers: RiskDriver[];
  news: NewsSignal[];
  recalls: RecallItem[];
  webSignals: WebSignal[];
  documents: DocumentItem[];
  documentSubscore: number;
  monitoringSources: string[];
  nextRefresh: string;
  operations: QuestionnaireAnswer[];
  quality: QuestionnaireAnswer[];
  riskResilience: QuestionnaireAnswer[];
}

export const suppliers: SupplierRiskProfile[] = [
  {
    id: 'blueriver',
    name: 'BlueRiver Co-Packers',
    hq: 'Shenzhen, China',
    industry: 'Food & Beverage',
    industryDetail: 'Co-packing',
    facilities: 4,
    connectedDate: 'Oct 12, 2025',
    score: 73,
    scoreLevel: 'High',
    trend: 8,
    trendData: [62, 64, 65, 68, 70, 71, 73],
    breakdown: [
      { label: 'Document Risk', value: 22 },
      { label: 'Operational Risk', value: 18 },
      { label: 'Regulatory Risk', value: 15 },
      { label: 'Market/Geo Risk', value: 12 },
      { label: 'Reputation Risk', value: 6 },
    ],
    scoreExplanation: [
      'Co-packing facilities in high-trade-risk regions (China, Mexico) contribute significantly to the geo-risk factor.',
      'Two product recalls within 3 years indicate elevated quality concerns.',
      'An open FDA warning letter adds regulatory pressure.',
      'Document completeness is below the 80% threshold recommended for this industry.',
      'Insurance coverage is adequate but below the recommended level for multi-region operations.',
    ],
    drivers: [
      { description: '2 recalls in last 3 years', impact: 12, confidence: 'High', source: 'FDA public recall database' },
      { description: 'Co-packers in High-Trade-Risk regions', impact: 10, confidence: 'High', source: 'Supplier questionnaire, geo-risk model' },
      { description: 'Open FDA warning letter detected', impact: 8, confidence: 'High', source: 'FDA Warning Letters database' },
      { description: 'Incomplete compliance program evidence', impact: 6, confidence: 'Medium', source: 'Document review, questionnaire' },
      { description: 'Insurance coverage below recommended threshold', impact: 4, confidence: 'Low', source: 'Supplier questionnaire' },
    ],
    news: [
      {
        headline: 'US announces increased tariff on packaging materials from China',
        source: 'Reuters',
        timestamp: '2h ago',
        tags: ['Tariffs', 'China', 'Packaging', 'Supply chain'],
        riskImpact: 10,
        reason: 'New tariff increase affects imported packaging inputs, increasing cost/availability risk for US-based buyers.',
      },
      {
        headline: 'FDA issues new guidance on co-packing facility inspections',
        source: 'FDA.gov',
        timestamp: '1d ago',
        tags: ['FDA', 'Compliance', 'Inspection'],
        riskImpact: 3,
        reason: 'Stricter inspection cadence may surface new non-conformances at supplier facilities.',
      },
      {
        headline: 'Port congestion in Shenzhen expected through Q2',
        source: 'Supply Chain Dive',
        timestamp: '3d ago',
        tags: ['Logistics', 'China', 'Delays'],
        riskImpact: 5,
        reason: 'Potential shipping delays from primary HQ region could disrupt delivery timelines.',
      },
    ],
    recalls: [
      { eventType: 'Voluntary Recall', date: 'Jan 15, 2026', product: 'Snack bars (allergen)', severity: 'High', status: 'Open', agency: 'FDA' },
      { eventType: 'Market Withdrawal', date: 'Aug 3, 2024', product: 'Beverage concentrate', severity: 'Medium', status: 'Resolved', agency: 'FDA' },
    ],
    webSignals: [
      { title: 'Litigation mention detected', type: 'Legal', confidence: 'Low', detail: 'Minor civil case referenced in county records; no material impact expected.' },
      { title: 'ESG controversy: none', type: 'ESG', confidence: 'High', detail: 'No ESG-related controversies found in public sources.' },
      { title: 'High employee turnover mentions', type: 'Workforce', confidence: 'Medium', detail: 'Glassdoor reviews indicate above-average turnover at manufacturing facilities.' },
    ],
    documents: [
      { name: 'GFSI Certificate', status: 'Approved', expiryDate: 'Dec 2026' },
      { name: 'Product Liability Insurance', status: 'Pending', expiryDate: 'Mar 2026' },
      { name: 'FDA Registration', status: 'Approved', expiryDate: 'Sep 2026' },
      { name: 'HACCP Plan', status: 'Expired', expiryDate: 'Nov 2025' },
      { name: 'Business Continuity Plan', status: 'Pending', expiryDate: 'N/A' },
    ],
    documentSubscore: 22,
    monitoringSources: ['FDA', 'CPSC', 'Public recalls', 'Sanctions list', 'News providers', 'Court records'],
    nextRefresh: '48 minutes',
    operations: [
      { question: 'Number of co-packers used', answer: '12' },
      { question: 'Countries where co-packers operate', answer: 'China, Mexico, Vietnam' },
      { question: 'Annual production volume range', answer: '50,000 – 100,000 units' },
      { question: 'Top 3 product categories', answer: 'Snack bars, Beverages, Supplements' },
      { question: 'Primary shipping lanes / ports', answer: 'Shenzhen → LA, Manzanillo → Houston' },
    ],
    quality: [
      { question: 'Standards followed', answer: 'GFSI, SQF, HACCP' },
      { question: 'Last audit date & type', answer: 'Sep 2025 — 3rd party (SGS)' },
      { question: 'Major non-conformances in last audit?', answer: 'Yes (1 — allergen control)' },
      { question: 'Allergen controls in place?', answer: 'Yes' },
      { question: 'Traceability time to lot-level', answer: '4 hours' },
      { question: 'CAPA process maturity', answer: 'Medium' },
    ],
    riskResilience: [
      { question: 'Recalls in last 1 year / 3 years', answer: '1 / 2' },
      { question: 'FDA warning letters in last 5 years?', answer: 'Yes (1)' },
      { question: 'Business continuity plan exists?', answer: 'Yes' },
      { question: 'Cybersecurity program tier', answer: 'Basic' },
      { question: 'Insurance coverage range', answer: '$2M – $5M' },
      { question: 'Single points of failure', answer: 'Primary packaging line in Shenzhen facility' },
      { question: 'Top 3 critical raw materials & origin', answer: 'Cocoa (Ghana), Whey protein (US), Flavoring (India)' },
    ],
  },
  {
    id: 'northpeak',
    name: 'NorthPeak Packaging',
    hq: 'Chicago, IL',
    industry: 'Packaging',
    industryDetail: 'Custom packaging & labeling',
    facilities: 2,
    connectedDate: 'Mar 5, 2025',
    score: 61,
    scoreLevel: 'Medium',
    trend: -3,
    trendData: [65, 64, 63, 63, 62, 61, 61],
    breakdown: [
      { label: 'Document Risk', value: 15 },
      { label: 'Operational Risk', value: 14 },
      { label: 'Regulatory Risk', value: 10 },
      { label: 'Market/Geo Risk', value: 8 },
      { label: 'Reputation Risk', value: 14 },
    ],
    scoreExplanation: [
      'Domestic-only operations reduce geo-risk, but a recent employee safety incident raised reputation concerns.',
      'ISO 9001 certification is current, but ISO 14001 (environmental) has lapsed.',
      'Document completeness is at 72%, slightly below the recommended 80% threshold.',
      'No recalls but pending OSHA investigation elevates operational risk.',
    ],
    drivers: [
      { description: 'Pending OSHA investigation', impact: 10, confidence: 'High', source: 'OSHA public records' },
      { description: 'Lapsed ISO 14001 environmental cert', impact: 8, confidence: 'High', source: 'Document review' },
      { description: 'Employee safety incident (Q4 2025)', impact: 7, confidence: 'Medium', source: 'News monitoring, OSHA' },
      { description: 'Single-facility concentration risk', impact: 5, confidence: 'Medium', source: 'Supplier questionnaire' },
    ],
    news: [
      {
        headline: 'OSHA opens investigation into packaging facility incident',
        source: 'Chicago Tribune',
        timestamp: '5d ago',
        tags: ['OSHA', 'Safety', 'Investigation'],
        riskImpact: 7,
        reason: 'Active OSHA investigation may result in operational disruption or fines.',
      },
    ],
    recalls: [],
    webSignals: [
      { title: 'Employee safety incident reported', type: 'Workforce', confidence: 'High', detail: 'Local news coverage of workplace injury at main facility.' },
      { title: 'ESG controversy: none', type: 'ESG', confidence: 'High', detail: 'No ESG-related controversies found.' },
    ],
    documents: [
      { name: 'ISO 9001 Certificate', status: 'Approved', expiryDate: 'Jul 2026' },
      { name: 'ISO 14001 Certificate', status: 'Expired', expiryDate: 'Aug 2025' },
      { name: 'General Liability Insurance', status: 'Approved', expiryDate: 'Jan 2027' },
      { name: 'W-9', status: 'Approved', expiryDate: 'N/A' },
    ],
    documentSubscore: 15,
    monitoringSources: ['OSHA', 'Public recalls', 'News providers', 'Court records'],
    nextRefresh: '2 hours',
    operations: [
      { question: 'Number of co-packers used', answer: '0 (direct manufacturer)' },
      { question: 'Countries where facilities operate', answer: 'United States' },
      { question: 'Annual production volume range', answer: '200,000 – 500,000 units' },
      { question: 'Top 3 product categories', answer: 'Corrugated boxes, Labels, Flexible packaging' },
      { question: 'Primary shipping lanes / ports', answer: 'Domestic trucking — Midwest hub' },
    ],
    quality: [
      { question: 'Standards followed', answer: 'ISO 9001' },
      { question: 'Last audit date & type', answer: 'Jun 2025 — Internal' },
      { question: 'Major non-conformances in last audit?', answer: 'No' },
      { question: 'Allergen controls in place?', answer: 'N/A' },
      { question: 'Traceability time to lot-level', answer: '2 hours' },
      { question: 'CAPA process maturity', answer: 'High' },
    ],
    riskResilience: [
      { question: 'Recalls in last 1 year / 3 years', answer: '0 / 0' },
      { question: 'FDA warning letters in last 5 years?', answer: 'No' },
      { question: 'Business continuity plan exists?', answer: 'Yes' },
      { question: 'Cybersecurity program tier', answer: 'Standard' },
      { question: 'Insurance coverage range', answer: '$5M – $10M' },
      { question: 'Single points of failure', answer: 'Single production facility' },
      { question: 'Top 3 critical raw materials & origin', answer: 'Corrugated board (US), Inks (US), Adhesives (US)' },
    ],
  },
  {
    id: 'greenfield',
    name: 'GreenField Ingredients',
    hq: 'Toronto, Canada',
    industry: 'Ingredients',
    industryDetail: 'Organic & specialty ingredients',
    facilities: 3,
    connectedDate: 'Jun 20, 2025',
    score: 38,
    scoreLevel: 'Low',
    trend: -2,
    trendData: [42, 41, 40, 40, 39, 38, 38],
    breakdown: [
      { label: 'Document Risk', value: 8 },
      { label: 'Operational Risk', value: 10 },
      { label: 'Regulatory Risk', value: 5 },
      { label: 'Market/Geo Risk', value: 8 },
      { label: 'Reputation Risk', value: 7 },
    ],
    scoreExplanation: [
      'Strong compliance posture with all major certifications current.',
      'Operations span US and Canada — both low geo-risk regions.',
      'No recalls or regulatory actions in the last 5 years.',
      'Document completeness is 95%, well above industry average.',
    ],
    drivers: [
      { description: 'Minor geographic concentration (2 regions)', impact: 5, confidence: 'Low', source: 'Supplier questionnaire' },
      { description: 'Organic certification renewal upcoming', impact: 4, confidence: 'Medium', source: 'Document tracker' },
      { description: 'Single-source for specialty botanical', impact: 3, confidence: 'Medium', source: 'Supplier questionnaire' },
    ],
    news: [],
    recalls: [],
    webSignals: [
      { title: 'ESG controversy: none', type: 'ESG', confidence: 'High', detail: 'No ESG-related controversies found.' },
      { title: 'Positive press: sustainability award', type: 'Reputation', confidence: 'High', detail: 'Received 2025 Sustainable Ingredients Award from Industry Association.' },
    ],
    documents: [
      { name: 'USDA Organic Certificate', status: 'Approved', expiryDate: 'Apr 2026' },
      { name: 'Non-GMO Project Verified', status: 'Approved', expiryDate: 'Jul 2026' },
      { name: 'SQF Certificate', status: 'Approved', expiryDate: 'Nov 2026' },
      { name: 'COI — General Liability', status: 'Approved', expiryDate: 'Feb 2027' },
      { name: 'Kosher Certificate', status: 'Approved', expiryDate: 'Dec 2026' },
    ],
    documentSubscore: 8,
    monitoringSources: ['FDA', 'CFIA', 'Public recalls', 'News providers'],
    nextRefresh: '1 hour',
    operations: [
      { question: 'Number of co-packers used', answer: '2' },
      { question: 'Countries where facilities operate', answer: 'United States, Canada' },
      { question: 'Annual production volume range', answer: '100,000 – 250,000 kg' },
      { question: 'Top 3 product categories', answer: 'Botanical extracts, Organic powders, Specialty oils' },
      { question: 'Primary shipping lanes / ports', answer: 'Domestic trucking — US/Canada cross-border' },
    ],
    quality: [
      { question: 'Standards followed', answer: 'SQF, HACCP, ISO 22000, USDA Organic' },
      { question: 'Last audit date & type', answer: 'Nov 2025 — 3rd party (NSF)' },
      { question: 'Major non-conformances in last audit?', answer: 'No' },
      { question: 'Allergen controls in place?', answer: 'Yes' },
      { question: 'Traceability time to lot-level', answer: '1 hour' },
      { question: 'CAPA process maturity', answer: 'High' },
    ],
    riskResilience: [
      { question: 'Recalls in last 1 year / 3 years', answer: '0 / 0' },
      { question: 'FDA warning letters in last 5 years?', answer: 'No' },
      { question: 'Business continuity plan exists?', answer: 'Yes' },
      { question: 'Cybersecurity program tier', answer: 'Advanced' },
      { question: 'Insurance coverage range', answer: '$10M+' },
      { question: 'Single points of failure', answer: 'Single-source for high-value botanical (Peru)' },
      { question: 'Top 3 critical raw materials & origin', answer: 'Maca root (Peru), Flaxseed (Canada), Turmeric (India)' },
    ],
  },
];
