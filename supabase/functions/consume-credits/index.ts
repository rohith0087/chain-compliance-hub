import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Credit costs for different report types
const CREDIT_COSTS = {
  standard: 5,
  detailed: 10,
  comparison: 15,
  ai_enhanced: 20,
};

// Helper logging function for debugging
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CONSUME-CREDITS] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Create Supabase client with service role key for database operations
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Parse request body
    const { reportType, description, referenceId, referenceType } = await req.json();
    if (!reportType) {
      throw new Error("Missing required field: reportType");
    }

    // Get credit cost for report type
    const creditCost = CREDIT_COSTS[reportType as keyof typeof CREDIT_COSTS];
    if (!creditCost) {
      throw new Error(`Invalid report type: ${reportType}`);
    }

    logStep("Request parsed", { reportType, creditCost, description, referenceId, referenceType });

    // Check if user has enterprise subscription (unlimited credits)
    const { data: subscription } = await supabaseClient
      .from('subscriptions')
      .select('plan_type, status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    // Enterprise users have unlimited credits
    if (subscription && (
      subscription.plan_type === 'buyer_enterprise' || 
      subscription.plan_type === 'supplier_enterprise'
    )) {
      logStep("Enterprise user - unlimited credits");
      
      // Still log the transaction for tracking
      await supabaseClient
        .from('credit_transactions')
        .insert({
          user_id: user.id,
          transaction_type: 'consumption',
          credits_amount: -creditCost,
          description: description || `Generated ${reportType} report`,
          reference_id: referenceId,
          reference_type: referenceType || 'report',
          metadata: { 
            report_type: reportType, 
            enterprise_unlimited: true 
          }
        });

      return new Response(JSON.stringify({
        success: true,
        credits_consumed: creditCost,
        remaining_credits: 999999, // Unlimited
        is_enterprise: true
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // For non-enterprise users, consume credits using the database function
    const { data, error } = await supabaseClient
      .rpc('consume_credits', {
        p_user_id: user.id,
        p_credits_amount: creditCost,
        p_description: description || `Generated ${reportType} report`,
        p_reference_id: referenceId,
        p_reference_type: referenceType || 'report'
      });

    if (error) {
      logStep("Error consuming credits", { error });
      throw error;
    }

    if (!data) {
      logStep("Insufficient credits");
      return new Response(JSON.stringify({
        success: false,
        error: "Insufficient credits",
        credits_needed: creditCost
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Get updated credit balance
    const { data: updatedCredits } = await supabaseClient
      .from('user_credits')
      .select('available_credits')
      .eq('user_id', user.id)
      .single();

    logStep("Credits consumed successfully", { 
      creditCost, 
      remainingCredits: updatedCredits?.available_credits 
    });

    return new Response(JSON.stringify({
      success: true,
      credits_consumed: creditCost,
      remaining_credits: updatedCredits?.available_credits || 0,
      is_enterprise: false
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in consume-credits", { message: errorMessage });
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});