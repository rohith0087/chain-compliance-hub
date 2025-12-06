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

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

// Create embeddings for text
async function createEmbedding(text: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });

  const data = await response.json();
  return data.data[0].embedding;
}

// Populate knowledge base with document metadata and analysis
async function populateDocumentInsights(companyId: string, companyType: string): Promise<void> {
  try {
    // Get document uploads with detailed metadata
    let documentsQuery = supabase
      .from('document_uploads')
      .select(`
        id,
        file_name,
        status,
        expiration_date,
        file_path,
        created_at,
        request_id,
        document_requests!inner(
          title,
          document_type,
          supplier_id,
          buyer_id,
          suppliers(company_name, industry),
          buyers(company_name, industry)
        )
      `);

    if (companyType === 'buyer') {
      documentsQuery = documentsQuery.eq('document_requests.buyer_id', companyId);
    } else {
      documentsQuery = documentsQuery.eq('document_requests.supplier_id', companyId);
    }

    const { data: documents } = await documentsQuery.limit(50);
    if (!documents) return;

    for (const doc of documents) {
      const request = doc.document_requests;
      const supplier = request?.suppliers;
      const buyer = request?.buyers;
      
      // Create comprehensive document knowledge entry
      const content = `
Document Information:
- Document Name: ${doc.file_name}
- Document Type: ${request?.document_type || 'Unknown'}
- Status: ${doc.status}
- Supplier: ${supplier?.company_name || 'Unknown'}
- Buyer: ${buyer?.company_name || 'Unknown'}
- Industry: ${supplier?.industry || buyer?.industry || 'General'}
- Upload Date: ${new Date(doc.created_at).toLocaleDateString()}
- Expiration Date: ${doc.expiration_date ? new Date(doc.expiration_date).toLocaleDateString() : 'No expiration set'}
- Request Title: ${request?.title || 'N/A'}
- Current Status: ${doc.status}
- File Path: ${doc.file_path}

Key Compliance Points:
- Document is ${doc.status === 'approved' ? 'APPROVED and compliant' : doc.status === 'pending_review' ? 'UNDER REVIEW' : 'NEEDS ATTENTION'}
- ${doc.expiration_date ? `Expires on ${new Date(doc.expiration_date).toLocaleDateString()}` : 'No expiration tracking'}
- Related to ${request?.document_type} compliance for ${supplier?.company_name || 'supplier'}
      `.trim();

      const title = `${doc.file_name} - ${supplier?.company_name || 'Document'}`;
      const embedding = await createEmbedding(content);

      await supabase
        .from('ai_knowledge_entries')
        .upsert({
          company_id: companyId,
          company_type: companyType,
          entry_type: 'document_metadata',
          title,
          content,
          embedding: `[${embedding.join(',')}]`,
          metadata: {
            document_id: doc.id,
            document_type: request?.document_type,
            supplier_name: supplier?.company_name,
            buyer_name: buyer?.company_name,
            status: doc.status,
            expiration_date: doc.expiration_date,
            file_path: doc.file_path
          },
          source_reference: `document:${doc.id}`,
          relevance_tags: [
            'documents', 
            'compliance', 
            request?.document_type?.toLowerCase() || 'general',
            supplier?.company_name?.toLowerCase().replace(/\s+/g, '_') || 'unknown',
            doc.status
          ]
        });
    }

    // Also get recent agent activities for analysis insights
    const { data: activities } = await supabase
      .from('agent_activities')
      .select('*')
      .eq('entity_id', companyId)
      .eq('entity_type', companyType)
      .eq('success', true)
      .neq('details', null)
      .order('created_at', { ascending: false })
      .limit(10);

    if (activities) {
      for (const activity of activities) {
        const details = activity.details || {};
        
        const content = `
AI Analysis Insight:
- Analysis Type: ${activity.action_type}
- Agent: ${activity.agent_type}
- Confidence Score: ${activity.confidence_score || 'N/A'}
- Success: ${activity.success ? 'Yes' : 'No'}
- Reasoning: ${activity.reasoning || 'No reasoning provided'}
- Processing Details: ${JSON.stringify(details)}
- Analysis Date: ${new Date(activity.created_at).toLocaleDateString()}

This analysis provides insights into document processing and compliance patterns.
        `.trim();

        const title = `AI Analysis: ${activity.action_type} - ${new Date(activity.created_at).toLocaleDateString()}`;
        const embedding = await createEmbedding(content);

        await supabase
          .from('ai_knowledge_entries')
          .upsert({
            company_id: companyId,
            company_type: companyType,
            entry_type: 'agent_insights',
            title,
            content,
            embedding: `[${embedding.join(',')}]`,
            metadata: {
              activity_id: activity.id,
              agent_type: activity.agent_type,
              confidence_score: activity.confidence_score
            },
            source_reference: `agent_activity:${activity.id}`,
            relevance_tags: ['ai_analysis', 'document_processing', activity.action_type]
          });
      }
    }

    console.log(`Populated ${documents.length} document entries and ${activities?.length || 0} AI insights for ${companyType} ${companyId}`);
  } catch (error) {
    console.error('Error populating document insights:', error);
  }
}

