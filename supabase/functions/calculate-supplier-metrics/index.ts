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

    console.log('Authenticated user:', user.id, user.email);

    // Parse request body for optional company filter
    let requestedBuyerId: string | null = null;
    try {
      const body = await req.json();
      requestedBuyerId = body?.buyer_id || null;
    } catch {
      // No body provided, calculate for all authorized connections
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
        JSON.stringify({ error: 'Only buyers can calculate supplier metrics' }),
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

    console.log('Starting supplier metrics calculation for buyer:', targetBuyerId);

    // Get active buyer-supplier connections for this buyer
    const { data: connections, error: connectionsError } = await supabaseClient
      .from('buyer_supplier_connections')
      .select('buyer_id, supplier_id')
      .eq('status', 'approved')
      .eq('buyer_id', targetBuyerId);

    if (connectionsError) throw connectionsError;

    console.log(`Found ${connections?.length || 0} active connections`);

    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let processedCount = 0;

    for (const connection of connections || []) {
      try {
        // Get document requests for this connection
        const { data: requests, error: requestsError } = await supabaseClient
          .from('document_requests')
          .select('id, status, created_at, updated_at')
          .eq('buyer_id', connection.buyer_id)
          .eq('supplier_id', connection.supplier_id)
          .gte('created_at', thirtyDaysAgo.toISOString());

        if (requestsError) {
          console.error('Error fetching requests:', requestsError);
          continue;
        }

        const totalRequests = requests?.length || 0;
        const approvedRequests = requests?.filter(r => r.status === 'approved').length || 0;
        const pendingRequests = requests?.filter(r => r.status === 'pending').length || 0;
        const rejectedRequests = requests?.filter(r => r.status === 'rejected').length || 0;
        const overdueRequests = requests?.filter(r => 
          r.status === 'pending' && 
          new Date(r.created_at) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        ).length || 0;

        // Calculate compliance score
        const complianceScore = totalRequests > 0 
          ? Math.round((approvedRequests / totalRequests) * 100) 
          : 0;

        // Calculate response time average (in hours)
        const responseTimes = requests
          ?.filter(r => r.status === 'approved' && r.updated_at)
          .map(r => {
            const created = new Date(r.created_at);
            const updated = new Date(r.updated_at);
            return (updated.getTime() - created.getTime()) / (1000 * 60 * 60);
          }) || [];

        const avgResponseTime = responseTimes.length > 0
          ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
          : null;

        // Calculate on-time submission rate
        const onTimeRequests = requests?.filter(r => {
          if (r.status !== 'approved' || !r.updated_at) return false;
          const responseTime = (new Date(r.updated_at).getTime() - new Date(r.created_at).getTime()) / (1000 * 60 * 60);
          return responseTime <= 72;
        }).length || 0;

        const onTimeRate = totalRequests > 0 
          ? Math.round((onTimeRequests / totalRequests) * 100) 
          : 0;

        // Calculate risk score (0-100, higher is worse)
        let riskScore = 0;
        if (complianceScore < 70) riskScore += 30;
        else if (complianceScore < 85) riskScore += 15;
        
        if (overdueRequests > 5) riskScore += 30;
        else if (overdueRequests > 2) riskScore += 15;
        
        if (rejectedRequests > 3) riskScore += 20;
        else if (rejectedRequests > 1) riskScore += 10;

        if (onTimeRate < 70) riskScore += 20;
        else if (onTimeRate < 85) riskScore += 10;

        // Compliance-chain contribution: open requirement gaps detected by the
        // Phase 4 engine. Sum weighted signals (expired 1.0 … requested 0.5)
        // into a bounded 0-30 band so a supplier failing framework
        // requirements is scored as risky even if its request stats look fine.
        const { data: openSignals } = await supabaseClient
          .from('risk_signals')
          .select('signal_type, weight')
          .eq('buyer_id', connection.buyer_id)
          .eq('supplier_id', connection.supplier_id)
          .eq('status', 'open');
        const signalWeightSum = (openSignals || []).reduce((sum: number, s: { weight: number }) => sum + Number(s.weight || 0), 0);
        const chainRisk = Math.min(30, Math.round(signalWeightSum * 6));
        riskScore += chainRisk;
        const openSignalCount = (openSignals || []).length;
        riskScore = Math.min(100, riskScore);

        // Determine risk level
        let riskLevel = 'low';
        if (riskScore >= 60) riskLevel = 'critical';
        else if (riskScore >= 40) riskLevel = 'high';
        else if (riskScore >= 20) riskLevel = 'medium';

        // Auto-calculated risk factors
        const riskFactors = [];
        if (complianceScore < 70) riskFactors.push('Low compliance score');
        if (overdueRequests > 2) riskFactors.push(`${overdueRequests} overdue requests`);
        if (rejectedRequests > 1) riskFactors.push(`${rejectedRequests} rejected documents`);
        if (onTimeRate < 70) riskFactors.push('Poor on-time submission rate');
        if (openSignalCount > 0) riskFactors.push(`${openSignalCount} open compliance gap${openSignalCount > 1 ? 's' : ''}`);

        // Insert or update metrics
        const { error: metricsError } = await supabaseClient
          .from('supplier_performance_metrics')
          .upsert({
            supplier_id: connection.supplier_id,
            buyer_id: connection.buyer_id,
            metric_period_start: thirtyDaysAgo.toISOString().split('T')[0],
            metric_period_end: today.toISOString().split('T')[0],
            compliance_score: complianceScore,
            response_time_avg: avgResponseTime,
            on_time_submission_rate: onTimeRate,
            document_quality_score: complianceScore,
            risk_level: riskLevel,
            risk_score: riskScore,
            risk_factors: riskFactors,
            auto_calculated_risk: riskLevel,
            total_requests: totalRequests,
            approved_requests: approvedRequests,
            pending_requests: pendingRequests,
            rejected_requests: rejectedRequests,
            overdue_requests: overdueRequests,
            calculated_at: new Date().toISOString()
          }, {
            onConflict: 'supplier_id,buyer_id,metric_period_start,metric_period_end'
          });

        if (metricsError) {
          console.error('Error saving metrics:', metricsError);
        } else {
          processedCount++;
          console.log(`Calculated metrics for supplier ${connection.supplier_id}`);
        }

      } catch (error) {
        console.error(`Error processing connection:`, error);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Calculated metrics for ${processedCount} supplier connections`,
        buyer_id: targetBuyerId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in calculate-supplier-metrics:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
