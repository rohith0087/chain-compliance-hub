import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { useBuyerSupplierConnections } from '@/hooks/useBuyerSupplierConnections';
import { useBulkDocumentUpload, BulkUploadFile } from '@/hooks/useBulkDocumentUpload';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

const DOCUMENT_TYPES = [
  { value: 'business_license', label: 'Business License' },
  { value: 'tax_certificate', label: 'Tax Certificate' },
  { value: 'insurance_certificate', label: 'Insurance Certificate' },
  { value: 'bank_statement', label: 'Bank Statement' },
  { value: 'financial_statement', label: 'Financial Statement' },
  { value: 'compliance_certificate', label: 'Compliance Certificate' },
  { value: 'quality_certificate', label: 'Quality Certificate' },
  { value: 'safety_certificate', label: 'Safety Certificate' },
  { value: 'other', label: 'Other Document' }
];

interface BuyerDocumentPrePopulatorProps {
  buyerId: string;
  onComplete?: () => void;
}

export const BuyerDocumentPrePopulator: React.FC<BuyerDocumentPrePopulatorProps> = ({
  buyerId,
  onComplete
}) => {
  const { user } = useAuth();
  const { connections, loading: connectionsLoading } = useBuyerSupplierConnections(buyerId);
  const { uploadDocumentsForSupplier, isUploading, progress } = useBulkDocumentUpload();
  
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [files, setFiles] = useState<BulkUploadFile[]>([]);
  const [notes, setNotes] = useState('');

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: BulkUploadFile[] = acceptedFiles.map(file => ({
      file,
      documentType: '',
      documentName: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
      category: 'compliance'
    }));
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.jpg', '.jpeg', '.png'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    multiple: true
  });

  const updateFileDocumentType = (index: number, documentType: string) => {
    setFiles(prev => prev.map((file, i) => 
      i === index ? { ...file, documentType } : file
    ));
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (!selectedSupplierId || files.length === 0) return;
    
    const filesWithTypes = files.filter(f => f.documentType);
    if (filesWithTypes.length === 0) {
      alert('Please assign document types to all files');
      return;
    }

    try {
      await uploadDocumentsForSupplier(selectedSupplierId, buyerId, filesWithTypes, notes);
      setFiles([]);
      setNotes('');
      onComplete?.();
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  const selectedSupplier = connections.find(conn => conn.supplier?.id === selectedSupplierId);
  const canUpload = selectedSupplierId && files.length > 0 && files.every(f => f.documentType);

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Pre-populate Supplier Documents
        </CardTitle>
        <CardDescription>
          Upload existing documents on behalf of your connected suppliers to streamline onboarding
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Supplier Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Select Supplier</label>
          <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a connected supplier" />
            </SelectTrigger>
            <SelectContent>
              {connections.map((connection) => (
                <SelectItem key={connection.supplier?.id} value={connection.supplier?.id || ''}>
                  <div className="flex items-center gap-2">
                    <span>{connection.supplier?.company_name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {connection.supplier?.industry}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* File Upload Area */}
        <div
          {...getRootProps()}
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
            isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
          )}
        >
          <input {...getInputProps()} />
          <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-medium mb-2">
            {isDragActive ? "Drop files here" : "Drag & drop documents"}
          </p>
          <p className="text-sm text-muted-foreground">
            Supports PDF, DOC, DOCX, JPG, PNG files
          </p>
        </div>

        {/* File List */}
        {files.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-medium">Documents to Upload ({files.length})</h3>
            <div className="space-y-3">
              {files.map((file, index) => (
                <div key={index} className="flex items-center gap-4 p-3 border rounded-lg">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{file.file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <Select 
                    value={file.documentType} 
                    onValueChange={(value) => updateFileDocumentType(index, value)}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Document type" />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(index)}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Notes (Optional)</label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any notes about these documents..."
            rows={3}
          />
        </div>

        {/* Progress */}
        {progress && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Upload Progress</span>
              <span className="text-sm text-muted-foreground">
                {progress.processedFiles} / {progress.totalFiles}
              </span>
            </div>
            <Progress 
              value={(progress.processedFiles / progress.totalFiles) * 100} 
              className="h-2"
            />
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1 text-green-600">
                <CheckCircle className="h-4 w-4" />
                {progress.successfulUploads} successful
              </div>
              {progress.failedUploads > 0 && (
                <div className="flex items-center gap-1 text-red-600">
                  <XCircle className="h-4 w-4" />
                  {progress.failedUploads} failed
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => {
              setFiles([]);
              setSelectedSupplierId('');
              setNotes('');
            }}
            disabled={isUploading}
          >
            Clear All
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!canUpload || isUploading}
            className="min-w-32"
          >
            {isUploading ? 'Uploading...' : `Upload ${files.length} Documents`}
          </Button>
        </div>

        {selectedSupplier && (
          <div className="mt-4 p-4 bg-muted/50 rounded-lg">
            <p className="text-sm">
              <strong>Selected Supplier:</strong> {selectedSupplier.supplier?.company_name}
              <br />
              <strong>Contact:</strong> {selectedSupplier.supplier?.contact_email}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};