import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AuditLogEntry {
  id: string;
  timestamp: string;
  category: 'document' | 'auth' | 'system';
  action: string;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  ipAddress: string | null;
  details: {
    documentName?: string;
    companyName?: string;
    supplierId?: string;
    buyerId?: string;
    status?: string;
    notes?: string;
    path?: string;
  };
  metadata?: Record<string, any>;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Verify user is platform admin or super admin
    const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is platform admin or super admin
    const { data: platformAdmin } = await supabaseAuth
      .from('platform_admins')
      .select('id')
      .eq('profile_id', user.id)
      .eq('is_active', true)
      .single();

    const isSuperAdmin = user.user_metadata?.roles?.includes('super_admin');

    if (!platformAdmin && !isSuperAdmin) {
      return new Response(
        JSON.stringify({ error: 'Access denied - admin privileges required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body for filters
    const body = await req.json().catch(() => ({}));
    const {
      dateFrom,
      dateTo,
      actionTypes = [],
      userId: filterUserId,
      companyId,
      limit = 100,
      offset = 0
    } = body;

    const auditLogs: AuditLogEntry[] = [];

    // 1. Fetch document activity logs
    let docQuery = supabaseAuth
      .from('document_activity_logs')
      .select(`
        id,
        created_at,
        action_type,
        notes,
        metadata,
        user_id,
        document_upload_id,
        document_request_id,
        profiles:user_id (
          id,
          email,
          full_name
        )
      `)
      .order('created_at', { ascending: false });

    // Apply date filters
    if (dateFrom) {
      docQuery = docQuery.gte('created_at', dateFrom);
    }
    if (dateTo) {
      docQuery = docQuery.lte('created_at', dateTo);
    }
    if (filterUserId) {
      docQuery = docQuery.eq('user_id', filterUserId);
    }
    if (actionTypes.length > 0) {
      const docActions = actionTypes.filter((a: string) => 
        ['requested', 'uploaded', 'approved', 'rejected', 'downloaded', 'link_created', 'link_accessed'].includes(a)
      );
      if (docActions.length > 0) {
        docQuery = docQuery.in('action_type', docActions);
      }
    }

    const { data: docLogs, error: docError } = await docQuery.limit(limit);

    if (docError) {
      console.error('Error fetching document logs:', docError);
    } else if (docLogs) {
      // Get document details for each log
      for (const log of docLogs) {
        let documentName = 'Unknown Document';
        let companyName = '';
        let supplierId = '';
        let buyerId = '';

        // Try to get document details from upload or request
        if (log.document_upload_id) {
          const { data: upload } = await supabaseAuth
            .from('document_uploads')
            .select('file_name, request_id')
            .eq('id', log.document_upload_id)
            .single();
          
          if (upload) {
            documentName = upload.file_name;
            if (upload.request_id) {
              const { data: request } = await supabaseAuth
                .from('document_requests')
                .select('title, supplier_id, buyer_id, suppliers(company_name), buyers(company_name)')
                .eq('id', upload.request_id)
                .single();
              
              if (request) {
                documentName = request.title || documentName;
                supplierId = request.supplier_id || '';
                buyerId = request.buyer_id || '';
                companyName = (request as any).suppliers?.company_name || (request as any).buyers?.company_name || '';
              }
            }
          }
        } else if (log.document_request_id) {
          const { data: request } = await supabaseAuth
            .from('document_requests')
            .select('title, supplier_id, buyer_id, suppliers(company_name), buyers(company_name)')
            .eq('id', log.document_request_id)
            .single();
          
          if (request) {
            documentName = request.title || 'Document Request';
            supplierId = request.supplier_id || '';
            buyerId = request.buyer_id || '';
            companyName = (request as any).suppliers?.company_name || (request as any).buyers?.company_name || '';
          }
        }

        const profile = log.profiles as any;
        auditLogs.push({
          id: log.id,
          timestamp: log.created_at,
          category: 'document',
          action: log.action_type,
          userId: log.user_id,
          userEmail: profile?.email || null,
          userName: profile?.full_name || null,
          ipAddress: (log.metadata as any)?.ip_address || null,
          details: {
            documentName,
            companyName,
            supplierId,
            buyerId,
            notes: log.notes || undefined
          },
          metadata: log.metadata as Record<string, any> || undefined
        });
      }
    }

    // 2. Fetch auth logs from Supabase Analytics
    // Note: This queries the auth_logs table via analytics API
    try {
      const shouldFetchAuth = actionTypes.length === 0 || actionTypes.includes('login') || actionTypes.includes('logout');
      
      if (shouldFetchAuth) {
        // Build date filter for analytics query
        let dateFilter = '';
        if (dateFrom) {
          dateFilter += ` AND auth_logs.timestamp >= '${dateFrom}'`;
        }
        if (dateTo) {
          dateFilter += ` AND auth_logs.timestamp <= '${dateTo}'`;
        }

        const analyticsQuery = `
          SELECT 
            id, 
            auth_logs.timestamp, 
            event_message, 
            metadata.level, 
            metadata.status, 
            metadata.path, 
            metadata.msg as msg,
            metadata.error
          FROM auth_logs
          CROSS JOIN unnest(metadata) as metadata
          WHERE metadata.path IN ('/token', '/logout', '/user')
          ${dateFilter}
          ORDER BY timestamp DESC
          LIMIT ${Math.min(limit, 50)}
        `;

        // Use the analytics endpoint
        const analyticsResponse = await fetch(
          `${supabaseUrl}/rest/v1/rpc/get_auth_analytics`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json',
              'apikey': supabaseServiceKey
            },
            body: JSON.stringify({ query_text: analyticsQuery })
          }
        );

        // If analytics API not available, parse from edge logs or skip
        // For now, we'll just note that auth logs would be fetched here
        console.log('Auth analytics query would be executed here');
      }
    } catch (authLogError) {
      console.error('Error fetching auth logs:', authLogError);
      // Continue without auth logs - they're a nice-to-have
    }

    // Sort all logs by timestamp descending
    auditLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Apply pagination
    const paginatedLogs = auditLogs.slice(offset, offset + limit);

    console.log(`Returning ${paginatedLogs.length} audit logs`);

    return new Response(
      JSON.stringify({
        logs: paginatedLogs,
        total: auditLogs.length,
        limit,
        offset
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-audit-logs:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
