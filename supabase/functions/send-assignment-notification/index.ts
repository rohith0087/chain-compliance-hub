import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { assignmentId } = await req.json();

    if (!assignmentId) {
      return new Response(
        JSON.stringify({ error: 'Assignment ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

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

    // Create notification
    await supabaseClient
      .from('notifications')
      .insert({
        user_id: assignment.assigned_to,
        title: 'New Document Assignment',
        message: `${assignment.assigner?.full_name} assigned you to ${assignment.assignment_type} "${assignment.document?.request?.title}" from ${assignment.document?.request?.supplier?.company_name}`,
        type: 'document_assigned',
        reference_id: assignment.document_upload_id
      });

    console.log(`Notification sent for assignment ${assignmentId} to ${assignment.assignee?.email}`);

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
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
