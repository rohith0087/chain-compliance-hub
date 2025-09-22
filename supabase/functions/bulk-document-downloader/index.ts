import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BulkDownloadRequest {
  documentIds: string[];
  filterDescription: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Bulk document download request received');
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { documentIds, filterDescription }: BulkDownloadRequest = await req.json();
    
    if (!documentIds || documentIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No document IDs provided' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Processing bulk download for ${documentIds.length} documents`);

    // Fetch document details from database
    const { data: documents, error: dbError } = await supabase
      .from('document_uploads')
      .select(`
        id,
        file_path,
        file_name,
        document_requests!inner (
          title,
          document_type,
          supplier_id,
          suppliers!inner (
            company_name
          )
        )
      `)
      .in('id', documentIds)
      .not('file_path', 'is', null);

    if (dbError) {
      console.error('Database error:', dbError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch document details' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!documents || documents.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No documents found with valid files' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Found ${documents.length} valid documents with files`);

    // Create ZIP file using streams
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    // Start ZIP creation in background
    (async () => {
      try {
        // Write ZIP file header
        const zipEntries: Uint8Array[] = [];
        const centralDirectory: Uint8Array[] = [];
        let offset = 0;

        for (const doc of documents) {
          try {
            console.log(`Processing document: ${doc.file_name}`);
            
            // Get signed URL for the file
            const { data: signedUrlData, error: urlError } = await supabase.storage
              .from('documents')
              .createSignedUrl(doc.file_path, 300); // 5 minutes

            if (urlError || !signedUrlData) {
              console.error(`Failed to get signed URL for ${doc.file_path}:`, urlError);
              continue;
            }

            // Fetch file content
            const fileResponse = await fetch(signedUrlData.signedUrl);
            if (!fileResponse.ok) {
              console.error(`Failed to fetch file ${doc.file_path}: ${fileResponse.status}`);
              continue;
            }

            const fileContent = new Uint8Array(await fileResponse.arrayBuffer());
            
            // Create safe filename with supplier prefix
            const supplierName = doc.document_requests.suppliers.company_name
              .replace(/[^a-zA-Z0-9\-_]/g, '_')
              .substring(0, 50);
            
            const originalFileName = doc.file_name || `document_${doc.id}`;
            const safeFileName = `${supplierName}/${originalFileName}`;

            // Create ZIP entry
            const entry = createZipEntry(safeFileName, fileContent, offset);
            zipEntries.push(entry.localFileHeader);
            zipEntries.push(fileContent);
            centralDirectory.push(entry.centralDirectoryHeader);
            
            offset += entry.localFileHeader.length + fileContent.length;
            
          } catch (error) {
            console.error(`Error processing document ${doc.id}:`, error);
            continue;
          }
        }

        // Write ZIP entries
        for (const entry of zipEntries) {
          await writer.write(entry);
        }

        // Write central directory
        const centralDirStart = offset;
        for (const header of centralDirectory) {
          await writer.write(header);
          offset += header.length;
        }

        // Write end of central directory record
        const endRecord = createEndOfCentralDirectory(
          centralDirectory.length,
          offset - centralDirStart,
          centralDirStart
        );
        await writer.write(endRecord);

        await writer.close();
        console.log('ZIP file creation completed');

      } catch (error) {
        console.error('Error creating ZIP:', error);
        await writer.abort();
      }
    })();

    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${filterDescription.replace(/[^a-zA-Z0-9\-_]/g, '_')}_${timestamp}.zip`;

    return new Response(readable, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error('Error in bulk-document-downloader function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Helper functions for ZIP creation
function createZipEntry(filename: string, content: Uint8Array, offset: number) {
  const filenameBytes = new TextEncoder().encode(filename);
  const crc32 = calculateCRC32(content);
  const now = new Date();
  const dosDateTime = dateToDosDateTime(now);

  // Local file header
  const localFileHeader = new Uint8Array(30 + filenameBytes.length);
  const localView = new DataView(localFileHeader.buffer);
  
  localView.setUint32(0, 0x04034b50, true); // signature
  localView.setUint16(4, 20, true); // version needed
  localView.setUint16(6, 0, true); // flags
  localView.setUint16(8, 0, true); // compression method (stored)
  localView.setUint32(10, dosDateTime, true); // last mod time & date
  localView.setUint32(14, crc32, true); // crc32
  localView.setUint32(18, content.length, true); // compressed size
  localView.setUint32(22, content.length, true); // uncompressed size
  localView.setUint16(26, filenameBytes.length, true); // filename length
  localView.setUint16(28, 0, true); // extra field length
  
  localFileHeader.set(filenameBytes, 30);

  // Central directory header
  const centralDirectoryHeader = new Uint8Array(46 + filenameBytes.length);
  const centralView = new DataView(centralDirectoryHeader.buffer);
  
  centralView.setUint32(0, 0x02014b50, true); // signature
  centralView.setUint16(4, 20, true); // version made by
  centralView.setUint16(6, 20, true); // version needed
  centralView.setUint16(8, 0, true); // flags
  centralView.setUint16(10, 0, true); // compression method
  centralView.setUint32(12, dosDateTime, true); // last mod time & date
  centralView.setUint32(16, crc32, true); // crc32
  centralView.setUint32(20, content.length, true); // compressed size
  centralView.setUint32(24, content.length, true); // uncompressed size
  centralView.setUint16(28, filenameBytes.length, true); // filename length
  centralView.setUint16(30, 0, true); // extra field length
  centralView.setUint16(32, 0, true); // comment length
  centralView.setUint16(34, 0, true); // disk number
  centralView.setUint16(36, 0, true); // internal attributes
  centralView.setUint32(38, 0, true); // external attributes
  centralView.setUint32(42, offset, true); // local header offset
  
  centralDirectoryHeader.set(filenameBytes, 46);

  return { localFileHeader, centralDirectoryHeader };
}

function createEndOfCentralDirectory(entryCount: number, centralDirSize: number, centralDirOffset: number) {
  const endRecord = new Uint8Array(22);
  const view = new DataView(endRecord.buffer);
  
  view.setUint32(0, 0x06054b50, true); // signature
  view.setUint16(4, 0, true); // disk number
  view.setUint16(6, 0, true); // central dir start disk
  view.setUint16(8, entryCount, true); // entries on this disk
  view.setUint16(10, entryCount, true); // total entries
  view.setUint32(12, centralDirSize, true); // central dir size
  view.setUint32(16, centralDirOffset, true); // central dir offset
  view.setUint16(20, 0, true); // comment length
  
  return endRecord;
}

function calculateCRC32(data: Uint8Array): number {
  const crcTable = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[i] = c;
  }

  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc = crcTable[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function dateToDosDateTime(date: Date): number {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const minute = date.getMinutes();
  const second = Math.floor(date.getSeconds() / 2);

  const dosDate = ((year - 1980) << 9) | (month << 5) | day;
  const dosTime = (hour << 11) | (minute << 5) | second;
  
  return (dosDate << 16) | dosTime;
}