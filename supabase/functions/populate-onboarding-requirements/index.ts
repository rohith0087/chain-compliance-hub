import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/corsHeaders.ts";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Industry-specific templates (simplified version)
const COMMON_DOCUMENTS = [
  {
    document_type: 'business_license',
    document_name: 'Business License',
    description: 'Valid business registration or operating license',
    is_required: true
  },
  {
    document_type: 'insurance_certificate',
    document_name: 'Insurance Certificate',
    description: 'General liability insurance certificate',
    is_required: true
  },
  {
    document_type: 'tax_certificate',
    document_name: 'Tax Certificate',
    description: 'Tax identification or exemption certificate',
    is_required: true
  }
];

const COMMON_FORM_FIELDS = [
  {
    field_type: 'text',
    field_label: 'Primary Contact Person',
    field_description: 'Name of the main contact for business matters',
    is_required: true,
    field_order: 1
  },
  {
    field_type: 'email',
    field_label: 'Business Email',
    field_description: 'Primary business email address',
    is_required: true,
    field_order: 2
  },
  {
    field_type: 'phone',
    field_label: 'Business Phone',
    field_description: 'Primary business phone number',
    is_required: true,
    field_order: 3
  },
  {
    field_type: 'textarea',
    field_label: 'Company Capabilities',
    field_description: 'Brief description of your products/services and key capabilities',
    is_required: true,
    field_order: 4
  }
];

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ============================================
    // Auth validation
    // ============================================
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Invalid authentication:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authenticated user:', user.id, user.email);

    const { onboarding_request_id } = await req.json();

    console.log('Populating requirements for onboarding request:', onboarding_request_id);

    if (!onboarding_request_id) {
      throw new Error('onboarding_request_id is required');
    }

    // Get the onboarding request
    const { data: request, error: requestError } = await supabase
      .from('supplier_onboarding_requests')
      .select('*')
      .eq('id', onboarding_request_id)
      .single();

    if (requestError || !request) {
      console.error('Failed to fetch onboarding request:', requestError);
      throw new Error('Onboarding request not found');
    }

    // ============================================
    // Validate user has access to the buyer company
    // ============================================
    let hasAccess = false;

    // Check if user is buyer owner
    const { data: buyer } = await supabase
      .from('buyers')
      .select('id, industry')
      .eq('profile_id', user.id)
      .eq('id', request.buyer_id)
      .single();
    
    if (buyer) {
      hasAccess = true;
    } else {
      // Check if user is team member
      const { data: companyUser } = await supabase
        .from('company_users')
        .select('id')
        .eq('profile_id', user.id)
        .eq('company_id', request.buyer_id)
        .eq('company_type', 'buyer')
        .eq('status', 'active')
        .single();

      if (companyUser) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      console.error('User does not have access to buyer:', request.buyer_id);
      return new Response(
        JSON.stringify({ error: 'Unauthorized: No access to this onboarding request' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get buyer's industry if not already fetched
    let buyerIndustry = buyer?.industry;
    if (!buyerIndustry) {
      const { data: buyerData } = await supabase
        .from('buyers')
        .select('industry')
        .eq('id', request.buyer_id)
        .single();
      buyerIndustry = buyerData?.industry;
    }

    console.log('Found request for buyer industry:', buyerIndustry);

    // Check if requirements already exist
    const { data: existingDocs } = await supabase
      .from('onboarding_document_requirements')
      .select('id')
      .eq('onboarding_request_id', onboarding_request_id)
      .limit(1);

    if (existingDocs && existingDocs.length > 0) {
      console.log('Requirements already exist, skipping population');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Requirements already exist',
          skipped: true 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Try to load buyer's default requirements
    const { data: defaultDocs } = await supabase
      .from('default_document_requirements')
      .select('*')
      .eq('buyer_id', request.buyer_id)
      .order('display_order', { ascending: true });

    const { data: defaultFields } = await supabase
      .from('default_form_fields')
      .select('*')
      .eq('buyer_id', request.buyer_id)
      .order('field_order', { ascending: true });

    // Use buyer defaults if available, otherwise use common templates
    const docsToAdd = (defaultDocs && defaultDocs.length > 0) 
      ? defaultDocs.map(doc => ({
          document_type: doc.document_type,
          document_name: doc.document_name,
          description: doc.description,
          is_required: doc.is_required,
          template_file_path: doc.template_file_path,
          template_file_name: doc.template_file_name
        }))
      : COMMON_DOCUMENTS;

    const fieldsToAdd = (defaultFields && defaultFields.length > 0)
      ? defaultFields.map(field => ({
          field_type: field.field_type,
          field_label: field.field_label,
          field_description: field.field_description,
          field_options: field.field_options,
          is_required: field.is_required,
          field_order: field.field_order
        }))
      : COMMON_FORM_FIELDS;

    console.log(`Adding ${docsToAdd.length} document requirements and ${fieldsToAdd.length} form fields`);

    // Insert document requirements
    const documentInserts = docsToAdd.map(doc => ({
      onboarding_request_id,
      ...doc
    }));

    const { error: docsError } = await supabase
      .from('onboarding_document_requirements')
      .insert(documentInserts);

    if (docsError) {
      console.error('Failed to insert document requirements:', docsError);
      throw docsError;
    }

    // Insert form fields
    const fieldInserts = fieldsToAdd.map(field => ({
      onboarding_request_id,
      ...field
    }));

    const { error: fieldsError } = await supabase
      .from('onboarding_form_fields')
      .insert(fieldInserts);

    if (fieldsError) {
      console.error('Failed to insert form fields:', fieldsError);
      throw fieldsError;
    }

    console.log('Successfully populated onboarding requirements');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Requirements populated successfully',
        documents_added: docsToAdd.length,
        fields_added: fieldsToAdd.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error populating requirements:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
