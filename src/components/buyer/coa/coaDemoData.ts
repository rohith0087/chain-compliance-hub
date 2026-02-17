// Static demo data for COA Analysis feature

export interface COASpec {
  id: string;
  analyte_name: string;
  analyte_code: string;
  category: string;
  spec_min: number | null;
  spec_max: number | null;
  unit: string;
  method: string | null;
  acceptable_methods: string[];
  action_on_exceed: string;
  basis: string | null;
  is_active: boolean;
}

export interface COASchedule {
  id: string;
  supplier_name: string;
  supplier_id: string;
  frequency: string;
  next_due_date: string;
  last_submitted_date: string | null;
  grace_period_days: number;
  status: string;
  product_name: string | null;
  auto_remind: boolean;
}

export interface COAAnalyteResult {
  id: string;
  analyte_name: string;
  analyte_code: string;
  raw_value: string;
  numeric_value: number | null;
  is_censored: boolean;
  censored_type: string | null;
  raw_unit: string;
  normalized_unit: string;
  raw_method: string | null;
  normalized_method: string | null;
  spec_min: number | null;
  spec_max: number | null;
  status: 'pass' | 'fail' | 'flagged' | 'unknown_analyte';
  flag_reason: string | null;
  confidence: string;
  conversion_notes: string | null;
}

export interface COASubmission {
  id: string;
  supplier_name: string;
  supplier_id: string;
  lot_number: string | null;
  product_name: string | null;
  submission_date: string;
  analysis_status: string;
  overall_score: number | null;
  pass_fail: 'pass' | 'fail' | 'partial' | null;
  flags_count: number;
  analyte_results: COAAnalyteResult[];
}

export interface COAMethodEquivalency {
  id: string;
  analyte_code: string;
  method_a: string;
  method_b: string;
  rule_name: string;
  authority: string | null;
  is_active: boolean;
}

export interface COAPolicySettings {
  within_spec_is_match: boolean;
  censored_equivalent_is_match: boolean;
  require_basis_conversion: boolean;
  flag_non_convertible_units: boolean;
  auto_flag_unknown_analytes: boolean;
}

