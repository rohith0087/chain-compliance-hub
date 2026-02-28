import { supabase } from '@/integrations/supabase/client';
import logger from '@/utils/logger';

export async function addSampleSuppliers() {
  const sampleSuppliers = [
    {
      company_name: 'TechVision Solutions',
      contact_email: 'contact@techvision.com',
      industry: 'Technology',
      phone: '650-253-0000',
      address: '1600 Amphitheatre Parkway, Mountain View, CA 94043'
    },
    {
      company_name: 'CloudCore Systems',
      contact_email: 'info@cloudcore.com',
      industry: 'Technology',
      phone: '425-882-8080',
      address: '1 Microsoft Way, Redmond, WA 98052'
    },
    {
      company_name: 'Empire Realty Group',
      contact_email: 'sales@empirerealty.com',
      industry: 'Real Estate',
      phone: '212-736-3100',
      address: '350 5th Ave, New York, NY 10118'
    },
    {
      company_name: 'Skyline Construction Co',
      contact_email: 'contact@skylineco.com',
      industry: 'Construction',
      phone: '312-875-9696',
      address: '233 S Wacker Dr, Chicago, IL 60606'
    },
    {
      company_name: 'Lone Star Manufacturing',
      contact_email: 'info@lonestarmanuf.com',
      industry: 'Manufacturing',
      phone: '512-463-0063',
      address: '1100 Congress Ave, Austin, TX 78701'
    },
    {
      company_name: 'Pacific Hospitality Group',
      contact_email: 'reservations@pacifichg.com',
      industry: 'Hospitality',
      phone: '206-905-2100',
      address: '400 Broad St, Seattle, WA 98109'
    },
    {
      company_name: 'Sunshine Retail Partners',
      contact_email: 'sales@sunshineretail.com',
      industry: 'Retail',
      phone: '305-673-7714',
      address: '1001 Ocean Dr, Miami Beach, FL 33139'
    },
    {
      company_name: 'Rocky Mountain Supplies',
      contact_email: 'orders@rockymountain.com',
      industry: 'Manufacturing',
      phone: '303-405-4761',
      address: '320 W Colfax Ave, Denver, CO 80204'
    },
    {
      company_name: 'Atlantic Commerce Corp',
      contact_email: 'contact@atlanticcomm.com',
      industry: 'Retail',
      phone: '617-635-4505',
      address: '139 Tremont St, Boston, MA 02111'
    },
    {
      company_name: 'Desert Entertainment LLC',
      contact_email: 'bookings@desertent.com',
      industry: 'Entertainment',
      phone: '702-731-7110',
      address: '3355 S Las Vegas Blvd, Las Vegas, NV 89109'
    }
  ];

  const results = [];
  
  for (const supplier of sampleSuppliers) {
    // Check if supplier already exists
    const { data: existing } = await supabase
      .from('suppliers')
      .select('id')
      .eq('contact_email', supplier.contact_email)
      .single();
    
    if (!existing) {
      const { data, error } = await supabase
        .from('suppliers')
        .insert(supplier)
        .select()
        .single();
      
      if (error) {
        console.error(`Error adding ${supplier.company_name}:`, error);
        results.push({ success: false, company: supplier.company_name, error });
      } else {
        logger.debug(`Added ${supplier.company_name}`);
        results.push({ success: true, company: supplier.company_name, data });
      }
    } else {
      logger.debug(`${supplier.company_name} already exists, skipping`);
      results.push({ success: true, company: supplier.company_name, skipped: true });
    }
  }
  
  return results;
}

// Auto-run when imported in dev mode
if (import.meta.env.DEV) {
  logger.debug('Sample suppliers utility loaded. Call addSampleSuppliers() to add data.');
}