// Populate industry-specific compliance guides
async function populateComplianceGuides(companyId: string, companyType: string, industry?: string): Promise<void> {
  const complianceGuides = {
    agriculture: [
      {
        title: "Agricultural Product Safety Documentation",
        content: "Essential documents for agricultural compliance include: Organic certification, Pesticide usage logs, Soil testing reports, Harvest documentation, Storage facility inspections, and Supply chain traceability records. All documents must be current and meet regulatory standards.",
        tags: ['agriculture', 'safety', 'organic', 'certification']
      },
      {
        title: "Food Safety Modernization Act (FSMA) Requirements",
        content: "Under FSMA, agricultural suppliers must maintain: Preventive controls plans, Hazard analysis documentation, Supplier verification programs, Traceability records, and FDA facility registration. Regular updates and training documentation are also required.",
        tags: ['agriculture', 'fsma', 'fda', 'food_safety']
      }
    ],
    electronics: [
      {
        title: "Electronics Compliance Documentation",
        content: "Key compliance documents for electronics include: CE marking certificates, FCC authorization, RoHS compliance statements, REACH declarations, UL certification, and Environmental management certificates. All must be valid and regularly updated.",
        tags: ['electronics', 'ce_marking', 'fcc', 'rohs', 'reach']
      },
      {
        title: "Electronic Waste and Environmental Compliance",
        content: "Electronics suppliers must provide: WEEE compliance certificates, Material composition reports, Conflict minerals declarations, Energy efficiency documentation, and End-of-life disposal plans. Environmental impact assessments may also be required.",
        tags: ['electronics', 'environmental', 'weee', 'conflict_minerals']
      }
    ],
    manufacturing: [
      {
        title: "Manufacturing Quality Standards",
        content: "Manufacturing compliance requires: ISO 9001 quality certificates, Production process documentation, Material testing reports, Equipment calibration certificates, Worker safety training records, and Environmental compliance statements.",
        tags: ['manufacturing', 'iso_9001', 'quality', 'safety']
      },
      {
        title: "Supply Chain and Traceability Documentation",
        content: "Manufacturers must maintain: Supplier qualification records, Material traceability documentation, Production batch records, Quality control test results, and Chain of custody documentation. Regular audits and certifications are essential.",
        tags: ['manufacturing', 'supply_chain', 'traceability', 'quality_control']
      }
    ]
  };

  const guides = complianceGuides[industry as keyof typeof complianceGuides] || complianceGuides.manufacturing;

  for (const guide of guides) {
    try {
      const embedding = await createEmbedding(guide.content);

      await supabase
        .from('ai_knowledge_entries')
        .upsert({
          company_id: companyId,
          company_type: companyType,
          entry_type: 'compliance_guide',
          title: guide.title,
          content: guide.content,
          embedding: `[${embedding.join(',')}]`,
          metadata: {
            industry: industry || 'general',
            guide_type: 'compliance'
          },
          industry_context: industry || 'general',
          relevance_tags: guide.tags
        });
    } catch (error) {
      console.error(`Error adding guide ${guide.title}:`, error);
    }
  }

  console.log(`Populated ${guides.length} compliance guides for ${industry || 'general'} industry`);
}

// Main function to populate knowledge base
async function populateKnowledgeBase(companyId: string, companyType: string): Promise<void> {
  try {
    // Get company info to determine industry
    let industry = 'general';
    
    if (companyType === 'buyer') {
      const { data: buyer } = await supabase
        .from('buyers')
        .select('industry')
        .eq('id', companyId)
        .single();
      industry = buyer?.industry || 'general';
    } else {
      const { data: supplier } = await supabase
        .from('suppliers')
        .select('industry')
        .eq('id', companyId)
        .single();
      industry = supplier?.industry || 'general';
    }

    // Populate different types of knowledge
    await Promise.all([
      populateDocumentInsights(companyId, companyType),
      populateComplianceGuides(companyId, companyType, industry)
    ]);

    console.log(`Knowledge base population completed for ${companyType} ${companyId}`);
  } catch (error) {
    console.error('Error populating knowledge base:', error);
    throw error;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate authentication
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      console.error('Authentication failed:', userErr);
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Knowledge population initiated by user: ${userData.user.id}`);

    const { company_id, company_type, incremental = false } = await req.json();

    if (!company_id || !company_type) {
      throw new Error('company_id and company_type are required');
    }

    console.log(`Populating knowledge base for company: ${company_id} (${company_type}), incremental: ${incremental}`);
    
    // If incremental update, check if recent knowledge entries exist
    if (incremental) {
      const { data: recentEntries } = await supabase
        .from('ai_knowledge_entries')
        .select('id')
        .eq('company_id', company_id)
        .eq('company_type', company_type)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(1);
      
      if (recentEntries && recentEntries.length > 0) {
        console.log(`Skipping incremental update - recent entries exist for company ${company_id}`);
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: `Knowledge base already up to date for company ${company_id}`,
            timestamp: new Date().toISOString(),
            skipped: true
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    await populateKnowledgeBase(company_id, company_type);

    return new Response(JSON.stringify({
      success: true,
      message: `Knowledge base populated for ${company_type} ${company_id}`,
      timestamp: new Date().toISOString(),
      incremental
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Knowledge populator error:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});