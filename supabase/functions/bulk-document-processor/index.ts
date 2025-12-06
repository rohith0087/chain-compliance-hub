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
    expirationDate?: string;
    existingRequestId?: string;
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
        let requestId: string;
        let isNewRequest = true;

        // Check if we should link to an existing request
        if (fileInfo.existingRequestId) {
          // Verify the existing request exists and belongs to this buyer/supplier
          const { data: existingRequest, error: checkError } = await supabase
            .from('document_requests')
            .select('id, title')
            .eq('id', fileInfo.existingRequestId)
            .eq('buyer_id', buyerId)
            .eq('supplier_id', supplierId)
            .single();

          if (!checkError && existingRequest) {
            requestId = existingRequest.id;
            isNewRequest = false;
            console.log(`Linking to existing request: ${requestId} (${existingRequest.title})`);
          } else {
            console.log(`Existing request ${fileInfo.existingRequestId} not found, creating new`);
          }
        }

        // Create new document request if not linking to existing
        if (isNewRequest) {
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
          requestId = docRequest.id;
        }

        // Get current version count for this request
        const { count: versionCount } = await supabase
          .from('document_uploads')
          .select('*', { count: 'exact', head: true })
          .eq('request_id', requestId);

        const newVersion = (versionCount || 0) + 1;

        // Create document upload entry with expiration date and version
        const { data: docUpload, error: uploadError } = await supabase
          .from('document_uploads')
          .insert({
            request_id: requestId,
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
            expiration_date: fileInfo.expirationDate || null,
            version: newVersion,
            metadata: {
              bulk_upload_id: bulkUploadId,
              pre_populated: true,
              original_file_info: fileInfo,
              uploaded_to_storage: !!fileInfo.filePath,
              linked_to_existing: !isNewRequest
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

        // If linking to existing request, update the request status to reflect new upload
        if (!isNewRequest) {
          await supabase
            .from('document_requests')
            .update({ 
              status: 'submitted',
              updated_at: new Date().toISOString()
            })
            .eq('id', requestId);
        }

        // Notify supplier about new pre-populated document
        try {
          await supabase.functions.invoke('send-supplier-notification', {
            body: {
              supplierId,
              title: isNewRequest ? 'Documents Pre-populated by Buyer' : 'Document Version Added',
              message: isNewRequest 
                ? `A buyer has pre-populated document "${fileInfo.documentName}" for your review.`
                : `A buyer has added version ${newVersion} of "${fileInfo.documentName}".`,
              type: 'document_prepopulated',
              referenceId: requestId
            }
          });
        } catch (notifError) {
          console.error('Error sending notification:', notifError);
          // Don't fail the upload if notification fails
        }

        results.push({ 
          fileName: fileInfo.fileName, 
          success: true, 
          documentRequestId: requestId,
          documentUploadId: docUpload.id,
          version: newVersion,
          linkedToExisting: !isNewRequest
        });

        console.log(`Successfully processed ${fileInfo.fileName} as v${newVersion} for request ${requestId}`);

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
    const linkedCount = results.filter(r => r.linkedToExisting).length;
    
    await supabase
      .from('bulk_document_uploads')
      .update({
        processed_files: files.length,
        successful_uploads: successCount,
        failed_uploads: failureCount,
        status: 'completed',
        error_details: results.filter(r => !r.success),
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: {
          linked_to_existing: linkedCount,
          new_requests_created: successCount - linkedCount
        }
      })
      .eq('id', bulkUploadId);

    console.log(`Bulk upload completed: ${successCount} successful (${linkedCount} linked to existing), ${failureCount} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: files.length,
        successful: successCount,
        failed: failureCount,
        linkedToExisting: linkedCount,
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
