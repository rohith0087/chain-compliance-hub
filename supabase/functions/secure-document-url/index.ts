import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Local resolver to normalize storage paths
function resolveStoragePath(input?: string | null): { bucket: string; key: string } | null {
  if (!input) return null;
  let value = input.trim();

  try {
    if (value.startsWith('http://') || value.startsWith('https://')) {
      const url = new URL(value);
      const parts = url.pathname.split('/').filter(Boolean);
      const idx = parts.findIndex((p) => p === 'object');
      if (idx !== -1 && parts[idx + 1]) {
        const visibilityOrBucket = parts[idx + 1];
        if (visibilityOrBucket === 'public' || visibilityOrBucket === 'sign' || visibilityOrBucket === 'auth') {
          const bucket = parts[idx + 2];
          const key = parts.slice(idx + 3).join('/');
          if (bucket && key) return { bucket, key };
        } else {
          const bucket = visibilityOrBucket;
          const key = parts.slice(idx + 2).join('/');
          if (bucket && key) return { bucket, key };
        }
      }
    }
  } catch {
    // fallthrough
  }

  value = value.replace(/^\/+/, '');
  if (value.startsWith('compliance-documents/')) {
    return { bucket: 'compliance-documents', key: value.replace(/^compliance-documents\//, '') };
  }
  return { bucket: 'compliance-documents', key: value };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';

    // Client to read the authenticated user
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: authHeader } },
      }
    );

    // Admin client for privileged DB/storage access
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { bucket, key, filePath, expiresIn = 3600 } = body || {} as any;

    let resolved = null as { bucket: string; key: string } | null;
    if (bucket && key) {
      resolved = { bucket, key };
    } else if (filePath) {
      resolved = resolveStoragePath(filePath);
    }

    if (!resolved) {
      return new Response(JSON.stringify({ error: 'Missing or invalid file path' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if this is a custom template request
    const isCustomTemplate = resolved.key.startsWith('custom-templates/');
    
    let upload = null;
    let customTemplate = null;
    
    if (isCustomTemplate) {
      // For custom templates, check direct access
      const { data: templateData } = await adminClient
        .from('custom_document_templates')
        .select('id, buyer_id, file_path')
        .eq('file_path', resolved.key)
        .maybeSingle();
      
      if (templateData) {
        customTemplate = templateData;
        console.log('Found custom template:', templateData);
      } else {
        console.warn('Custom template not found for key', { resolved });
        return new Response(JSON.stringify({ error: 'Template not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      // Regular document upload lookup
      const tryFindUpload = async () => {
        let query = adminClient
          .from('document_uploads')
          .select('id, request_id, uploader_id, file_path')
          .eq('file_path', resolved!.key)
          .maybeSingle();

        let { data: uploadData, error } = await query;

        if (!uploadData || error) {
          // Try with bucket-prefixed key
          const prefixedKey = `${resolved!.bucket}/${resolved!.key}`;
          ({ data: uploadData, error } = await adminClient
            .from('document_uploads')
            .select('id, request_id, uploader_id, file_path')
            .eq('file_path', prefixedKey)
            .maybeSingle());

          if (!uploadData || error) {
            // Last resort: ILIKE contains
            const { data: list } = await adminClient
              .from('document_uploads')
              .select('id, request_id, uploader_id, file_path')
              .ilike('file_path', `%${resolved!.key}%`)
              .limit(1);
            uploadData = list && list[0];
          }
        }

        return uploadData;
      };

      upload = await tryFindUpload();
      if (!upload) {
        console.warn('Upload not found for key', { resolved });
        return new Response(JSON.stringify({ error: 'Document not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const userId = userData.user.id;
    let allowed = false;

    if (isCustomTemplate && customTemplate) {
      // For custom templates, check if user is supplier with an active request for this template
      const { data: supplierData } = await adminClient
        .from('suppliers')
        .select('id')
        .eq('profile_id', userId)
        .maybeSingle();

      if (supplierData) {
        // Check if supplier has a document request for this template
        const { data: templateRequest } = await adminClient
          .from('document_requests')
          .select('id, supplier_id, custom_template_id')
          .eq('supplier_id', supplierData.id)
          .eq('custom_template_id', customTemplate.id)
          .maybeSingle();

        if (templateRequest) {
          allowed = true;
          console.log('Supplier access granted for custom template');
        }
      }

      // Check if user is the buyer who owns this template
      if (!allowed) {
        const { data: buyerData } = await adminClient
          .from('buyers')
          .select('id')
          .eq('id', customTemplate.buyer_id)
          .eq('profile_id', userId)
          .maybeSingle();

        if (buyerData) {
          allowed = true;
          console.log('Buyer access granted for custom template');
        }
      }
    } else if (upload) {
      // Regular document upload access checks
      
      // Load the associated request
      const { data: request } = await adminClient
        .from('document_requests')
        .select('id, buyer_id, supplier_id, requester_id')
        .eq('id', upload.request_id)
        .maybeSingle();

      // Uploader can always access
      if (upload.uploader_id === userId) {
        allowed = true;
      }

      // Buyer or Supplier owner
      if (!allowed && request) {
        const [{ data: buyer }, { data: supplier }] = await Promise.all([
          adminClient.from('buyers').select('id').eq('id', request.buyer_id).eq('profile_id', userId).maybeSingle(),
          adminClient.from('suppliers').select('id').eq('id', request.supplier_id).eq('profile_id', userId).maybeSingle(),
        ]);
        if (buyer || supplier) allowed = true;
      }

      // Company teammates (buyer or supplier)
      if (!allowed && request) {
        const { data: companyUser } = await adminClient
          .from('company_users')
          .select('id')
          .eq('profile_id', userId)
          .eq('status', 'active')
          .or(`and(company_id.eq.${request.buyer_id},company_type.eq.buyer),and(company_id.eq.${request.supplier_id},company_type.eq.supplier)`)
          .limit(1);
        if (companyUser && companyUser.length > 0) allowed = true;
      }
    }

    if (!allowed) {
      console.log('Access denied for user', userId, 'to resource', resolved.key);
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create signed URL
    const { data: signed, error: signErr } = await adminClient.storage
      .from(resolved.bucket)
      .createSignedUrl(resolved.key, Math.min(60 * 60 * 6, Math.max(60, Number(expiresIn) || 3600))); // 1h default, max 6h

    if (signErr || !signed?.signedUrl) {
      console.error('Failed to sign URL', { signErr, resolved });
      return new Response(JSON.stringify({ error: 'Failed to generate URL' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ success: true, url: signed.signedUrl }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('secure-document-url error', e);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});