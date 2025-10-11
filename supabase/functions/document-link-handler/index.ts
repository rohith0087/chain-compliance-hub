import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Resolve various forms of stored file paths into a bucket + key pair
function resolveStoragePath(input?: string | null): { bucket: string; key: string } | null {
  if (!input) return null;
  let value = input.trim();

  // If it's a full URL, try to parse bucket and key
  try {
    if (value.startsWith('http://') || value.startsWith('https://')) {
      const url = new URL(value);
      const parts = url.pathname.split('/').filter(Boolean);
      // Patterns we may see:
      // /storage/v1/object/public/<bucket>/<key>
      // /storage/v1/object/sign/<bucket>/<key>
      const idx = parts.findIndex((p) => p === 'object');
      if (idx !== -1 && parts[idx + 1]) {
        // object/<visibility>/<bucket>/<...key>
        const visibilityOrBucket = parts[idx + 1];
        if (visibilityOrBucket === 'public' || visibilityOrBucket === 'sign' || visibilityOrBucket === 'auth') {
          const bucket = parts[idx + 2];
          const key = parts.slice(idx + 3).join('/');
          if (bucket && key) return { bucket, key };
        } else {
          // object/<bucket>/<...key>
          const bucket = visibilityOrBucket;
          const key = parts.slice(idx + 2).join('/');
          if (bucket && key) return { bucket, key };
        }
      }
    }
  } catch {
    // fallthrough to key normalization
  }

  // Normalize leading slashes
  value = value.replace(/^\/+/, '');

  // If the value includes the bucket name as a prefix, strip it
  if (value.startsWith('compliance-documents/')) {
    return { bucket: 'compliance-documents', key: value.replace(/^compliance-documents\//, '') };
  }

  // Default to compliance-documents bucket
  return { bucket: 'compliance-documents', key: value };
}

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

    // Check if this is a request to create a shared link
    const body = await req.json().catch(() => null);
    
    if (body && body.action === 'create_link') {
      // Authenticate user
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'Authentication required' }),
          { 
            status: 401, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      const userSupabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? ''
      );

      const { data: userData, error: authError } = await userSupabase.auth.getUser(
        authHeader.replace('Bearer ', '')
      );
      
      if (authError || !userData?.user) {
        return new Response(
          JSON.stringify({ error: 'Not authenticated' }),
          { 
            status: 401, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      // Create shared link
      const expiresInDays = body.expires_in_days || 30;
      const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();
      
      const { data: linkData, error: insertError } = await supabase
        .from('document_shared_links')
        .insert({
          document_upload_id: body.document_id,
          access_token: crypto.randomUUID(),
          created_by: userData.user.id,
          permission_level: body.permission_level || 'public',
          expires_at: expiresAt,
          is_active: true
        })
        .select()
        .single();
      
      if (insertError || !linkData) {
        console.error('Failed to create shared link:', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to create link' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          success: true,
          access_token: linkData.access_token,
          expires_at: linkData.expires_at
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Handle existing token-based access
    const url = new URL(req.url);
    let token = url.pathname.split('/').pop();

    if (!token || token === 'document-link-handler') {
      token = url.searchParams.get('access_token') || url.searchParams.get('token') || undefined as unknown as string;
    }

    if (!token && body && typeof body.access_token === 'string') {
      token = body.access_token;
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
    const filePathRaw = linkData.document_uploads.file_path as string;
    const resolved = resolveStoragePath(filePathRaw);

    if (!resolved) {
      console.error('Invalid storage path', { filePathRaw });
      return new Response(
        JSON.stringify({ error: 'Invalid file path' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Generating signed URL', { filePathRaw, bucket: resolved.bucket, key: resolved.key });

    const { data: signedUrl, error: urlError } = await supabase.storage
      .from(resolved.bucket)
      .createSignedUrl(resolved.key, 3600);

    if (urlError || !signedUrl) {
      console.error('Error creating signed URL', { error: urlError, bucket: resolved.bucket, key: resolved.key });
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