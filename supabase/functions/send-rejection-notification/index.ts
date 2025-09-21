import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

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
      upload_id, 
      supplier_id, 
      rejection_reason, 
      issues, 
      suggestions 
    } = await req.json();

    // Get supplier email
    const { data: supplier, error: supplierError } = await supabase
      .from('suppliers')
      .select('contact_email, company_name')
      .eq('id', supplier_id)
      .single();

    if (supplierError || !supplier) {
      throw new Error('Supplier not found');
    }

    // Get document details
    const { data: upload, error: uploadError } = await supabase
      .from('document_uploads')
      .select(`
        file_name,
        document_requests!inner(document_type, buyers!inner(company_name))
      `)
      .eq('id', upload_id)
      .single();

    if (uploadError || !upload) {
      throw new Error('Document upload not found');
    }

    const buyerName = upload.document_requests.buyers.company_name;

    const emailResponse = await resend.emails.send({
      from: "Compliance System <compliance@tracer2c.com>",
      to: [supplier.contact_email],
      subject: `Document Rejected: ${upload.file_name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">Document Submission Rejected</h2>
          
          <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; margin: 20px 0;">
            <p><strong>Your document submission has been rejected and requires corrections.</strong></p>
          </div>
          
          <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Submission Details</h3>
            <p><strong>Document:</strong> ${upload.file_name}</p>
            <p><strong>Document Type:</strong> ${upload.document_requests.document_type}</p>
            <p><strong>Buyer:</strong> ${buyerName}</p>
            <p><strong>Company:</strong> ${supplier.company_name}</p>
          </div>
          
          <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #dc2626;">Rejection Reason</h3>
            <p>${rejection_reason}</p>
          </div>
          
          ${issues && issues.length > 0 ? `
          <div style="margin: 30px 0;">
            <h3>Issues Found</h3>
            <ul style="color: #dc2626;">
              ${issues.map((issue: string) => `<li>${issue}</li>`).join('')}
            </ul>
          </div>
          ` : ''}
          
          ${suggestions && suggestions.length > 0 ? `
          <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Suggestions for Correction</h3>
            <ul>
              ${suggestions.map((suggestion: string) => `<li>${suggestion}</li>`).join('')}
            </ul>
          </div>
          ` : ''}
          
          <div style="margin: 30px 0;">
            <h3>Next Steps</h3>
            <ol>
              <li>Review the issues identified above</li>
              <li>Correct the document according to the requirements</li>
              <li>Resubmit through the compliance portal</li>
              <li>Contact support if you need clarification</li>
            </ol>
          </div>
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            This is an automated notification from your compliance management system.
            Our AI agent reviewed your submission and identified areas that need attention.
          </p>
        </div>
      `,
    });

    console.log("Rejection notification sent:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error("Error sending rejection notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});