// Demo Specifications
export const demoSpecs: COASpec[] = [
  // Microbiological
  { id: '1', analyte_name: 'Salmonella', analyte_code: 'SALMONELLA', category: 'Microbiological', spec_min: null, spec_max: 0, unit: 'CFU/25g', method: 'ISO_6579', acceptable_methods: ['ISO_6579', 'AOAC_2016_02'], action_on_exceed: 'flag', basis: null, is_active: true },
  { id: '2', analyte_name: 'E. coli', analyte_code: 'E_COLI', category: 'Microbiological', spec_min: null, spec_max: 100, unit: 'CFU/g', method: 'ISO_16649', acceptable_methods: ['ISO_16649', 'AOAC_991_14'], action_on_exceed: 'flag', basis: null, is_active: true },
  { id: '3', analyte_name: 'Total Plate Count', analyte_code: 'TPC', category: 'Microbiological', spec_min: null, spec_max: 10000, unit: 'CFU/g', method: 'ISO_4833', acceptable_methods: ['ISO_4833'], action_on_exceed: 'flag', basis: null, is_active: true },
  { id: '4', analyte_name: 'Yeast & Mold', analyte_code: 'YEAST_MOLD', category: 'Microbiological', spec_min: null, spec_max: 500, unit: 'CFU/g', method: 'ISO_21527', acceptable_methods: ['ISO_21527'], action_on_exceed: 'flag', basis: null, is_active: true },
  { id: '5', analyte_name: 'Listeria monocytogenes', analyte_code: 'LISTERIA', category: 'Microbiological', spec_min: null, spec_max: 0, unit: 'CFU/25g', method: 'ISO_11290', acceptable_methods: ['ISO_11290', 'AOAC_2004_02'], action_on_exceed: 'flag', basis: null, is_active: true },
  { id: '6', analyte_name: 'Coliforms', analyte_code: 'COLIFORMS', category: 'Microbiological', spec_min: null, spec_max: 100, unit: 'CFU/g', method: 'ISO_4832', acceptable_methods: ['ISO_4832'], action_on_exceed: 'flag', basis: null, is_active: true },
  // Heavy Metals
  { id: '7', analyte_name: 'Lead', analyte_code: 'LEAD', category: 'Heavy Metals', spec_min: null, spec_max: 0.1, unit: 'mg/kg', method: 'ICP_MS', acceptable_methods: ['ICP_MS', 'ICP_OES'], action_on_exceed: 'flag', basis: 'as-is', is_active: true },
  { id: '8', analyte_name: 'Arsenic', analyte_code: 'ARSENIC', category: 'Heavy Metals', spec_min: null, spec_max: 0.5, unit: 'mg/kg', method: 'ICP_MS', acceptable_methods: ['ICP_MS'], action_on_exceed: 'flag', basis: 'as-is', is_active: true },
  { id: '9', analyte_name: 'Cadmium', analyte_code: 'CADMIUM', category: 'Heavy Metals', spec_min: null, spec_max: 0.1, unit: 'mg/kg', method: 'ICP_MS', acceptable_methods: ['ICP_MS', 'ICP_OES'], action_on_exceed: 'flag', basis: 'as-is', is_active: true },
  { id: '10', analyte_name: 'Mercury', analyte_code: 'MERCURY', category: 'Heavy Metals', spec_min: null, spec_max: 0.02, unit: 'mg/kg', method: 'ICP_MS', acceptable_methods: ['ICP_MS'], action_on_exceed: 'flag', basis: 'as-is', is_active: true },
  // Allergens
  { id: '11', analyte_name: 'Peanut', analyte_code: 'PEANUT', category: 'Allergens', spec_min: null, spec_max: 10, unit: 'ppm', method: 'ELISA', acceptable_methods: ['ELISA', 'PCR'], action_on_exceed: 'flag', basis: null, is_active: true },
  { id: '12', analyte_name: 'Gluten', analyte_code: 'GLUTEN', category: 'Allergens', spec_min: null, spec_max: 20, unit: 'ppm', method: 'ELISA', acceptable_methods: ['ELISA', 'R5_ELISA'], action_on_exceed: 'flag', basis: null, is_active: true },
  { id: '13', analyte_name: 'Milk', analyte_code: 'MILK', category: 'Allergens', spec_min: null, spec_max: 10, unit: 'ppm', method: 'ELISA', acceptable_methods: ['ELISA'], action_on_exceed: 'flag', basis: null, is_active: true },
  { id: '14', analyte_name: 'Soy', analyte_code: 'SOY', category: 'Allergens', spec_min: null, spec_max: 10, unit: 'ppm', method: 'ELISA', acceptable_methods: ['ELISA'], action_on_exceed: 'flag', basis: null, is_active: true },
  { id: '15', analyte_name: 'Sesame', analyte_code: 'SESAME', category: 'Allergens', spec_min: null, spec_max: 10, unit: 'ppm', method: 'ELISA', acceptable_methods: ['ELISA', 'PCR'], action_on_exceed: 'flag', basis: null, is_active: true },
];

// Demo Schedules
export const demoSchedules: COASchedule[] = [
  { id: 's1', supplier_name: 'BlueRiver Foods', supplier_id: 'sup1', frequency: 'monthly', next_due_date: '2026-03-01', last_submitted_date: '2026-02-01', grace_period_days: 3, status: 'active', product_name: 'Organic Flour Blend', auto_remind: true },
  { id: 's2', supplier_name: 'GreenLeaf Ingredients', supplier_id: 'sup2', frequency: 'quarterly', next_due_date: '2026-04-15', last_submitted_date: '2026-01-15', grace_period_days: 5, status: 'active', product_name: 'Sesame Seed Paste', auto_remind: true },
  { id: 's3', supplier_name: 'SunHarvest Commodities', supplier_id: 'sup3', frequency: 'per_lot', next_due_date: '2026-02-20', last_submitted_date: null, grace_period_days: 3, status: 'active', product_name: 'Raw Peanuts (Grade A)', auto_remind: true },
  { id: 's4', supplier_name: 'AquaPure Water Co.', supplier_id: 'sup4', frequency: 'monthly', next_due_date: '2026-02-10', last_submitted_date: '2026-01-10', grace_period_days: 3, status: 'overdue', product_name: 'Purified Water', auto_remind: true },
];

