
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
].filter(industry => industry && industry.trim() !== '') as const;

export type Industry = typeof INDUSTRIES[number];
