import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    // Try to extract token from URL path, query params, or request body
    let token = url.pathname.split('/').pop();

    if (!token || token === 'document-link-handler') {
      token = url.searchParams.get('access_token') || url.searchParams.get('token') || undefined as unknown as string;
    }

    if (!token) {
      try {
        const body = await req.json();
        if (body && typeof body.access_token === 'string') {
          token = body.access_token;
        }
      } catch (_) {
        // ignore JSON parse errors
      }
    }

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Access token is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get link details
    const { data: linkData, error: linkError } = await supabase
      .from('document_shared_links')
      .select(`
        *,
        document_uploads (
          id,
          file_name,
          file_path,
          file_size,
          mime_type,
          created_at,
          document_requests (
            title,
            buyer_id,
            supplier_id,
            buyers (
              company_name,
              profile_id
            ),
            suppliers (
              company_name,
              profile_id
            )
          )
        )
      `)
      .eq('access_token', token)
      .eq('is_active', true)
      .single();

    if (linkError || !linkData) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired link' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Check if link has expired
    if (linkData.expires_at && new Date(linkData.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Link has expired' }),
        { 
          status: 410, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get user information if authenticated
    const authHeader = req.headers.get('Authorization');
    let user = null;
    let userCompanyId = null;
    let userRole = null;

    if (authHeader) {
      const userSupabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? ''
      );

      const { data: userData } = await userSupabase.auth.getUser(
        authHeader.replace('Bearer ', '')
      );
      
      if (userData.user) {
        user = userData.user;
        
        // Get user's company information
        const { data: buyerData } = await supabase
          .from('buyers')
          .select('id, company_name')
          .eq('profile_id', user.id)
          .single();

        const { data: supplierData } = await supabase
          .from('suppliers')
          .select('id, company_name')
          .eq('profile_id', user.id)
          .single();

        if (buyerData) {
          userCompanyId = buyerData.id;
          userRole = 'buyer';
        } else if (supplierData) {
          userCompanyId = supplierData.id;
          userRole = 'supplier';
        }
      }
    }

    // Check permission level
    const documentRequest = linkData.document_uploads.document_requests;
    
    switch (linkData.permission_level) {
      case 'public':
        // Anyone can access
        break;
        
      case 'organization':
        if (!user) {
          return new Response(
            JSON.stringify({ 
              error: 'Authentication required for organization-level access',
              requiresAuth: true 
            }),
            { 
              status: 401, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }
        
        // Check if user belongs to the same organization
        const buyerCompanyId = documentRequest.buyer_id;
        const supplierCompanyId = documentRequest.supplier_id;
        
        if (userRole === 'buyer' && userCompanyId !== buyerCompanyId) {
          return new Response(
            JSON.stringify({ error: 'Access denied: Not from the same organization' }),
            { 
              status: 403, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }
        
        if (userRole === 'supplier' && userCompanyId !== supplierCompanyId) {
          return new Response(
            JSON.stringify({ error: 'Access denied: Not from the same organization' }),
            { 
              status: 403, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }
        break;
        
      case 'admin_only':
        if (!user) {
          return new Response(
            JSON.stringify({ 
              error: 'Authentication required for admin access',
              requiresAuth: true 
            }),
            { 
              status: 401, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }
        
        // Check if user has admin permissions
        const { data: adminCheck } = await supabase
          .from('company_users')
          .select('role')
          .eq('profile_id', user.id)
          .eq('role', 'company_admin')
          .eq('status', 'active')
          .single();
          
        if (!adminCheck) {
          return new Response(
            JSON.stringify({ error: 'Access denied: Admin privileges required' }),
            { 
              status: 403, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }
        break;
    }

    // Update view count and last accessed
    await supabase
      .from('document_shared_links')
      .update({
        view_count: linkData.view_count + 1,
        last_accessed_at: new Date().toISOString()
      })
      .eq('id', linkData.id);

    // Log the access
    await supabase.rpc('log_document_activity', {
      p_document_upload_id: linkData.document_upload_id,
      p_user_id: user?.id || null,
      p_action_type: 'link_accessed',
      p_metadata: {
        access_token: token,
        permission_level: linkData.permission_level,
        user_agent: req.headers.get('User-Agent'),
        ip_address: req.headers.get('CF-Connecting-IP') || req.headers.get('X-Forwarded-For')
      },
      p_notes: `Document accessed via shared link (${linkData.permission_level})`
    });

    // Get signed URL for the document
    const { data: signedUrl, error: urlError } = await supabase.storage
      .from('compliance-documents')
      .createSignedUrl(linkData.document_uploads.file_path, 3600);

    if (urlError) {
      console.error('Error creating signed URL:', urlError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate document access URL' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Return document information and access URL
    return new Response(
      JSON.stringify({
        success: true,
        document: {
          id: linkData.document_uploads.id,
          file_name: linkData.document_uploads.file_name,
          file_size: linkData.document_uploads.file_size,
          mime_type: linkData.document_uploads.mime_type,
          created_at: linkData.document_uploads.created_at,
          request_title: documentRequest.title,
          buyer_company: documentRequest.buyers?.company_name,
          supplier_company: documentRequest.suppliers?.company_name,
        },
        access_url: signedUrl.signedUrl,
        permission_level: linkData.permission_level,
        expires_at: linkData.expires_at,
        access_info: {
          view_count: linkData.view_count + 1,
          accessed_by: user?.email || 'Anonymous',
          accessed_at: new Date().toISOString()
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in document-link-handler:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});