// Demo Submissions
export const demoSubmissions: COASubmission[] = [
  {
    id: 'sub1', supplier_name: 'BlueRiver Foods', supplier_id: 'sup1', lot_number: 'LOT-2026-0201', product_name: 'Organic Flour Blend', submission_date: '2026-02-01T10:30:00Z', analysis_status: 'completed', overall_score: 92, pass_fail: 'pass', flags_count: 1,
    analyte_results: [
      { id: 'r1', analyte_name: 'Salmonella', analyte_code: 'SALMONELLA', raw_value: 'ND', numeric_value: null, is_censored: true, censored_type: 'ND', raw_unit: 'CFU/25g', normalized_unit: 'CFU/25g', raw_method: 'ISO 6579:2017', normalized_method: 'ISO_6579', spec_min: null, spec_max: 0, status: 'pass', flag_reason: null, confidence: 'high', conversion_notes: null },
      { id: 'r2', analyte_name: 'E. coli', analyte_code: 'E_COLI', raw_value: '<10', numeric_value: 10, is_censored: true, censored_type: 'less_than_LOD', raw_unit: 'CFU/g', normalized_unit: 'CFU/g', raw_method: 'ISO 16649-2', normalized_method: 'ISO_16649', spec_min: null, spec_max: 100, status: 'pass', flag_reason: null, confidence: 'high', conversion_notes: null },
      { id: 'r3', analyte_name: 'Total Plate Count', analyte_code: 'TPC', raw_value: '4200', numeric_value: 4200, is_censored: false, censored_type: null, raw_unit: 'CFU/g', normalized_unit: 'CFU/g', raw_method: 'ISO 4833-1', normalized_method: 'ISO_4833', spec_min: null, spec_max: 10000, status: 'pass', flag_reason: null, confidence: 'high', conversion_notes: null },
      { id: 'r4', analyte_name: 'Lead', analyte_code: 'LEAD', raw_value: '0.08', numeric_value: 0.08, is_censored: false, censored_type: null, raw_unit: 'mg/kg', normalized_unit: 'mg/kg', raw_method: 'ICP-MS', normalized_method: 'ICP_MS', spec_min: null, spec_max: 0.1, status: 'pass', flag_reason: null, confidence: 'high', conversion_notes: null },
      { id: 'r5', analyte_name: 'Arsenic', analyte_code: 'ARSENIC', raw_value: '0.12', numeric_value: 0.12, is_censored: false, censored_type: null, raw_unit: 'mg/kg', normalized_unit: 'mg/kg', raw_method: 'ICP-MS', normalized_method: 'ICP_MS', spec_min: null, spec_max: 0.5, status: 'pass', flag_reason: null, confidence: 'high', conversion_notes: null },
      { id: 'r6', analyte_name: 'Gluten', analyte_code: 'GLUTEN', raw_value: '25', numeric_value: 25, is_censored: false, censored_type: null, raw_unit: 'ppm', normalized_unit: 'ppm', raw_method: 'R5 ELISA', normalized_method: 'R5_ELISA', spec_min: null, spec_max: 20, status: 'fail', flag_reason: 'Value 25 ppm exceeds spec max 20 ppm', confidence: 'high', conversion_notes: null },
      { id: 'r7', analyte_name: 'Aflatoxin B1', analyte_code: 'AFLATOXIN_B1', raw_value: '1.2', numeric_value: 1.2, is_censored: false, censored_type: null, raw_unit: 'µg/kg', normalized_unit: 'µg/kg', raw_method: 'HPLC', normalized_method: 'HPLC', spec_min: null, spec_max: null, status: 'unknown_analyte', flag_reason: 'Analyte not in buyer specifications', confidence: 'high', conversion_notes: null },
    ]
  },
  {
    id: 'sub2', supplier_name: 'GreenLeaf Ingredients', supplier_id: 'sup2', lot_number: 'GL-Q1-2026', product_name: 'Sesame Seed Paste', submission_date: '2026-01-15T14:00:00Z', analysis_status: 'completed', overall_score: 78, pass_fail: 'partial', flags_count: 3,
    analyte_results: [
      { id: 'r8', analyte_name: 'Salmonella', analyte_code: 'SALMONELLA', raw_value: 'Negative', numeric_value: null, is_censored: true, censored_type: 'ND', raw_unit: '/25g', normalized_unit: 'CFU/25g', raw_method: 'AOAC 2016.02', normalized_method: 'AOAC_2016_02', spec_min: null, spec_max: 0, status: 'pass', flag_reason: null, confidence: 'high', conversion_notes: 'Unit normalized from /25g to CFU/25g' },
      { id: 'r9', analyte_name: 'E. coli', analyte_code: 'E_COLI', raw_value: '150', numeric_value: 150, is_censored: false, censored_type: null, raw_unit: 'CFU/g', normalized_unit: 'CFU/g', raw_method: 'AOAC 991.14', normalized_method: 'AOAC_991_14', spec_min: null, spec_max: 100, status: 'fail', flag_reason: 'Value 150 CFU/g exceeds spec max 100 CFU/g', confidence: 'high', conversion_notes: null },
      { id: 'r10', analyte_name: 'Lead', analyte_code: 'LEAD', raw_value: '0.15', numeric_value: 0.15, is_censored: false, censored_type: null, raw_unit: 'ppm', normalized_unit: 'mg/kg', raw_method: 'ICP-OES', normalized_method: 'ICP_OES', spec_min: null, spec_max: 0.1, status: 'fail', flag_reason: 'Value 0.15 mg/kg exceeds spec max 0.1 mg/kg', confidence: 'high', conversion_notes: 'Converted ppm → mg/kg (1:1)' },
      { id: 'r11', analyte_name: 'Sesame', analyte_code: 'SESAME', raw_value: 'Present (expected)', numeric_value: null, is_censored: false, censored_type: null, raw_unit: '-', normalized_unit: '-', raw_method: null, normalized_method: null, spec_min: null, spec_max: null, status: 'flagged', flag_reason: 'Non-numeric value, manual review needed', confidence: 'low', conversion_notes: null },
      { id: 'r12', analyte_name: 'Mercury', analyte_code: 'MERCURY', raw_value: '<0.005', numeric_value: 0.005, is_censored: true, censored_type: 'less_than_LOD', raw_unit: 'mg/kg', normalized_unit: 'mg/kg', raw_method: 'ICP-MS', normalized_method: 'ICP_MS', spec_min: null, spec_max: 0.02, status: 'pass', flag_reason: null, confidence: 'high', conversion_notes: null },
    ]
  },
  {
    id: 'sub3', supplier_name: 'SunHarvest Commodities', supplier_id: 'sup3', lot_number: 'SH-PNT-0226', product_name: 'Raw Peanuts (Grade A)', submission_date: '2026-02-10T09:15:00Z', analysis_status: 'completed', overall_score: 45, pass_fail: 'fail', flags_count: 4,
    analyte_results: [
      { id: 'r13', analyte_name: 'Salmonella', analyte_code: 'SALMONELLA', raw_value: 'Detected', numeric_value: 1, is_censored: false, censored_type: null, raw_unit: 'CFU/25g', normalized_unit: 'CFU/25g', raw_method: 'ISO 6579', normalized_method: 'ISO_6579', spec_min: null, spec_max: 0, status: 'fail', flag_reason: 'CRITICAL: Salmonella detected in 25g sample', confidence: 'high', conversion_notes: null },
      { id: 'r14', analyte_name: 'Peanut', analyte_code: 'PEANUT', raw_value: 'Present (expected)', numeric_value: null, is_censored: false, censored_type: null, raw_unit: '-', normalized_unit: '-', raw_method: null, normalized_method: null, spec_min: null, spec_max: null, status: 'flagged', flag_reason: 'Expected allergen in product, informational', confidence: 'medium', conversion_notes: null },
      { id: 'r15', analyte_name: 'Lead', analyte_code: 'LEAD', raw_value: '0.22', numeric_value: 0.22, is_censored: false, censored_type: null, raw_unit: 'mg/kg', normalized_unit: 'mg/kg', raw_method: 'ICP-MS', normalized_method: 'ICP_MS', spec_min: null, spec_max: 0.1, status: 'fail', flag_reason: 'Value 0.22 mg/kg exceeds spec max 0.1 mg/kg (2.2x over limit)', confidence: 'high', conversion_notes: null },
      { id: 'r16', analyte_name: 'Cadmium', analyte_code: 'CADMIUM', raw_value: '0.09', numeric_value: 0.09, is_censored: false, censored_type: null, raw_unit: 'mg/kg', normalized_unit: 'mg/kg', raw_method: 'ICP-MS', normalized_method: 'ICP_MS', spec_min: null, spec_max: 0.1, status: 'pass', flag_reason: null, confidence: 'high', conversion_notes: null },
      { id: 'r17', analyte_name: 'Total Plate Count', analyte_code: 'TPC', raw_value: '18500', numeric_value: 18500, is_censored: false, censored_type: null, raw_unit: 'CFU/g', normalized_unit: 'CFU/g', raw_method: 'ISO 4833', normalized_method: 'ISO_4833', spec_min: null, spec_max: 10000, status: 'fail', flag_reason: 'Value 18,500 CFU/g exceeds spec max 10,000 CFU/g', confidence: 'high', conversion_notes: null },
    ]
  },
];

