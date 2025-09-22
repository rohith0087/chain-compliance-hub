import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BulkUploadRequest {
  bulkUploadId: string;
  supplierId: string;
  buyerId: string;
  files: {
    fileName: string;
    fileSize: number;
    mimeType: string;
    documentType: string;
    documentName: string;
    category?: string;
    description?: string;
    filePath?: string;
  }[];
  notes?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { bulkUploadId, supplierId, buyerId, files, notes }: BulkUploadRequest = await req.json();

    console.log(`Processing bulk upload ${bulkUploadId} for supplier ${supplierId}`);

    // Process each file
    const results = [];
    for (const fileInfo of files) {
      try {
        // Create document request for this file
        const { data: docRequest, error: requestError } = await supabase
          .from('document_requests')
          .insert({
            buyer_id: buyerId,
            supplier_id: supplierId,
            title: fileInfo.documentName,
            description: fileInfo.description || `Pre-populated by buyer`,
            document_type: fileInfo.documentType,
            category: fileInfo.category || 'compliance',
            status: 'submitted', // Set as submitted since document is pre-populated
            priority: 'medium',
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (requestError) {
          console.error('Error creating document request:', requestError);
          results.push({ 
            fileName: fileInfo.fileName, 
            success: false, 
            error: requestError.message 
          });
          continue;
        }

        // Create document upload entry with actual file path
        const { data: docUpload, error: uploadError } = await supabase
          .from('document_uploads')
          .insert({
            request_id: docRequest.id,
            uploader_id: null, // Will be set when actual file is uploaded
            document_name: fileInfo.documentName,
            file_name: fileInfo.fileName,
            file_path: fileInfo.filePath || `pre-populated/${bulkUploadId}/${fileInfo.fileName}`,
            file_size: fileInfo.fileSize,
            mime_type: fileInfo.mimeType,
            status: 'submitted',
            uploaded_by_buyer: true,
            original_uploader_type: 'buyer',
            buyer_notes: notes,
            pre_populated_at: new Date().toISOString(),
            metadata: {
              bulk_upload_id: bulkUploadId,
              pre_populated: true,
              original_file_info: fileInfo,
              uploaded_to_storage: !!fileInfo.filePath
            }
          })
          .select()
          .single();

        if (uploadError) {
          console.error('Error creating document upload:', uploadError);
          results.push({ 
            fileName: fileInfo.fileName, 
            success: false, 
            error: uploadError.message 
          });
          continue;
        }

        // Notify supplier about new pre-populated document
        await supabase.functions.invoke('send-supplier-notification', {
          body: {
            supplierId,
            title: 'Documents Pre-populated by Buyer',
            message: `A buyer has pre-populated document "${fileInfo.documentName}" for your review.`,
            type: 'document_prepopulated',
            referenceId: docRequest.id
          }
        });

        results.push({ 
          fileName: fileInfo.fileName, 
          success: true, 
          documentRequestId: docRequest.id,
          documentUploadId: docUpload.id
        });

      } catch (error) {
        console.error(`Error processing file ${fileInfo.fileName}:`, error);
        results.push({ 
          fileName: fileInfo.fileName, 
          success: false, 
          error: error.message 
        });
      }
    }

    // Update bulk upload status
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
    await supabase
      .from('bulk_document_uploads')
      .update({
        processed_files: files.length,
        successful_uploads: successCount,
        failed_uploads: failureCount,
        status: failureCount === 0 ? 'completed' : 'completed',
        error_details: results.filter(r => !r.success),
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', bulkUploadId);

    console.log(`Bulk upload completed: ${successCount} successful, ${failureCount} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: files.length,
        successful: successCount,
        failed: failureCount,
        results 
      }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    );

  } catch (error) {
    console.error('Error in bulk document processor:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    );
  }
});