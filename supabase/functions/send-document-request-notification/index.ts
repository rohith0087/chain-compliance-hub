import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  requestId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { requestId }: NotificationRequest = await req.json();

    // Get document request with target roles
    const { data: request, error: requestError } = await supabaseClient
      .from('document_requests')
      .select('*, target_contact_roles, supplier_id, buyer_id')
      .eq('id', requestId)
      .single();

    if (requestError || !request) {
      throw new Error('Document request not found');
    }

    // Get supplier profile ID
    const { data: supplier } = await supabaseClient
      .from('suppliers')
      .select('profile_id')
      .eq('id', request.supplier_id)
      .single();

    if (!supplier) {
      throw new Error('Supplier not found');
    }

    let notificationSent = false;

    // If target roles are specified, route to specific contacts
    if (request.target_contact_roles && request.target_contact_roles.length > 0) {
      const { data: contacts } = await supabaseClient
        .from('supplier_contacts')
        .select('*')
        .eq('supplier_id', request.supplier_id)
        .overlaps('roles', request.target_contact_roles);

      if (contacts && contacts.length > 0) {
        // Create notifications for matching contacts
        console.log(`Routing to ${contacts.length} contacts with roles: ${request.target_contact_roles.join(', ')}`);
        
        for (const contact of contacts) {
          await supabaseClient.rpc('create_notification', {
            p_user_id: supplier.profile_id,
            p_title: `New Document Request (for ${contact.contact_name})`,
            p_message: `Document request "${request.title}" requires attention from ${contact.roles.join(', ')} contacts`,
            p_type: 'request_created',
            p_reference_id: requestId
          });
        }
        notificationSent = true;
      } else {
        // No contacts found with specified roles, fallback to primary contact
        console.log('No contacts found with specified roles, falling back to primary contact');
      }
    }

    // Fallback: Send to primary contact or supplier profile
    if (!notificationSent) {
      const { data: primaryContact } = await supabaseClient
        .from('supplier_contacts')
        .select('*')
        .eq('supplier_id', request.supplier_id)
        .eq('is_primary', true)
        .maybeSingle();

      if (primaryContact) {
        await supabaseClient.rpc('create_notification', {
          p_user_id: supplier.profile_id,
          p_title: `New Document Request (for ${primaryContact.contact_name})`,
          p_message: `Document request "${request.title}" requires your attention`,
          p_type: 'request_created',
          p_reference_id: requestId
        });
      } else {
        // No contacts at all, send to supplier profile
        await supabaseClient.rpc('create_notification', {
          p_user_id: supplier.profile_id,
          p_title: 'New Document Request',
          p_message: `You have received a new document request: ${request.title}`,
          p_type: 'request_created',
          p_reference_id: requestId
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Notification sent successfully'
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error sending notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
