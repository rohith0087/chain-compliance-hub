
export const INDUSTRIES = [
  'Technology',
  'Manufacturing', 
  'Healthcare',
  'Finance',
  'Retail',
  'Construction',
  'Food & Beverage',
  'Automotive',
  'Energy',
  'Education',
  'Agriculture',
  'Textiles',
  'Pharmaceuticals',
  'Logistics & Transportation',
  'Real Estate',
  'Poultry',
  'Auditor',
  'Auditee',
  'Sushi & Japanese Cuisine'
] as const;

// Filter out any potential empty values at runtime
export const VALID_INDUSTRIES = INDUSTRIES.filter(industry => 
  industry && industry.trim() !== ''
);

export type Industry = typeof INDUSTRIES[number];
