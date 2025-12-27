import { supabase } from '@/integrations/supabase/client';

/**
 * Log document activity to the audit trail
 */
export async function logDocumentActivity(
  documentUploadId: string | null,
  documentRequestId: string | null,
  actionType: 'requested' | 'uploaded' | 'approved' | 'rejected' | 'downloaded' | 'link_created' | 'link_accessed' | 'withdrawn',
  notes?: string,
  metadata?: Record<string, any>
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.warn('No authenticated user for audit logging');
      return;
    }

    const { error } = await supabase
      .from('document_activity_logs')
      .insert({
        document_upload_id: documentUploadId,
        document_request_id: documentRequestId,
        user_id: user.id,
        action_type: actionType,
        notes,
        metadata: {
          ...metadata,
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
          timestamp: new Date().toISOString()
        }
      });

    if (error) {
      console.error('Failed to log document activity:', error);
    }
  } catch (err) {
    console.error('Error in logDocumentActivity:', err);
  }
}

/**
 * Log document download event
 */
export async function logDocumentDownload(
  documentUploadId: string,
  documentRequestId: string | null,
  fileName: string
) {
  return logDocumentActivity(
    documentUploadId,
    documentRequestId,
    'downloaded',
    `Document downloaded: ${fileName}`,
    { file_name: fileName }
  );
}
