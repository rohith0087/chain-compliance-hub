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
    
    console.log('secure-document-url RAW body:', JSON.stringify(body, null, 2));
    
    // Support both camelCase and snake_case
    const bucket = body.bucket;
    const key = body.key;
    const filePath = body.filePath || body.file_path;
    const document_id = body.document_id || body.documentId;
    const expiresIn = body.expiresIn || body.expires_in || 3600;

    console.log('secure-document-url parsed params:', { bucket, key, filePath, document_id, expiresIn });

    let resolved = null as { bucket: string; key: string } | null;
    if (bucket && key) {
      resolved = { bucket, key };
    } else if (filePath) {
      resolved = resolveStoragePath(filePath);
    } else if (document_id) {
      // Fallback: look up document by ID
      console.log('Looking up document by ID:', document_id);
      const { data: docData, error: docError } = await adminClient
        .from('document_uploads')
        .select('file_path')
        .eq('id', document_id)
        .maybeSingle();
      
      if (docError) {
        console.error('Error looking up document by ID:', docError);
      }
      
      if (docData?.file_path) {
        console.log('Found file_path for document:', docData.file_path);
        resolved = resolveStoragePath(docData.file_path);
      }
    }

    if (!resolved) {
      console.error('Failed to resolve storage path:', { bucket, key, filePath, document_id });
      return new Response(JSON.stringify({ error: 'Missing or invalid file path' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Resolved storage path:', resolved);

    // Check if this is a custom template request
    const isCustomTemplate = resolved.key.startsWith('custom-templates/');
    
    let upload = null;
    let customTemplate = null;
    let submission: any = null;
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
        console.log('Document upload not found in database for key:', resolved.key);
        // Try to find a template submission with this file path
        const tryFindSubmission = async () => {
          // Exact match
          let { data: sub, error } = await adminClient
            .from('template_submissions')
            .select('id, request_id, supplier_id, submission_file_path')
            .eq('submission_file_path', resolved!.key)
            .maybeSingle();

          if (!sub || error) {
            // Try with bucket-prefixed key
            const prefixedKey = `${resolved!.bucket}/${resolved!.key}`;
            ({ data: sub, error } = await adminClient
              .from('template_submissions')
              .select('id, request_id, supplier_id, submission_file_path')
              .eq('submission_file_path', prefixedKey)
              .maybeSingle());

            if (!sub || error) {
              // Last resort: ILIKE contains
              const { data: list } = await adminClient
                .from('template_submissions')
                .select('id, request_id, supplier_id, submission_file_path')
                .ilike('submission_file_path', `%${resolved!.key}%`)
                .limit(1);
              sub = list && list[0];
            }
          }

          return sub;
        };

        submission = await tryFindSubmission();
        if (!submission) {
          console.error('Document not found in database:', { resolved, document_id, filePath });
          return new Response(JSON.stringify({ error: 'Document not found in database' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        console.log('Found template submission:', submission);
      } else {
        console.log('Found document upload:', upload);
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
        const { data: templateRequests } = await adminClient
          .from('document_requests')
          .select('id, supplier_id, custom_template_id')
          .eq('supplier_id', supplierData.id)
          .eq('custom_template_id', customTemplate.id)
          .limit(1);

        if (templateRequests && templateRequests.length > 0) {
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
    } else if (submission) {
      // Access checks for template submission files
      const { data: request } = await adminClient
        .from('document_requests')
        .select('id, buyer_id, supplier_id')
        .eq('id', submission.request_id)
        .maybeSingle();

      // Supplier owner of the submission
      const { data: sOwner } = await adminClient
        .from('suppliers')
        .select('id')
        .eq('profile_id', userId)
        .maybeSingle();
      if (sOwner && sOwner.id === submission.supplier_id) {
        allowed = true;
      }

      // Buyer owner
      if (!allowed && request) {
        const { data: bOwner } = await adminClient
          .from('buyers')
          .select('id')
          .eq('id', request.buyer_id)
          .eq('profile_id', userId)
          .maybeSingle();
        if (bOwner) allowed = true;
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
      console.error('Failed to create signed URL:', { error: signErr, bucket: resolved.bucket, key: resolved.key });
      return new Response(JSON.stringify({ error: 'File not found in storage' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Successfully created signed URL for:', resolved.key);

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