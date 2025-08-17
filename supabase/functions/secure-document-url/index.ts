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

    // Fetch the upload row by matching file_path
    // Try exact first; if not found, fallback to ILIKE
    const tryFindUpload = async () => {
      let query = adminClient
        .from('document_uploads')
        .select('id, request_id, uploader_id, file_path')
        .eq('file_path', resolved!.key)
        .maybeSingle();

      let { data: upload, error } = await query;

      if (!upload || error) {
        // Try with bucket-prefixed key
        const prefixedKey = `${resolved!.bucket}/${resolved!.key}`;
        ({ data: upload, error } = await adminClient
          .from('document_uploads')
          .select('id, request_id, uploader_id, file_path')
          .eq('file_path', prefixedKey)
          .maybeSingle());

        if (!upload || error) {
          // Last resort: ILIKE contains
          const { data: list } = await adminClient
            .from('document_uploads')
            .select('id, request_id, uploader_id, file_path')
            .ilike('file_path', `%${resolved!.key}%`)
            .limit(1);
          upload = list && list[0];
        }
      }

      return upload;
    };

    const upload = await tryFindUpload();
    if (!upload) {
      console.warn('Upload not found for key', { resolved });
      return new Response(JSON.stringify({ error: 'Document not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Load the associated request
    const { data: request } = await adminClient
      .from('document_requests')
      .select('id, buyer_id, supplier_id, requester_id')
      .eq('id', upload.request_id)
      .maybeSingle();

    const userId = userData.user.id;

    // Access checks
    let allowed = false;

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

    if (!allowed) {
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