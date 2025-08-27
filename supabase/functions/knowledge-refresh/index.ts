import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface RefreshRequest {
  mode: 'initial_population' | 'daily_refresh' | 'cleanup' | 'full_refresh';
  company_id?: string;
  company_type?: string;
}

async function callKnowledgePopulator(companyId: string, companyType: string, incremental: boolean = true): Promise<boolean> {
  try {
    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/knowledge-populator`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        company_id: companyId,
        company_type: companyType,
        incremental
      }),
    });

    if (!response.ok) {
      console.error(`Knowledge populator failed for company ${companyId}:`, await response.text());
      return false;
    }

    console.log(`Successfully refreshed knowledge for company ${companyId} (${companyType})`);
    return true;
  } catch (error) {
    console.error(`Error calling knowledge populator for company ${companyId}:`, error);
    return false;
  }
}

async function performInitialPopulation(): Promise<{ success: number; failed: number; total: number }> {
  console.log('Starting initial knowledge base population...');
  
  // Get all companies that need knowledge base population
  const { data: companies, error } = await supabase.rpc('get_companies_for_knowledge_refresh');
  
  if (error) {
    console.error('Error getting companies for refresh:', error);
    return { success: 0, failed: 0, total: 0 };
  }

  if (!companies || companies.length === 0) {
    console.log('No companies need knowledge base population');
    return { success: 0, failed: 0, total: 0 };
  }

  console.log(`Found ${companies.length} companies needing knowledge population`);
  
  let success = 0;
  let failed = 0;

  // Process companies in batches to avoid overwhelming the system
  const batchSize = 3;
  for (let i = 0; i < companies.length; i += batchSize) {
    const batch = companies.slice(i, i + batchSize);
    
    const promises = batch.map(company => 
      callKnowledgePopulator(company.company_id, company.company_type, false)
    );
    
    const results = await Promise.allSettled(promises);
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        success++;
      } else {
        failed++;
        console.error(`Failed to populate knowledge for company ${batch[index].company_name}`);
      }
    });

    // Add delay between batches to prevent overloading
    if (i + batchSize < companies.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log(`Initial population complete: ${success} successful, ${failed} failed out of ${companies.length} companies`);
  return { success, failed, total: companies.length };
}

async function performDailyRefresh(): Promise<{ success: number; failed: number; total: number }> {
  console.log('Starting daily knowledge base refresh...');
  
  // Get companies that have had document updates in the last 24 hours
  const { data: recentUpdates, error } = await supabase
    .from('document_uploads')
    .select(`
      document_requests!inner(
        buyer_id,
        supplier_id,
        buyers(id, company_name),
        suppliers(id, company_name)
      )
    `)
    .eq('status', 'approved')
    .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  if (error) {
    console.error('Error getting recent document updates:', error);
    return { success: 0, failed: 0, total: 0 };
  }

  if (!recentUpdates || recentUpdates.length === 0) {
    console.log('No recent document updates found');
    return { success: 0, failed: 0, total: 0 };
  }

  // Extract unique companies that need refresh
  const companiesToRefresh = new Map();
  
  recentUpdates.forEach(update => {
    const req = update.document_requests;
    
    if (req.buyer_id && req.buyers) {
      companiesToRefresh.set(`${req.buyer_id}-buyer`, {
        company_id: req.buyer_id,
        company_type: 'buyer',
        company_name: req.buyers.company_name
      });
    }
    
    if (req.supplier_id && req.suppliers) {
      companiesToRefresh.set(`${req.supplier_id}-supplier`, {
        company_id: req.supplier_id,
        company_type: 'supplier',
        company_name: req.suppliers.company_name
      });
    }
  });

  const companies = Array.from(companiesToRefresh.values());
  console.log(`Found ${companies.length} companies with recent updates to refresh`);

  let success = 0;
  let failed = 0;

  // Process in small batches
  const batchSize = 2;
  for (let i = 0; i < companies.length; i += batchSize) {
    const batch = companies.slice(i, i + batchSize);
    
    const promises = batch.map(company => 
      callKnowledgePopulator(company.company_id, company.company_type, true)
    );
    
    const results = await Promise.allSettled(promises);
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        success++;
      } else {
        failed++;
        console.error(`Failed to refresh knowledge for company ${batch[index].company_name}`);
      }
    });

    // Add delay between batches
    if (i + batchSize < companies.length) {
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }

  console.log(`Daily refresh complete: ${success} successful, ${failed} failed out of ${companies.length} companies`);
  return { success, failed, total: companies.length };
}

async function performCleanup(): Promise<{ deleted: number }> {
  console.log('Starting knowledge base cleanup...');
  
  const { data: deletedCount, error } = await supabase.rpc('cleanup_expired_knowledge_entries');
  
  if (error) {
    console.error('Error during cleanup:', error);
    return { deleted: 0 };
  }

  console.log(`Cleanup complete: ${deletedCount || 0} expired entries removed`);
  return { deleted: deletedCount || 0 };
}

async function performFullRefresh(): Promise<{ success: number; failed: number; total: number }> {
  console.log('Starting full knowledge base refresh...');
  
  // First, cleanup expired entries
  await performCleanup();
  
  // Then, get all companies with documents
  const { data: allCompanies, error } = await supabase
    .from('suppliers')
    .select('id, company_name')
    .then(async (supplierResult) => {
      if (supplierResult.error) throw supplierResult.error;
      
      const { data: buyers, error: buyerError } = await supabase
        .from('buyers')
        .select('id, company_name');
      
      if (buyerError) throw buyerError;
      
      const companies = [
        ...supplierResult.data.map(s => ({ ...s, company_type: 'supplier' })),
        ...buyers.map(b => ({ ...b, company_type: 'buyer' }))
      ];
      
      return { data: companies, error: null };
    });

  if (error) {
    console.error('Error getting all companies:', error);
    return { success: 0, failed: 0, total: 0 };
  }

  console.log(`Starting full refresh for ${allCompanies.length} companies`);

  let success = 0;
  let failed = 0;

  // Process in small batches with longer delays for full refresh
  const batchSize = 2;
  for (let i = 0; i < allCompanies.length; i += batchSize) {
    const batch = allCompanies.slice(i, i + batchSize);
    
    const promises = batch.map(company => 
      callKnowledgePopulator(company.id, company.company_type, false)
    );
    
    const results = await Promise.allSettled(promises);
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        success++;
      } else {
        failed++;
        console.error(`Failed to refresh knowledge for company ${batch[index].company_name}`);
      }
    });

    // Longer delay for full refresh to prevent overloading
    if (i + batchSize < allCompanies.length) {
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  console.log(`Full refresh complete: ${success} successful, ${failed} failed out of ${allCompanies.length} companies`);
  return { success, failed, total: allCompanies.length };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mode, company_id, company_type }: RefreshRequest = await req.json();
    
    console.log(`Knowledge refresh requested with mode: ${mode}`);
    
    let result;
    
    switch (mode) {
      case 'initial_population':
        result = await performInitialPopulation();
        break;
        
      case 'daily_refresh':
        result = await performDailyRefresh();
        break;
        
      case 'cleanup':
        result = await performCleanup();
        break;
        
      case 'full_refresh':
        result = await performFullRefresh();
        break;
        
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid refresh mode' }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        mode,
        result,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
    
  } catch (error) {
    console.error('Knowledge refresh error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});