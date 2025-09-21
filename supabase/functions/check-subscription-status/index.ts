import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper logging function for debugging
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION-STATUS] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

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

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Get user's current subscription from database
    const { data: dbSubscription, error: dbError } = await supabaseClient
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    logStep("Database subscription check", { dbSubscription, dbError });

    // Get user's current credits
    const { data: userCredits, error: creditsError } = await supabaseClient
      .from('user_credits')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    logStep("User credits check", { userCredits, creditsError });

    // Check Stripe for customer and subscription status
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No Stripe customer found");
      return new Response(JSON.stringify({ 
        subscribed: false,
        plan_type: null,
        subscription_end: null,
        credits: userCredits?.available_credits || 0,
        stripe_customer_exists: false
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    // Get active subscriptions from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    const hasActiveSubscription = subscriptions.data.length > 0;
    let planType = null;
    let subscriptionEnd = null;
    let stripeSubscriptionId = null;

    if (hasActiveSubscription) {
      const subscription = subscriptions.data[0];
      stripeSubscriptionId = subscription.id;
      subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
      
      // Get plan type from subscription metadata or price ID
      const priceId = subscription.items.data[0].price.id;
      
      // Look up plan type from our configurations
      const { data: planConfig } = await supabaseClient
        .from('subscription_plan_configs')
        .select('plan_type')
        .eq('stripe_price_id', priceId)
        .maybeSingle();
      
      planType = planConfig?.plan_type || null;
      
      logStep("Active subscription found", { 
        subscriptionId: subscription.id, 
        endDate: subscriptionEnd,
        planType,
        priceId
      });

      // Update or create subscription record in database
      if (dbSubscription) {
        await supabaseClient
          .from('subscriptions')
          .update({
            stripe_customer_id: customerId,
            stripe_subscription_id: stripeSubscriptionId,
            plan_type: planType,
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: subscriptionEnd,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);
      } else {
        await supabaseClient
          .from('subscriptions')
          .insert({
            user_id: user.id,
            stripe_customer_id: customerId,
            stripe_subscription_id: stripeSubscriptionId,
            plan_type: planType,
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: subscriptionEnd,
            price_id: priceId,
          });
      }
    } else {
      logStep("No active subscription found");
      
      // Update database subscription status if exists
      if (dbSubscription) {
        await supabaseClient
          .from('subscriptions')
          .update({
            status: 'canceled',
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);
      }
    }

    return new Response(JSON.stringify({
      subscribed: hasActiveSubscription,
      plan_type: planType,
      subscription_end: subscriptionEnd,
      credits: userCredits?.available_credits || 0,
      stripe_customer_exists: true,
      total_purchased_credits: userCredits?.total_purchased_credits || 0,
      total_consumed_credits: userCredits?.total_consumed_credits || 0
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-subscription-status", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});