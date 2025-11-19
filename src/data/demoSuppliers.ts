/**
 * Static demo supplier and facility data for the map
 * This data is shown by default without needing database access
 */

export interface DemoSupplier {
  id: string;
  company_name: string;
  contact_email: string;
  industry: string;
  phone: string;
  address: string;
}

export interface DemoFacility {
  id: string;
  supplier_id: string;
  branch_name: string;
  address: string;
  location: 'headquarters' | 'distribution' | 'store';
  email: string;
  phone: string;
}

export const demoSuppliers: DemoSupplier[] = [
  {
    id: 'demo-hisho-sushi',
    company_name: 'HishōSushi',
    contact_email: 'info@hishosushi.com',
    industry: 'Food Service',
    phone: '(704) 555-0100',
    address: '11949 Steele Creek Road, Charlotte, NC 28273'
  },
  {
    id: 'demo-blue-ocean',
    company_name: 'Blue Ocean Seafood Co.',
    contact_email: 'info@blueoceanseafood.com',
    industry: 'Seafood',
    phone: '(206) 555-0200',
    address: '1200 Harbor Drive, Seattle, WA 98101'
  },
  {
    id: 'demo-atlantic-fresh',
    company_name: 'Atlantic Fresh Fish Market',
    contact_email: 'info@atlanticfresh.com',
    industry: 'Seafood',
    phone: '(617) 555-0400',
    address: '789 Ocean Avenue, Boston, MA 02110'
  }
];

export interface DemoBuyerBranch {
  id: string;
  branch_name: string;
  address: string;
  location: 'headquarters' | 'branch';
  email: string;
  phone: string;
}

export const demoBuyerBranches: DemoBuyerBranch[] = [
  {
    id: 'demo-buyer-elizabeth',
    branch_name: 'Elizabeth - Corporate HQ',
    address: 'Elizabeth, NJ',
    location: 'headquarters',
    email: 'hq@company.com',
    phone: '(908) 555-0100'
  },
  {
    id: 'demo-buyer-monticello',
    branch_name: 'Monticello Branch',
    address: 'Monticello, NY',
    location: 'branch',
    email: 'monticello@company.com',
    phone: '(845) 555-0200'
  },
  {
    id: 'demo-buyer-newhampton',
    branch_name: 'New Hampton Branch',
    address: 'New Hampton, IA',
    location: 'branch',
    email: 'newhampton@company.com',
    phone: '(641) 555-0300'
  },
  {
    id: 'demo-buyer-sherburne',
    branch_name: 'Sherburne Branch',
    address: 'Sherburne, NY',
    location: 'branch',
    email: 'sherburne@company.com',
    phone: '(607) 555-0400'
  }
];

export const demoFacilities: DemoFacility[] = [
  // HishōSushi facilities
  {
    id: 'demo-hisho-hq',
    supplier_id: 'demo-hisho-sushi',
    branch_name: 'HishōSushi - Corporate HQ',
    address: '11949 Steele Creek Road, Charlotte, NC 28273',
    location: 'headquarters',
    email: 'hq@hishosushi.com',
    phone: '(704) 555-0100'
  },
  {
    id: 'demo-hisho-troy-mein',
    supplier_id: 'demo-hisho-sushi',
    branch_name: 'HishōSushi - Troy University Mein Bowl',
    address: '117 Adams Center, Troy, AL 36082-0001',
    location: 'store',
    email: 'troy-mein@hishosushi.com',
    phone: '334-670-3454'
  },
  {
    id: 'demo-hisho-troy-sushi',
    supplier_id: 'demo-hisho-sushi',
    branch_name: 'HishōSushi - Troy University Sushi',
    address: '117 Adams Center, Troy, AL 36082-0001',
    location: 'store',
    email: 'troy-sushi@hishosushi.com',
    phone: '334-670-3454'
  },
  {
    id: 'demo-hisho-sprouts',
    supplier_id: 'demo-hisho-sushi',
    branch_name: 'HishōSushi - Sprouts Peachtree City',
    address: '2015 Highway 54, Peachtree City, GA 30269-1315',
    location: 'store',
    email: 'sprouts@hishosushi.com',
    phone: '678-586-2577'
  },
  
  // Blue Ocean Seafood facilities
  {
    id: 'demo-blue-hq',
    supplier_id: 'demo-blue-ocean',
    branch_name: 'Blue Ocean Seafood - Corporate HQ',
    address: '1200 Harbor Drive, Seattle, WA 98101',
    location: 'headquarters',
    email: 'hq@blueoceanseafood.com',
    phone: '(206) 555-0200'
  },
  {
    id: 'demo-blue-portland',
    supplier_id: 'demo-blue-ocean',
    branch_name: 'Blue Ocean Seafood - Portland Distribution',
    address: '4500 Industrial Parkway, Portland, OR 97203',
    location: 'distribution',
    email: 'portland@blueoceanseafood.com',
    phone: '(503) 555-0250'
  },
  {
    id: 'demo-blue-pike',
    supplier_id: 'demo-blue-ocean',
    branch_name: 'Blue Ocean Seafood - Pike Place Market',
    address: '85 Pike Street, Seattle, WA 98101',
    location: 'store',
    email: 'pikeplace@blueoceanseafood.com',
    phone: '(206) 555-0201'
  },
  {
    id: 'demo-blue-wharf',
    supplier_id: 'demo-blue-ocean',
    branch_name: 'Blue Ocean Seafood - Fisherman\'s Wharf',
    address: 'Pier 39, San Francisco, CA 94133',
    location: 'store',
    email: 'wharf@blueoceanseafood.com',
    phone: '(415) 555-0300'
  },
  
  // Atlantic Fresh Fish Market facilities
  {
    id: 'demo-atlantic-hq',
    supplier_id: 'demo-atlantic-fresh',
    branch_name: 'Atlantic Fresh - Corporate HQ',
    address: '789 Ocean Avenue, Boston, MA 02110',
    location: 'headquarters',
    email: 'hq@atlanticfresh.com',
    phone: '(617) 555-0400'
  },
  {
    id: 'demo-atlantic-newark',
    supplier_id: 'demo-atlantic-fresh',
    branch_name: 'Atlantic Fresh - Newark Distribution',
    address: '2100 Commerce Street, Newark, NJ 07102',
    location: 'distribution',
    email: 'newark@atlanticfresh.com',
    phone: '(973) 555-0450'
  },
  {
    id: 'demo-atlantic-quincy',
    supplier_id: 'demo-atlantic-fresh',
    branch_name: 'Atlantic Fresh - Quincy Market',
    address: '206 South Market Street, Boston, MA 02109',
    location: 'store',
    email: 'quincy@atlanticfresh.com',
    phone: '(617) 555-0401'
  },
  {
    id: 'demo-atlantic-chelsea',
    supplier_id: 'demo-atlantic-fresh',
    branch_name: 'Atlantic Fresh - Chelsea Market',
    address: '75 9th Avenue, New York, NY 10011',
    location: 'store',
    email: 'chelsea@atlanticfresh.com',
    phone: '(212) 555-0500'
  }
];
