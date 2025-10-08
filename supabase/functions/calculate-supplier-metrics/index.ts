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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting supplier metrics calculation...');

    // Get all active buyer-supplier connections
    const { data: connections, error: connectionsError } = await supabaseClient
      .from('buyer_supplier_connections')
      .select('buyer_id, supplier_id')
      .eq('status', 'approved');

    if (connectionsError) throw connectionsError;

    console.log(`Found ${connections?.length || 0} active connections`);

    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

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
            return (updated.getTime() - created.getTime()) / (1000 * 60 * 60); // hours
          }) || [];

        const avgResponseTime = responseTimes.length > 0
          ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
          : null;

        // Calculate on-time submission rate
        const onTimeRequests = requests?.filter(r => {
          if (r.status !== 'approved' || !r.updated_at) return false;
          const responseTime = (new Date(r.updated_at).getTime() - new Date(r.created_at).getTime()) / (1000 * 60 * 60);
          return responseTime <= 72; // 3 days
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
            document_quality_score: complianceScore, // Simplified for now
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
          console.log(`Calculated metrics for supplier ${connection.supplier_id} - buyer ${connection.buyer_id}`);
        }

      } catch (error) {
        console.error(`Error processing connection:`, error);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Calculated metrics for ${connections?.length || 0} connections` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in calculate-supplier-metrics:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
