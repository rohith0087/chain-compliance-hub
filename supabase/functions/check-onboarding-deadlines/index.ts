import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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

    console.log('Authenticated user for onboarding deadlines check');

    // Parse request body for optional buyer filter
    let requestedBuyerId: string | null = null;
    try {
      const body = await req.json();
      requestedBuyerId = body?.buyer_id || null;
    } catch {
      // No body provided
    }

    // ============================================
    // Get user's buyer ID
    // ============================================
    let userBuyerId: string | null = null;

    // Check company_users first (team member path)
    const { data: companyUser } = await supabaseClient
      .from('company_users')
      .select('company_id')
      .eq('profile_id', user.id)
      .eq('status', 'active')
      .eq('company_type', 'buyer')
      .single();

    if (companyUser) {
      userBuyerId = companyUser.company_id;
    } else {
      // Check if user is a buyer owner
      const { data: buyer } = await supabaseClient
        .from('buyers')
        .select('id')
        .eq('profile_id', user.id)
        .single();
      userBuyerId = buyer?.id || null;
    }

    if (!userBuyerId) {
      console.error('User is not a buyer:', user.id);
      return new Response(
        JSON.stringify({ error: 'Only buyers can check onboarding deadlines' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If a specific buyer_id was requested, validate access
    if (requestedBuyerId && requestedBuyerId !== userBuyerId) {
      console.error('User does not have access to requested buyer:', requestedBuyerId);
      return new Response(
        JSON.stringify({ error: 'Unauthorized: No access to this buyer' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const targetBuyerId = requestedBuyerId || userBuyerId;

    console.log('Checking onboarding deadlines for buyer:', targetBuyerId);

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Find pending onboarding requests older than 7 days for this buyer
    const { data: pendingRequests, error: pendingError } = await supabaseClient
      .from('supplier_onboarding_requests')
      .select(`
        *,
        suppliers:supplier_id (company_name, profile_id),
        buyers:buyer_id (company_name, profile_id)
      `)
      .eq('status', 'pending')
      .eq('buyer_id', targetBuyerId)
      .lt('created_at', sevenDaysAgo.toISOString());

    if (pendingError) throw pendingError;

    // Send reminders to suppliers for pending onboarding
    for (const request of pendingRequests || []) {
      const daysSince = Math.floor((now.getTime() - new Date(request.created_at).getTime()) / (1000 * 60 * 60 * 24));
      
      if (request.suppliers?.profile_id) {
        await supabaseClient.from('notifications').insert({
          user_id: request.suppliers.profile_id,
          title: 'Onboarding Reminder',
          message: `Your onboarding request from ${request.buyers?.company_name || 'buyer'} has been pending for ${daysSince} days. Please complete the onboarding process.`,
          type: 'reminder',
          reference_id: request.id,
          metadata: { buyer_name: request.buyers?.company_name, days_pending: daysSince }
        });
      }
    }

    // Find in-progress onboarding requests older than 14 days for this buyer
    const { data: inProgressRequests, error: progressError } = await supabaseClient
      .from('supplier_onboarding_requests')
      .select(`
        *,
        suppliers:supplier_id (company_name, profile_id),
        buyers:buyer_id (company_name, profile_id)
      `)
      .eq('status', 'onboarding_initiated')
      .eq('buyer_id', targetBuyerId)
      .lt('updated_at', fourteenDaysAgo.toISOString());

    if (progressError) throw progressError;

    // Send escalation notifications for stalled onboarding
    for (const request of inProgressRequests || []) {
      const daysSince = Math.floor((now.getTime() - new Date(request.updated_at).getTime()) / (1000 * 60 * 60 * 24));
      
      // Notify supplier
      if (request.suppliers?.profile_id) {
        await supabaseClient.from('notifications').insert({
          user_id: request.suppliers.profile_id,
          title: 'Onboarding Stalled',
          message: `Your onboarding with ${request.buyers?.company_name || 'buyer'} has been in progress for ${daysSince} days. Please complete the remaining steps.`,
          type: 'escalation',
          reference_id: request.id,
          metadata: { buyer_name: request.buyers?.company_name, days_in_progress: daysSince }
        });
      }
      
      // Notify buyer
      if (request.buyers?.profile_id) {
        await supabaseClient.from('notifications').insert({
          user_id: request.buyers.profile_id,
          title: 'Supplier Onboarding Delayed',
          message: `${request.suppliers?.company_name || 'Supplier'}'s onboarding has been in progress for ${daysSince} days. You may want to follow up.`,
          type: 'info',
          reference_id: request.id,
          metadata: { supplier_name: request.suppliers?.company_name, days_in_progress: daysSince }
        });
      }
    }

    console.log(`Processed ${pendingRequests?.length || 0} pending and ${inProgressRequests?.length || 0} in-progress requests`);

    return new Response(
      JSON.stringify({
        success: true,
        buyer_id: targetBuyerId,
        pending_reminders: pendingRequests?.length || 0,
        progress_escalations: inProgressRequests?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in check-onboarding-deadlines:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