// Demo Method Equivalencies
export const demoMethodEquivalencies: COAMethodEquivalency[] = [
  { id: 'me1', analyte_code: 'SALMONELLA', method_a: 'ISO_6579', method_b: 'AOAC_2016_02', rule_name: 'Salmonella ISO/AOAC Equivalence', authority: 'FDA', is_active: true },
  { id: 'me2', analyte_code: 'E_COLI', method_a: 'ISO_16649', method_b: 'AOAC_991_14', rule_name: 'E.coli ISO/AOAC Equivalence', authority: 'Internal', is_active: true },
  { id: 'me3', analyte_code: 'LEAD', method_a: 'ICP_MS', method_b: 'ICP_OES', rule_name: 'Lead ICP-MS/OES Equivalence', authority: 'Internal', is_active: true },
];

// Demo Policy Settings
export const demoPolicySettings: COAPolicySettings = {
  within_spec_is_match: true,
  censored_equivalent_is_match: true,
  require_basis_conversion: false,
  flag_non_convertible_units: true,
  auto_flag_unknown_analytes: true,
};

// Spec Templates
export const specTemplates = {
  microbiological: {
    name: 'Microbiological Panel',
    description: 'Standard food safety microbiological testing panel',
    specs: [
      { analyte_name: 'Salmonella', analyte_code: 'SALMONELLA', category: 'Microbiological', spec_max: 0, unit: 'CFU/25g', method: 'ISO_6579' },
      { analyte_name: 'E. coli', analyte_code: 'E_COLI', category: 'Microbiological', spec_max: 100, unit: 'CFU/g', method: 'ISO_16649' },
      { analyte_name: 'Total Plate Count', analyte_code: 'TPC', category: 'Microbiological', spec_max: 10000, unit: 'CFU/g', method: 'ISO_4833' },
      { analyte_name: 'Yeast & Mold', analyte_code: 'YEAST_MOLD', category: 'Microbiological', spec_max: 500, unit: 'CFU/g', method: 'ISO_21527' },
      { analyte_name: 'Listeria monocytogenes', analyte_code: 'LISTERIA', category: 'Microbiological', spec_max: 0, unit: 'CFU/25g', method: 'ISO_11290' },
      { analyte_name: 'Coliforms', analyte_code: 'COLIFORMS', category: 'Microbiological', spec_max: 100, unit: 'CFU/g', method: 'ISO_4832' },
    ]
  },
  heavyMetals: {
    name: 'Heavy Metals Panel',
    description: 'Standard heavy metals contaminant testing panel',
    specs: [
      { analyte_name: 'Lead', analyte_code: 'LEAD', category: 'Heavy Metals', spec_max: 0.1, unit: 'mg/kg', method: 'ICP_MS' },
      { analyte_name: 'Arsenic', analyte_code: 'ARSENIC', category: 'Heavy Metals', spec_max: 0.5, unit: 'mg/kg', method: 'ICP_MS' },
      { analyte_name: 'Cadmium', analyte_code: 'CADMIUM', category: 'Heavy Metals', spec_max: 0.1, unit: 'mg/kg', method: 'ICP_MS' },
      { analyte_name: 'Mercury', analyte_code: 'MERCURY', category: 'Heavy Metals', spec_max: 0.02, unit: 'mg/kg', method: 'ICP_MS' },
    ]
  },
  allergens: {
    name: 'Allergen Panel',
    description: 'Major food allergens testing panel (Big 9)',
    specs: [
      { analyte_name: 'Peanut', analyte_code: 'PEANUT', category: 'Allergens', spec_max: 10, unit: 'ppm', method: 'ELISA' },
      { analyte_name: 'Tree Nuts', analyte_code: 'TREE_NUTS', category: 'Allergens', spec_max: 10, unit: 'ppm', method: 'ELISA' },
      { analyte_name: 'Milk', analyte_code: 'MILK', category: 'Allergens', spec_max: 10, unit: 'ppm', method: 'ELISA' },
      { analyte_name: 'Soy', analyte_code: 'SOY', category: 'Allergens', spec_max: 10, unit: 'ppm', method: 'ELISA' },
      { analyte_name: 'Wheat/Gluten', analyte_code: 'GLUTEN', category: 'Allergens', spec_max: 20, unit: 'ppm', method: 'ELISA' },
      { analyte_name: 'Egg', analyte_code: 'EGG', category: 'Allergens', spec_max: 10, unit: 'ppm', method: 'ELISA' },
      { analyte_name: 'Fish', analyte_code: 'FISH', category: 'Allergens', spec_max: 10, unit: 'ppm', method: 'ELISA' },
      { analyte_name: 'Shellfish', analyte_code: 'SHELLFISH', category: 'Allergens', spec_max: 10, unit: 'ppm', method: 'ELISA' },
      { analyte_name: 'Sesame', analyte_code: 'SESAME', category: 'Allergens', spec_max: 10, unit: 'ppm', method: 'ELISA' },
    ]
  }
};
