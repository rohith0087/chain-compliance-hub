
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
  'Real Estate'
] as const;

export type Industry = typeof INDUSTRIES[number];
