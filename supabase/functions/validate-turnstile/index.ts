import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, remoteip } = await req.json();

    // Validate input
    if (!token || typeof token !== 'string') {
      console.error('Invalid token format received');
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid token format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (token.length > 2048) {
      console.error('Token too long');
      return new Response(
        JSON.stringify({ success: false, error: 'Token too long' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const secretKey = Deno.env.get('TURNSTILE_SECRET_KEY');
    if (!secretKey) {
      console.error('TURNSTILE_SECRET_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate idempotency key for retry protection
    const idempotencyKey = crypto.randomUUID();

    // Prepare request to Cloudflare Siteverify API
    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', token);
    formData.append('idempotency_key', idempotencyKey);
    
    if (remoteip) {
      formData.append('remoteip', remoteip);
    }

    console.log('Validating Turnstile token...');

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const result = await response.json();

    console.log('Turnstile validation result:', {
      success: result.success,
      hostname: result.hostname,
      action: result.action,
      errorCodes: result['error-codes'],
    });

    if (result.success) {
      return new Response(
        JSON.stringify({
          success: true,
          hostname: result.hostname,
          action: result.action,
          challengeTs: result.challenge_ts,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          errorCodes: result['error-codes'] || [],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Turnstile validation error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
