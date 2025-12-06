import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BulkDownloadRequest {
  documentIds: string[];
  filterDescription: string;
  organizeFolders?: boolean;
  documentMetadata?: Array<{
    title: string;
    uploadIds: string[];
  }>;
}

interface ResolvedStoragePath {
  bucket: string;
  key: string;
}

// Resolve various forms of stored file paths into a bucket + key pair
function resolveStoragePath(input: string | null | undefined): ResolvedStoragePath | null {
  if (!input) return null;
  let value = input.trim();

  // If it's a full URL, try to parse bucket and key
  try {
    if (value.startsWith('http://') || value.startsWith('https://')) {
      const url = new URL(value);
      const parts = url.pathname.split('/').filter(Boolean);
      const idx = parts.findIndex((p) => p === 'object');
      if (idx !== -1 && parts[idx + 1]) {
        const visibilityOrBucket = parts[idx + 1];
        if (visibilityOrBucket === 'public' || visibilityOrBucket === 'sign' || visibilityOrBucket === 'auth') {
          const bucket = parts[idx + 2];
          const key = parts.slice(idx + 3).join('/');
          if (bucket && key) return { bucket, key };
        } else {
          const bucket = visibilityOrBucket;
          const key = parts.slice(idx + 2).join('/');
          if (bucket && key) return { bucket, key };
        }
      }
    }
  } catch {
    // fallthrough to key normalization
  }

  // Normalize leading slashes
  value = value.replace(/^\/+/, '');

  // If the value includes the bucket name as a prefix, strip it
  if (value.startsWith('compliance-documents/')) {
    return { bucket: 'compliance-documents', key: value.replace(/^compliance-documents\//, '') };
  }

  // Check for other known bucket patterns
  if (value.startsWith('pre-populated/')) {
    return { bucket: 'pre-populated', key: value.replace(/^pre-populated\//, '') };
  }

  // Default to compliance-documents bucket for raw keys
  return { bucket: 'compliance-documents', key: value };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Bulk document download request received');
    
    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Admin client for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get user from JWT - already validated by Supabase (verify_jwt = true)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Decode JWT to get user info (JWT is already validated by Supabase)
    const token = authHeader.replace('Bearer ', '');
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.error('Invalid token format - expected 3 parts, got', parts.length);
      return new Response(
        JSON.stringify({ error: 'Invalid token format' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // URL-safe base64 decode with padding fix
    const base64UrlDecode = (str: string) => {
      // Replace URL-safe chars and add padding
      let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
      const padding = base64.length % 4;
      if (padding) {
        base64 += '='.repeat(4 - padding);
      }
      return atob(base64);
    };
    
    let payload: any;
    try {
      payload = JSON.parse(base64UrlDecode(parts[1]));
      console.log('JWT payload decoded, sub:', payload.sub);
    } catch (e) {
      console.error('Failed to decode JWT payload:', e);
      return new Response(
        JSON.stringify({ error: 'Invalid token payload' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const user = {
      id: payload.sub,
      email: payload.email
    };
    
    if (!user.id) {
      console.error('No user ID (sub) in token payload:', Object.keys(payload));
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authenticated user:', user.id, user.email);

    // Get user's buyer ID (either as owner or team member)
    let userBuyerId: string | null = null;
    
    // Check company_users first (team member path)
    const { data: companyUser } = await supabaseAdmin
      .from('company_users')
      .select('company_id, company_type')
      .eq('profile_id', user.id)
      .eq('status', 'active')
      .eq('company_type', 'buyer')
      .single();

    if (companyUser) {
      userBuyerId = companyUser.company_id;
    } else {
      // Check if user is a buyer owner
      const { data: buyer } = await supabaseAdmin
        .from('buyers')
        .select('id')
        .eq('profile_id', user.id)
        .single();
      userBuyerId = buyer?.id || null;
    }

    // Also check for supplier access
    let userSupplierId: string | null = null;
    const { data: supplierCompanyUser } = await supabaseAdmin
      .from('company_users')
      .select('company_id, company_type')
      .eq('profile_id', user.id)
      .eq('status', 'active')
      .eq('company_type', 'supplier')
      .single();

    if (supplierCompanyUser) {
      userSupplierId = supplierCompanyUser.company_id;
    } else {
      const { data: supplier } = await supabaseAdmin
        .from('suppliers')
        .select('id')
        .eq('profile_id', user.id)
        .single();
      userSupplierId = supplier?.id || null;
    }

    if (!userBuyerId && !userSupplierId) {
      console.error('User has no company access:', user.id);
      return new Response(
        JSON.stringify({ error: 'No company access found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User company access - Buyer:', userBuyerId, 'Supplier:', userSupplierId);

    const { documentIds, filterDescription, organizeFolders = true, documentMetadata }: BulkDownloadRequest = await req.json();
    
    if (!documentIds || documentIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No document IDs provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing bulk download for ${documentIds.length} documents, organizeFolders: ${organizeFolders}`);
    
    // Create a map of upload ID to document metadata for folder organization
    const uploadIdToMetadata = new Map<string, { title: string; versionIndex: number; totalVersions: number }>();
    if (documentMetadata) {
      for (const meta of documentMetadata) {
        const totalVersions = meta.uploadIds.length;
        meta.uploadIds.forEach((uploadId, index) => {
          uploadIdToMetadata.set(uploadId, {
            title: meta.title,
            versionIndex: totalVersions - index, // Reverse order: latest version gets highest number
            totalVersions
          });
        });
      }
    }

    // Fetch document details from database with access validation
    let query = supabaseAdmin
      .from('document_uploads')
      .select(`
        id,
        file_path,
        file_name,
        document_requests!inner (
          title,
          document_type,
          supplier_id,
          buyer_id,
          suppliers!inner (
            company_name
          )
        )
      `)
      .in('id', documentIds)
      .not('file_path', 'is', null);

    const { data: documents, error: dbError } = await query;

    if (dbError) {
      console.error('Database error:', dbError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch document details' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!documents || documents.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No documents found with valid files' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================
    // Validate user has access to ALL requested documents
    // ============================================
    const unauthorizedDocs: string[] = [];
    for (const doc of documents) {
      const docBuyerId = doc.document_requests.buyer_id;
      const docSupplierId = doc.document_requests.supplier_id;
      
      const hasAccess = 
        (userBuyerId && docBuyerId === userBuyerId) ||
        (userSupplierId && docSupplierId === userSupplierId);
      
      if (!hasAccess) {
        unauthorizedDocs.push(doc.id);
      }
    }

    if (unauthorizedDocs.length > 0) {
      console.error('User does not have access to documents:', unauthorizedDocs);
      return new Response(
        JSON.stringify({ 
          error: 'Unauthorized access to some documents', 
          unauthorized_count: unauthorizedDocs.length 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${documents.length} valid documents with files - all authorized`);

    // Create ZIP file using streams
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    // Start ZIP creation in background
    (async () => {
      try {
        const zipEntries: Uint8Array[] = [];
        const centralDirectory: Uint8Array[] = [];
        let offset = 0;

        for (const doc of documents) {
          try {
            console.log(`Processing document: ${doc.file_name} with path: ${doc.file_path}`);
            
            const resolvedPath = resolveStoragePath(doc.file_path);
            if (!resolvedPath) {
              console.error(`Could not resolve storage path for ${doc.file_path}`);
              continue;
            }

            console.log(`Resolved path - bucket: ${resolvedPath.bucket}, key: ${resolvedPath.key}`);
            
            let signedUrlData: any = null;
            const { data: urlData, error: urlError } = await supabaseAdmin.storage
              .from(resolvedPath.bucket)
              .createSignedUrl(resolvedPath.key, 300);

            if (urlError || !urlData) {
              console.error(`Failed to get signed URL for ${resolvedPath.bucket}/${resolvedPath.key}:`, urlError);
              const { data: fallbackUrlData, error: fallbackError } = await supabaseAdmin.storage
                .from('compliance-documents')
                .createSignedUrl(doc.file_path, 300);
              
              if (fallbackError || !fallbackUrlData) {
                console.error(`Fallback also failed for ${doc.file_path}:`, fallbackError);
                continue;
              }
              signedUrlData = fallbackUrlData;
            } else {
              signedUrlData = urlData;
            }

            console.log(`Fetching file content from: ${signedUrlData.signedUrl}`);
            const fileResponse = await fetch(signedUrlData.signedUrl);
            if (!fileResponse.ok) {
              console.error(`Failed to fetch file ${doc.file_path}: ${fileResponse.status} ${fileResponse.statusText}`);
              continue;
            }

            const fileContent = new Uint8Array(await fileResponse.arrayBuffer());
            console.log(`Successfully fetched file content, size: ${fileContent.length} bytes`);
            
            const originalFileName = doc.file_name || `document_${doc.id}`;
            let safeFileName: string;
            
            if (organizeFolders) {
              // Get metadata for this upload to determine folder and version prefix
              const metadata = uploadIdToMetadata.get(doc.id);
              
              if (metadata) {
                // Use document title as folder name
                const folderName = metadata.title
                  .replace(/[^a-zA-Z0-9\-_ ]/g, '_')
                  .substring(0, 50)
                  .trim();
                
                // Add version prefix if multiple versions exist
                const versionPrefix = metadata.totalVersions > 1 ? `v${metadata.versionIndex}_` : '';
                safeFileName = `${folderName}/${versionPrefix}${originalFileName}`;
              } else {
                // Fallback: use document_requests.title if metadata not available
                const docTitle = doc.document_requests.title
                  .replace(/[^a-zA-Z0-9\-_ ]/g, '_')
                  .substring(0, 50)
                  .trim();
                safeFileName = `${docTitle}/${originalFileName}`;
              }
            } else {
              // Flat structure - just the filename with supplier prefix
              const supplierName = doc.document_requests.suppliers.company_name
                .replace(/[^a-zA-Z0-9\-_]/g, '_')
                .substring(0, 50);
              safeFileName = `${supplierName}_${originalFileName}`;
            }

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

        for (const entry of zipEntries) {
          await writer.write(entry);
        }

        const centralDirStart = offset;
        for (const header of centralDirectory) {
          await writer.write(header);
          offset += header.length;
        }

        const endRecord = createEndOfCentralDirectory(
          centralDirectory.length,
          offset - centralDirStart,
          centralDirStart
        );
        await writer.write(endRecord);

        await writer.close();
        console.log(`ZIP file creation completed. Successfully processed ${centralDirectory.length}/${documents.length} documents`);

      } catch (error) {
        console.error('Error creating ZIP:', error);
        await writer.abort();
      }
    })();

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
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper functions for ZIP creation
function createZipEntry(filename: string, content: Uint8Array, offset: number) {
  const filenameBytes = new TextEncoder().encode(filename);
  const crc32 = calculateCRC32(content);
  const now = new Date();
  const dosDateTime = dateToDosDateTime(now);

  const localFileHeader = new Uint8Array(30 + filenameBytes.length);
  const localView = new DataView(localFileHeader.buffer);
  
  localView.setUint32(0, 0x04034b50, true);
  localView.setUint16(4, 20, true);
  localView.setUint16(6, 0, true);
  localView.setUint16(8, 0, true);
  localView.setUint32(10, dosDateTime, true);
  localView.setUint32(14, crc32, true);
  localView.setUint32(18, content.length, true);
  localView.setUint32(22, content.length, true);
  localView.setUint16(26, filenameBytes.length, true);
  localView.setUint16(28, 0, true);
  
  localFileHeader.set(filenameBytes, 30);

  const centralDirectoryHeader = new Uint8Array(46 + filenameBytes.length);
  const centralView = new DataView(centralDirectoryHeader.buffer);
  
  centralView.setUint32(0, 0x02014b50, true);
  centralView.setUint16(4, 20, true);
  centralView.setUint16(6, 20, true);
  centralView.setUint16(8, 0, true);
  centralView.setUint16(10, 0, true);
  centralView.setUint32(12, dosDateTime, true);
  centralView.setUint32(16, crc32, true);
  centralView.setUint32(20, content.length, true);
  centralView.setUint32(24, content.length, true);
  centralView.setUint16(28, filenameBytes.length, true);
  centralView.setUint16(30, 0, true);
  centralView.setUint16(32, 0, true);
  centralView.setUint16(34, 0, true);
  centralView.setUint16(36, 0, true);
  centralView.setUint32(38, 0, true);
  centralView.setUint32(42, offset, true);
  
  centralDirectoryHeader.set(filenameBytes, 46);

  return { localFileHeader, centralDirectoryHeader };
}

function createEndOfCentralDirectory(entryCount: number, centralDirSize: number, centralDirOffset: number) {
  const endRecord = new Uint8Array(22);
  const view = new DataView(endRecord.buffer);
  
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, entryCount, true);
  view.setUint16(10, entryCount, true);
  view.setUint32(12, centralDirSize, true);
  view.setUint32(16, centralDirOffset, true);
  view.setUint16(20, 0, true);
  
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
