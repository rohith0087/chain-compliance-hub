import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/corsHeaders.ts";

// Credit packages mapping
const CREDIT_PACKAGES = {
  "price_1S9wEnAKCMksc2ZO0LGUCbEO": { credits: 50, name: "50 Credits Package" },
  "price_1S9wEwAKCMksc2ZOvyXzj4Is": { credits: 100, name: "100 Credits Package" },
  "price_1S9wHMAKCMksc2ZOzphl59cV": { credits: 500, name: "500 Credits Package" },
};

// Helper logging function for debugging
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CREDIT-PURCHASE] ${step}${detailsStr}`);
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    // Create Supabase client using service role key for authentication
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
    const { priceId, quantity = 1 } = await req.json();
    if (!priceId) {
      throw new Error("Missing required field: priceId");
    }

    // Validate price ID is for a credit package
    const creditPackage = CREDIT_PACKAGES[priceId as keyof typeof CREDIT_PACKAGES];
    if (!creditPackage) {
      throw new Error("Invalid credit package price ID");
    }

    logStep("Request parsed", { priceId, quantity, creditPackage });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check if customer already exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    } else {
      // Create new customer
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          user_id: user.id,
        },
      });
      customerId = customer.id;
      logStep("New customer created", { customerId });
    }

    // Create checkout session for credit purchase
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: quantity,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin") || "https://compliance.tracer2c.com"}/credits?success=true&credits=${creditPackage.credits * quantity}`,
      cancel_url: `${req.headers.get("origin") || "https://compliance.tracer2c.com"}/credits?canceled=true`,
      metadata: {
        user_id: user.id,
        credit_amount: (creditPackage.credits * quantity).toString(),
        package_name: creditPackage.name,
      },
    });

    logStep("Credit purchase checkout session created", { 
      sessionId: session.id, 
      url: session.url,
      credits: creditPackage.credits * quantity
    });

    return new Response(JSON.stringify({ 
      url: session.url,
      credits: creditPackage.credits * quantity,
      package_name: creditPackage.name
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-credit-purchase", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});