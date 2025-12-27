import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.error('[secure-sample-url] Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's auth
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Client with user auth for permission checks
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Service client for storage operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error('[secure-sample-url] Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[secure-sample-url] User authenticated:', user.id);

    // Parse request body
    const { request_id } = await req.json();
    
    if (!request_id) {
      return new Response(
        JSON.stringify({ error: 'request_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[secure-sample-url] Fetching request:', request_id);

    // Fetch the document request with sample info
    const { data: request, error: requestError } = await supabaseAdmin
      .from('document_requests')
      .select('id, buyer_id, supplier_id, sample_file_path, sample_file_name')
      .eq('id', request_id)
      .single();

    if (requestError || !request) {
      console.error('[secure-sample-url] Request not found:', requestError);
      return new Response(
        JSON.stringify({ error: 'Request not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if sample exists
    if (!request.sample_file_path) {
      return new Response(
        JSON.stringify({ error: 'No sample document attached to this request' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[secure-sample-url] Sample file path:', request.sample_file_path);

    // Check user permissions - must be buyer owner, buyer team member, supplier owner, or supplier team member
    let hasAccess = false;

    // Check if user is the buyer owner
    const { data: buyerOwner } = await supabaseAdmin
      .from('buyers')
      .select('id')
      .eq('id', request.buyer_id)
      .eq('profile_id', user.id)
      .single();

    if (buyerOwner) {
      hasAccess = true;
      console.log('[secure-sample-url] Access granted: buyer owner');
    }

    // Check if user is a buyer team member
    if (!hasAccess) {
      const { data: buyerTeamMember } = await supabaseAdmin
        .from('company_users')
        .select('id')
        .eq('company_id', request.buyer_id)
        .eq('company_type', 'buyer')
        .eq('profile_id', user.id)
        .eq('status', 'active')
        .single();

      if (buyerTeamMember) {
        hasAccess = true;
        console.log('[secure-sample-url] Access granted: buyer team member');
      }
    }

    // Check if user is the supplier owner (for this request)
    if (!hasAccess && request.supplier_id) {
      const { data: supplierOwner } = await supabaseAdmin
        .from('suppliers')
        .select('id')
        .eq('id', request.supplier_id)
        .eq('profile_id', user.id)
        .single();

      if (supplierOwner) {
        hasAccess = true;
        console.log('[secure-sample-url] Access granted: supplier owner');
      }
    }

    // Check if user is a supplier team member
    if (!hasAccess && request.supplier_id) {
      const { data: supplierTeamMember } = await supabaseAdmin
        .from('company_users')
        .select('id')
        .eq('company_id', request.supplier_id)
        .eq('company_type', 'supplier')
        .eq('profile_id', user.id)
        .eq('status', 'active')
        .single();

      if (supplierTeamMember) {
        hasAccess = true;
        console.log('[secure-sample-url] Access granted: supplier team member');
      }
    }

    if (!hasAccess) {
      console.error('[secure-sample-url] Access denied for user:', user.id);
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate signed URL (5 minutes expiry)
    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
      .from('sample-documents')
      .createSignedUrl(request.sample_file_path, 300); // 300 seconds = 5 minutes

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error('[secure-sample-url] Failed to create signed URL:', signedUrlError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate access URL' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[secure-sample-url] Signed URL generated successfully');

    return new Response(
      JSON.stringify({ 
        signed_url: signedUrlData.signedUrl,
        file_name: request.sample_file_name,
        expires_in: 300
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[secure-sample-url] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
