import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface BulkUploadFile {
  file: File;
  documentType: string;
  documentName: string;
  category?: string;
  description?: string;
  expirationDate?: string;
  existingRequestId?: string;
}

export interface BulkUploadProgress {
  id: string;
  totalFiles: number;
  processedFiles: number;
  successfulUploads: number;
  failedUploads: number;
  status: 'processing' | 'completed' | 'failed';
  errors: string[];
}

export const useBulkDocumentUpload = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<BulkUploadProgress | null>(null);
  const { toast } = useToast();

  const uploadDocumentsForSupplier = useCallback(async (
    supplierId: string,
    buyerId: string,
    files: BulkUploadFile[],
    notes?: string,
    branchId?: string
  ) => {
    try {
      setIsUploading(true);

      // Create bulk upload record
      const { data: bulkUpload, error: bulkError } = await supabase
        .from('bulk_document_uploads')
        .insert({
          buyer_id: buyerId,
          supplier_id: supplierId,
          total_files: files.length,
          status: 'processing',
          created_by: (await supabase.auth.getUser()).data.user?.id!,
          metadata: { notes }
        })
        .select()
        .single();

      if (bulkError) throw bulkError;

      setProgress({
        id: bulkUpload.id,
        totalFiles: files.length,
        processedFiles: 0,
        successfulUploads: 0,
        failedUploads: 0,
        status: 'processing',
        errors: []
      });

      // Upload files to storage first
      const uploadPromises = files.map(async (f, index) => {
        const fileName = `${Date.now()}-${f.file.name}`;
        const filePath = `buyer-${buyerId}/supplier-${supplierId}/${fileName}`;
        
        // Upload file to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('compliance-documents')
          .upload(filePath, f.file, {
            cacheControl: '3600',
            upsert: false,
            metadata: {
              documentType: f.documentType,
              documentName: f.documentName,
              category: f.category || 'compliance',
              uploadedBy: 'buyer',
              originalFileName: f.file.name
            }
          });

        if (uploadError) {
          console.error(`Error uploading file ${f.file.name}:`, uploadError);
          throw uploadError;
        }

        // Update progress
        setProgress(prev => prev ? { 
          ...prev, 
          processedFiles: prev.processedFiles + 1 
        } : null);

        return {
          fileName: f.file.name,
          fileSize: f.file.size,
          mimeType: f.file.type,
          documentType: f.documentType,
          documentName: f.documentName,
          category: f.category,
          description: f.description,
          filePath: uploadData.path,
          expirationDate: f.expirationDate,
          existingRequestId: f.existingRequestId
        };
      });

      const fileData = await Promise.all(uploadPromises);

      // Process files using edge function
      const { data, error } = await supabase.functions.invoke('bulk-document-processor', {
        body: {
          bulkUploadId: bulkUpload.id,
          supplierId,
          buyerId,
          branchId,
          files: fileData,
          notes
        }
      });

      if (error) throw error;

      toast({
        title: "Bulk Upload Completed",
        description: `Successfully processed ${fileData.length} documents`,
      });

      return bulkUpload.id;
    } catch (error) {
      console.error('Error starting bulk upload:', error);
      toast({
        title: "Upload Failed",
        description: "Failed to start bulk document upload",
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsUploading(false);
    }
  }, [toast]);

  const getBulkUploadStatus = useCallback(async (bulkUploadId: string) => {
    try {
      const { data, error } = await supabase
        .from('bulk_document_uploads')
        .select('*')
        .eq('id', bulkUploadId)
        .single();

      if (error) throw error;

      setProgress({
        id: data.id,
        totalFiles: data.total_files,
        processedFiles: data.processed_files,
        successfulUploads: data.successful_uploads,
        failedUploads: data.failed_uploads,
        status: data.status as any,
        errors: Array.isArray(data.error_details) ? data.error_details.map(e => typeof e === 'string' ? e : JSON.stringify(e)) : []
      });

      return data;
    } catch (error) {
      console.error('Error fetching bulk upload status:', error);
      throw error;
    }
  }, []);

  return {
    isUploading,
    progress,
    uploadDocumentsForSupplier,
    getBulkUploadStatus,
    setProgress
  };
};
