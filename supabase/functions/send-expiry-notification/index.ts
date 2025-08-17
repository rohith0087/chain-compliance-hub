import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      supplier_email, 
      buyer_email, 
      document_name, 
      expiration_date, 
      days_until_expiry 
    } = await req.json();

    const emailResponse = await resend.emails.send({
      from: "Compliance System <compliance@resend.dev>",
      to: [supplier_email],
      cc: [buyer_email],
      subject: `Document Expiry Alert: ${document_name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">Document Expiring Soon</h2>
          
          <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; margin: 20px 0;">
            <p><strong>Alert:</strong> Your document is expiring soon and needs to be renewed.</p>
          </div>
          
          <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Document Details</h3>
            <p><strong>Document:</strong> ${document_name}</p>
            <p><strong>Expiration Date:</strong> ${new Date(expiration_date).toLocaleDateString()}</p>
            <p><strong>Days Until Expiry:</strong> ${days_until_expiry} days</p>
          </div>
          
          <div style="margin: 30px 0;">
            <h3>Next Steps</h3>
            <ul>
              <li>Review the document requirements</li>
              <li>Prepare an updated version of the document</li>
              <li>Submit the new document through the compliance portal</li>
              <li>Ensure all information is current and accurate</li>
            </ul>
          </div>
          
          <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; margin: 20px 0;">
            <p><strong>Tip:</strong> We recommend submitting renewed documents at least 7 days before expiration to allow time for review and approval.</p>
          </div>
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            This is an automated notification from your compliance management system.
          </p>
        </div>
      `,
    });

    console.log("Expiry notification sent:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error("Error sending expiry notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});