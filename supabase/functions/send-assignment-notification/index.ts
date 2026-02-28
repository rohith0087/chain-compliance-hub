import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/corsHeaders.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

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
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Invalid authentication:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authenticated user:', user.id);

    const { assignmentId } = await req.json();

    if (!assignmentId) {
      return new Response(
        JSON.stringify({ error: 'Assignment ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get assignment details
    const { data: assignment, error: assignmentError } = await supabaseClient
      .from('document_assignments')
      .select(`
        *,
        document:document_uploads(
          id,
          file_name,
          request:document_requests(
            title,
            document_type,
            buyer_id,
            supplier:suppliers(company_name)
          )
        ),
        assignee:profiles!document_assignments_assigned_to_fkey(full_name, email),
        assigner:profiles!document_assignments_assigned_by_fkey(full_name)
      `)
      .eq('id', assignmentId)
      .single();

    if (assignmentError) throw assignmentError;

    if (!assignment) {
      return new Response(
        JSON.stringify({ error: 'Assignment not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================
    // Validate user has permission to send this notification
    // (must be the assigner or have access to the document's buyer)
    // ============================================
    const documentBuyerId = assignment.document?.request?.buyer_id;
    
    if (assignment.assigned_by !== user.id) {
      // Check if user has access to the buyer company
      let hasAccess = false;

      // Check buyer owner
      const { data: buyer } = await supabaseClient
        .from('buyers')
        .select('id')
        .eq('profile_id', user.id)
        .eq('id', documentBuyerId)
        .single();

      if (buyer) {
        hasAccess = true;
      } else {
        // Check team member
        const { data: companyUser } = await supabaseClient
          .from('company_users')
          .select('id')
          .eq('profile_id', user.id)
          .eq('company_id', documentBuyerId)
          .eq('company_type', 'buyer')
          .eq('status', 'active')
          .single();

        if (companyUser) hasAccess = true;
      }

      if (!hasAccess) {
        console.error('User does not have permission to send this notification');
        return new Response(
          JSON.stringify({ error: 'Unauthorized: Cannot send notification for this assignment' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Create notification
    await supabaseClient
      .from('notifications')
      .insert({
        user_id: assignment.assigned_to,
        title: 'New Document Assignment',
        message: `${assignment.assigner?.full_name || 'Someone'} assigned you to ${assignment.assignment_type} "${assignment.document?.request?.title || 'a document'}" from ${assignment.document?.request?.supplier?.company_name || 'a supplier'}`,
        type: 'document_assigned',
        reference_id: assignment.document_upload_id
      });

    console.log(`Notification sent for assignment ${assignmentId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Notification sent successfully' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in send-assignment-notification:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
