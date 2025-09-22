import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, CheckCircle, XCircle, AlertCircle, Filter } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { useBuyerSupplierConnections } from '@/hooks/useBuyerSupplierConnections';
import { useBulkDocumentUpload, BulkUploadFile } from '@/hooks/useBulkDocumentUpload';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

const DOCUMENT_TYPES = [
  // Basic Business Documents
  { value: 'business_license', label: 'Business License', category: 'basic' },
  { value: 'tax_certificate', label: 'Tax Certificate', category: 'basic' },
  { value: 'insurance_certificate', label: 'Insurance Certificate', category: 'basic' },
  { value: 'bank_statement', label: 'Bank Statement', category: 'basic' },
  { value: 'financial_statement', label: 'Financial Statement', category: 'basic' },
  { value: 'articles_of_incorporation', label: 'Articles of Incorporation', category: 'basic' },
  { value: 'dba_certificate', label: 'DBA Certificate', category: 'basic' },
  { value: 'worker_compensation_insurance', label: 'Workers Compensation Insurance', category: 'basic' },
  { value: 'supplier_agreement', label: 'Supplier Agreement', category: 'basic' },
  
  // Food Safety & Compliance
  { value: 'fda_registration', label: 'FDA Registration', category: 'food_safety' },
  { value: 'fsis_documentation', label: 'FSIS Documentation', category: 'food_safety' },
  { value: 'haccp_plan', label: 'HACCP Plan', category: 'food_safety' },
  { value: 'ssop_documentation', label: 'SSOP Documentation', category: 'food_safety' },
  { value: 'gmp_documentation', label: 'GMP Documentation', category: 'food_safety' },
  { value: 'food_safety_modernization_act', label: 'Food Safety Modernization Act (FSMA)', category: 'food_safety' },
  { value: 'allergen_control_plan', label: 'Allergen Control Plan', category: 'food_safety' },
  
  // Quality & Certifications
  { value: 'sqf_certificate', label: 'SQF Certificate', category: 'quality' },
  { value: 'brc_certificate', label: 'BRC Certificate', category: 'quality' },
  { value: 'iso_9001', label: 'ISO 9001 Certificate', category: 'quality' },
  { value: 'iso_14001', label: 'ISO 14001 Certificate', category: 'quality' },
  { value: 'iso_22000', label: 'ISO 22000 Certificate', category: 'quality' },
  { value: 'gfsi_certificate', label: 'GFSI Certificate', category: 'quality' },
  { value: 'organic_certification', label: 'Organic Certification', category: 'quality' },
  { value: 'non_gmo_certification', label: 'Non-GMO Certification', category: 'quality' },
  { value: 'kosher_certification', label: 'Kosher Certification', category: 'quality' },
  { value: 'halal_certification', label: 'Halal Certification', category: 'quality' },
  
  // Poultry Egg Supplier
  { value: 'egg_quality_documentation', label: 'Egg Quality Documentation', category: 'poultry_egg' },
  { value: 'layer_management_records', label: 'Layer Management Records', category: 'poultry_egg' },
  { value: 'egg_safety_records', label: 'Egg Safety Records', category: 'poultry_egg' },
  { value: 'npip_certification', label: 'NPIP Certification', category: 'poultry_egg' },
  { value: 'egg_grading_standards', label: 'Egg Grading Standards', category: 'poultry_egg' },
  { value: 'cage_free_certification', label: 'Cage-Free Certification', category: 'poultry_egg' },
  { value: 'pasture_raised_certification', label: 'Pasture-Raised Certification', category: 'poultry_egg' },
  { value: 'shell_egg_storage_conditions', label: 'Shell Egg Storage Conditions', category: 'poultry_egg' },
  
  // Poultry Ingredient Supplier
  { value: 'ingredient_specifications', label: 'Ingredient Specifications', category: 'poultry_ingredient' },
  { value: 'nutritional_analysis', label: 'Nutritional Analysis', category: 'poultry_ingredient' },
  { value: 'feed_safety_documentation', label: 'Feed Safety Documentation', category: 'poultry_ingredient' },
  { value: 'supply_chain_documentation', label: 'Supply Chain Documentation', category: 'poultry_ingredient' },
  { value: 'antibiotic_free_certification', label: 'Antibiotic-Free Certification', category: 'poultry_ingredient' },
  { value: 'mycotoxin_testing_reports', label: 'Mycotoxin Testing Reports', category: 'poultry_ingredient' },
  { value: 'salmonella_testing_reports', label: 'Salmonella Testing Reports', category: 'poultry_ingredient' },
  
  // Poultry Packaging Supplier
  { value: 'packaging_specifications', label: 'Packaging Specifications', category: 'poultry_packaging' },
  { value: 'material_certifications', label: 'Material Certifications', category: 'poultry_packaging' },
  { value: 'food_contact_compliance', label: 'Food Contact Compliance', category: 'poultry_packaging' },
  { value: 'migration_testing_reports', label: 'Migration Testing Reports', category: 'poultry_packaging' },
  { value: 'recyclable_certification', label: 'Recyclable Certification', category: 'poultry_packaging' },
  { value: 'bpa_free_certification', label: 'BPA-Free Certification', category: 'poultry_packaging' },
  
  // Processing & Manufacturing
  { value: 'processing_procedures', label: 'Processing Procedures', category: 'processing' },
  { value: 'product_specifications', label: 'Product Specifications', category: 'processing' },
  { value: 'shelf_life_studies', label: 'Shelf Life Studies', category: 'processing' },
  { value: 'cold_chain_documentation', label: 'Cold Chain Documentation', category: 'processing' },
  { value: 'trace_back_procedures', label: 'Trace Back Procedures', category: 'processing' },
  { value: 'recall_procedures', label: 'Recall Procedures', category: 'processing' },
  
  // Laboratory & Testing
  { value: 'laboratory_accreditation', label: 'Laboratory Accreditation', category: 'testing' },
  { value: 'microbiology_testing_reports', label: 'Microbiology Testing Reports', category: 'testing' },
  { value: 'pathogen_testing_reports', label: 'Pathogen Testing Reports', category: 'testing' },
  { value: 'nutritional_testing_reports', label: 'Nutritional Testing Reports', category: 'testing' },
  { value: 'pesticide_residue_testing', label: 'Pesticide Residue Testing', category: 'testing' },
  { value: 'heavy_metals_testing', label: 'Heavy Metals Testing', category: 'testing' },
  
  // Audit & Compliance
  { value: 'third_party_audit_reports', label: 'Third Party Audit Reports', category: 'audit' },
  { value: 'customer_audit_reports', label: 'Customer Audit Reports', category: 'audit' },
  { value: 'corrective_action_reports', label: 'Corrective Action Reports', category: 'audit' },
  { value: 'supplier_verification_records', label: 'Supplier Verification Records', category: 'audit' },
  { value: 'environmental_monitoring', label: 'Environmental Monitoring', category: 'audit' },
  
  { value: 'other', label: 'Other Document', category: 'other' }
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
  const [customDocumentTypes, setCustomDocumentTypes] = useState<{[index: number]: string}>({});
  const [searchFilter, setSearchFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

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
      i === index ? { 
        ...file, 
        documentType: documentType === 'other' && customDocumentTypes[index] 
          ? customDocumentTypes[index] 
          : documentType 
      } : file
    ));
  };

  const updateCustomDocumentType = (index: number, customType: string) => {
    setCustomDocumentTypes(prev => ({ ...prev, [index]: customType }));
    setFiles(prev => prev.map((file, i) => 
      i === index ? { ...file, documentType: customType } : file
    ));
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    // Clean up custom document type for this index
    setCustomDocumentTypes(prev => {
      const updated = { ...prev };
      delete updated[index];
      // Reindex remaining entries
      const reindexed: {[index: number]: string} = {};
      Object.entries(updated).forEach(([key, value]) => {
        const oldIndex = parseInt(key);
        if (oldIndex > index) {
          reindexed[oldIndex - 1] = value;
        } else {
          reindexed[oldIndex] = value;
        }
      });
      return reindexed;
    });
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

  const selectedSupplier = connections.find(
    (conn) => (conn.supplier?.id ?? conn.supplier_id) === selectedSupplierId
  );
  const canUpload = selectedSupplierId && files.length > 0 && files.every(f => f.documentType);

  // Filter document types based on search and category
  const filteredDocumentTypes = DOCUMENT_TYPES.filter(type => {
    const matchesSearch = type.label.toLowerCase().includes(searchFilter.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || type.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'basic', label: 'Basic Business' },
    { value: 'food_safety', label: 'Food Safety & Compliance' },
    { value: 'quality', label: 'Quality & Certifications' },
    { value: 'poultry_egg', label: 'Poultry Egg Supplier' },
    { value: 'poultry_ingredient', label: 'Poultry Ingredient Supplier' },
    { value: 'poultry_packaging', label: 'Poultry Packaging Supplier' },
    { value: 'processing', label: 'Processing & Manufacturing' },
    { value: 'testing', label: 'Laboratory & Testing' },
    { value: 'audit', label: 'Audit & Compliance' },
    { value: 'other', label: 'Other' }
  ];

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
                <SelectItem
                  key={connection.supplier?.id ?? connection.supplier_id}
                  value={connection.supplier?.id ?? connection.supplier_id}
                >
                  <div className="flex items-center gap-2">
                    <span>{connection.supplier?.company_name ?? `Supplier ${connection.supplier_id.slice(0, 8)}`}</span>
                    {connection.supplier?.industry && (
                      <Badge variant="secondary" className="text-xs">
                        {connection.supplier.industry}
                      </Badge>
                    )}
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
                  <div className="space-y-2">
                    <Select 
                      value={file.documentType === customDocumentTypes[index] ? 'other' : file.documentType} 
                      onValueChange={(value) => updateFileDocumentType(index, value)}
                    >
                      <SelectTrigger className="w-64">
                        <SelectValue placeholder="Document type" />
                      </SelectTrigger>
                      <SelectContent className="max-h-96">
                        <div className="p-2 space-y-2 border-b">
                          <div className="flex items-center gap-2">
                            <Filter className="h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="Search document types..."
                              value={searchFilter}
                              onChange={(e) => setSearchFilter(e.target.value)}
                              className="h-8"
                            />
                          </div>
                          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.map(cat => (
                                <SelectItem key={cat.value} value={cat.value}>
                                  {cat.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                          {filteredDocumentTypes.map(type => (
                            <SelectItem key={type.value} value={type.value}>
                              <div className="flex items-center justify-between w-full">
                                <span>{type.label}</span>
                                <Badge variant="outline" className="text-xs ml-2">
                                  {categories.find(c => c.value === type.category)?.label}
                                </Badge>
                              </div>
                            </SelectItem>
                          ))}
                        </div>
                      </SelectContent>
                    </Select>
                    
                    {(file.documentType === 'other' || file.documentType === customDocumentTypes[index]) && (
                      <Input
                        placeholder="Enter custom document type..."
                        value={customDocumentTypes[index] || ''}
                        onChange={(e) => updateCustomDocumentType(index, e.target.value)}
                        className="w-64"
                      />
                    )}
                  </div>
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
              setCustomDocumentTypes({});
              setSearchFilter('');
              setCategoryFilter('all');
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
              <strong>Selected Supplier:</strong> {selectedSupplier.supplier?.company_name ?? `Supplier ${selectedSupplier.supplier_id.slice(0, 8)}`}
              <br />
              <strong>Contact:</strong> {selectedSupplier.supplier?.contact_email ?? 'N/A'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};