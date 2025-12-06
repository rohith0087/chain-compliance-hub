import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, FileText, CheckCircle, XCircle, Filter, X, Building2, CalendarIcon, Link2 } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { useBuyerSupplierConnections } from '@/hooks/useBuyerSupplierConnections';
import { useBulkDocumentUpload, BulkUploadFile } from '@/hooks/useBulkDocumentUpload';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

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
  
  // Egg Processing
  { value: 'egg_quality_documentation', label: 'Egg Quality Documentation', category: 'egg_processing' },
  { value: 'layer_management_records', label: 'Layer Management Records', category: 'egg_processing' },
  { value: 'egg_safety_records', label: 'Egg Safety Records', category: 'egg_processing' },
  { value: 'npip_certification', label: 'NPIP Certification', category: 'egg_processing' },
  { value: 'egg_grading_standards', label: 'Egg Grading Standards', category: 'egg_processing' },
  { value: 'cage_free_certification', label: 'Cage-Free Certification', category: 'egg_processing' },
  { value: 'pasture_raised_certification', label: 'Pasture-Raised Certification', category: 'egg_processing' },
  { value: 'shell_egg_storage_conditions', label: 'Shell Egg Storage Conditions', category: 'egg_processing' },
  { value: 'ingredient_specifications', label: 'Ingredient Specifications', category: 'egg_processing' },
  { value: 'nutritional_analysis', label: 'Nutritional Analysis', category: 'egg_processing' },
  { value: 'feed_safety_documentation', label: 'Feed Safety Documentation', category: 'egg_processing' },
  { value: 'supply_chain_documentation', label: 'Supply Chain Documentation', category: 'egg_processing' },
  { value: 'antibiotic_free_certification', label: 'Antibiotic-Free Certification', category: 'egg_processing' },
  { value: 'mycotoxin_testing_reports', label: 'Mycotoxin Testing Reports', category: 'egg_processing' },
  { value: 'salmonella_testing_reports', label: 'Salmonella Testing Reports', category: 'egg_processing' },
  { value: 'packaging_specifications', label: 'Packaging Specifications', category: 'egg_processing' },
  { value: 'material_certifications', label: 'Material Certifications', category: 'egg_processing' },
  { value: 'food_contact_compliance', label: 'Food Contact Compliance', category: 'egg_processing' },
  { value: 'migration_testing_reports', label: 'Migration Testing Reports', category: 'egg_processing' },
  { value: 'recyclable_certification', label: 'Recyclable Certification', category: 'egg_processing' },
  { value: 'bpa_free_certification', label: 'BPA-Free Certification', category: 'egg_processing' },
  
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

interface ExistingRequest {
  id: string;
  title: string;
  document_type: string;
  status: string;
  created_at: string;
}

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
  const [existingRequests, setExistingRequests] = useState<ExistingRequest[]>([]);
  const [linkToExisting, setLinkToExisting] = useState<{[index: number]: string | null}>({});

  // Fetch existing requests when supplier is selected
  useEffect(() => {
    const fetchExistingRequests = async () => {
      if (!selectedSupplierId || !buyerId) {
        setExistingRequests([]);
        return;
      }

      const { data, error } = await supabase
        .from('document_requests')
        .select('id, title, document_type, status, created_at')
        .eq('supplier_id', selectedSupplierId)
        .eq('buyer_id', buyerId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setExistingRequests(data);
      }
    };

    fetchExistingRequests();
  }, [selectedSupplierId, buyerId]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: BulkUploadFile[] = acceptedFiles.map(file => ({
      file,
      documentType: '',
      documentName: file.name.replace(/\.[^/.]+$/, ''),
      category: 'compliance',
      expirationDate: undefined,
      existingRequestId: undefined
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
    
    // Reset link-to-existing when doc type changes
    setLinkToExisting(prev => ({ ...prev, [index]: null }));
  };

  const updateCustomDocumentType = (index: number, customType: string) => {
    setCustomDocumentTypes(prev => ({ ...prev, [index]: customType }));
    setFiles(prev => prev.map((file, i) => 
      i === index ? { ...file, documentType: customType } : file
    ));
  };

  const updateFileExpirationDate = (index: number, date: Date | undefined) => {
    setFiles(prev => prev.map((file, i) => 
      i === index ? { ...file, expirationDate: date?.toISOString() } : file
    ));
  };

  const updateLinkToExisting = (index: number, requestId: string | null) => {
    setLinkToExisting(prev => ({ ...prev, [index]: requestId }));
    setFiles(prev => prev.map((file, i) => 
      i === index ? { ...file, existingRequestId: requestId || undefined } : file
    ));
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setCustomDocumentTypes(prev => {
      const updated = { ...prev };
      delete updated[index];
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
    setLinkToExisting(prev => {
      const updated = { ...prev };
      delete updated[index];
      return updated;
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
      setLinkToExisting({});
      onComplete?.();
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  const selectedSupplier = connections.find(
    (conn) => (conn.supplier?.id ?? conn.supplier_id) === selectedSupplierId
  );
  const canUpload = selectedSupplierId && files.length > 0 && files.every(f => f.documentType);

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
    { value: 'egg_processing', label: 'Egg Processing' },
    { value: 'processing', label: 'Processing & Manufacturing' },
    { value: 'testing', label: 'Laboratory & Testing' },
    { value: 'audit', label: 'Audit & Compliance' },
    { value: 'other', label: 'Other' }
  ];

  const clearAll = () => {
    setFiles([]);
    setSelectedSupplierId('');
    setNotes('');
    setCustomDocumentTypes({});
    setSearchFilter('');
    setCategoryFilter('all');
    setLinkToExisting({});
  };

  // Get matching existing requests for a document type
  const getMatchingRequests = (documentType: string): ExistingRequest[] => {
    return existingRequests.filter(req => req.document_type === documentType);
  };

  return (
    <Card className="w-full border border-border/50 shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Pre-populate Supplier Documents</CardTitle>
        <CardDescription className="text-muted-foreground">
          Upload existing documents on behalf of your connected suppliers. Documents will appear as formally requested and fulfilled.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Supplier Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Select Supplier</label>
          <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
            <SelectTrigger className="h-10">
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
                      <Badge variant="secondary" className="text-xs font-normal">
                        {connection.supplier.industry}
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Selected Supplier Info */}
        {selectedSupplier && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border/40">
            <div className="flex items-center justify-center h-9 w-9 rounded-md bg-primary/10">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {selectedSupplier.supplier?.company_name ?? `Supplier ${selectedSupplier.supplier_id.slice(0, 8)}`}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {selectedSupplier.supplier?.contact_email ?? 'No email available'}
              </p>
            </div>
            {existingRequests.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {existingRequests.length} existing requests
              </Badge>
            )}
          </div>
        )}

        {/* File Upload Area - Professional Design */}
        <div
          {...getRootProps()}
          className={cn(
            "relative rounded-xl border bg-muted/20 p-6 text-center cursor-pointer transition-all duration-200",
            isDragActive 
              ? "border-primary bg-primary/5 ring-2 ring-primary/20" 
              : "border-border/60 hover:border-primary/40 hover:bg-muted/30"
          )}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-2">
            <div className={cn(
              "flex items-center justify-center h-12 w-12 rounded-lg transition-colors",
              isDragActive ? "bg-primary/10" : "bg-muted/60"
            )}>
              <Upload className={cn(
                "h-5 w-5 transition-colors",
                isDragActive ? "text-primary" : "text-muted-foreground/70"
              )} />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                {isDragActive ? "Drop files here" : "Drag & drop documents"}
              </p>
              <p className="text-xs text-muted-foreground">
                or <span className="text-primary hover:underline">browse files</span>
              </p>
            </div>
            <p className="text-xs text-muted-foreground/70 mt-1">
              PDF, DOC, DOCX, JPG, PNG
            </p>
          </div>
        </div>

        {/* File List - Enhanced with Expiry Date and Link Option */}
        {files.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-foreground">
                Documents ({files.length})
              </h3>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearAll}
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear all
              </Button>
            </div>
            
            <div className="rounded-lg border border-border/50 divide-y divide-border/50 overflow-hidden">
              {files.map((file, index) => {
                const matchingRequests = file.documentType ? getMatchingRequests(file.documentType) : [];
                
                return (
                  <div key={index} className="p-3 bg-background hover:bg-muted/30 transition-colors space-y-3">
                    {/* File Info Row */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center h-8 w-8 rounded-md bg-muted/60 flex-shrink-0">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate text-foreground">{file.file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(file.file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Document Type & Options Row */}
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Document Type Select */}
                      <Select 
                        value={file.documentType === customDocumentTypes[index] ? 'other' : file.documentType} 
                        onValueChange={(value) => updateFileDocumentType(index, value)}
                      >
                        <SelectTrigger className="w-48 h-8 text-xs">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent className="max-h-80">
                          <div className="p-2 space-y-2 border-b border-border/50">
                            <div className="flex items-center gap-2">
                              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                              <Input
                                placeholder="Search..."
                                value={searchFilter}
                                onChange={(e) => setSearchFilter(e.target.value)}
                                className="h-7 text-xs"
                              />
                            </div>
                            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {categories.map(cat => (
                                  <SelectItem key={cat.value} value={cat.value} className="text-xs">
                                    {cat.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="max-h-56 overflow-y-auto">
                            {filteredDocumentTypes.map(type => (
                              <SelectItem key={type.value} value={type.value} className="text-xs">
                                {type.label}
                              </SelectItem>
                            ))}
                          </div>
                        </SelectContent>
                      </Select>
                      
                      {/* Custom Type Input */}
                      {(file.documentType === 'other' || file.documentType === customDocumentTypes[index]) && (
                        <Input
                          placeholder="Custom type..."
                          value={customDocumentTypes[index] || ''}
                          onChange={(e) => updateCustomDocumentType(index, e.target.value)}
                          className="w-32 h-8 text-xs"
                        />
                      )}
                      
                      {/* Expiration Date Picker */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className={cn(
                              "h-8 text-xs gap-1.5",
                              !file.expirationDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="h-3.5 w-3.5" />
                            {file.expirationDate 
                              ? format(new Date(file.expirationDate), 'MMM dd, yyyy')
                              : 'Expiry Date'
                            }
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={file.expirationDate ? new Date(file.expirationDate) : undefined}
                            onSelect={(date) => updateFileExpirationDate(index, date)}
                            initialFocus
                            className="p-3 pointer-events-auto"
                            disabled={(date) => date < new Date()}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Link to Existing Request Option */}
                    {file.documentType && matchingRequests.length > 0 && (
                      <div className="flex items-start gap-2 p-2 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                        <Link2 className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                          <p className="text-xs text-blue-700 dark:text-blue-300">
                            Found {matchingRequests.length} existing request(s) for this document type
                          </p>
                          <Select 
                            value={linkToExisting[index] || 'new'} 
                            onValueChange={(value) => updateLinkToExisting(index, value === 'new' ? null : value)}
                          >
                            <SelectTrigger className="h-7 text-xs bg-white dark:bg-background">
                              <SelectValue placeholder="Create new request" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="new" className="text-xs">
                                Create new request
                              </SelectItem>
                              {matchingRequests.map(req => (
                                <SelectItem key={req.id} value={req.id} className="text-xs">
                                  Link to "{req.title}" ({req.status}) - {format(new Date(req.created_at), 'MMM yyyy')}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {linkToExisting[index] && (
                            <p className="text-xs text-blue-600 dark:text-blue-400">
                              ✓ Will add as new version to existing request
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Expiry Date Reminder */}
            {files.some(f => !f.expirationDate && f.documentType) && (
              <div className="flex items-center gap-2 p-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <CalendarIcon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Tip: Add expiration dates to receive automatic renewal notifications
                </p>
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Notes</label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any notes about these documents..."
            rows={2}
            className="resize-none text-sm"
          />
        </div>

        {/* Progress */}
        {progress && (
          <div className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border/40">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Uploading</span>
              <span className="text-xs text-muted-foreground">
                {progress.processedFiles} / {progress.totalFiles}
              </span>
            </div>
            <Progress 
              value={(progress.processedFiles / progress.totalFiles) * 100} 
              className="h-1.5"
            />
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1 text-emerald-600">
                <CheckCircle className="h-3.5 w-3.5" />
                {progress.successfulUploads} successful
              </div>
              {progress.failedUploads > 0 && (
                <div className="flex items-center gap-1 text-destructive">
                  <XCircle className="h-3.5 w-3.5" />
                  {progress.failedUploads} failed
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={clearAll}
            disabled={isUploading}
            className="h-9"
          >
            Clear
          </Button>
          <Button
            size="sm"
            onClick={handleUpload}
            disabled={!canUpload || isUploading}
            className="h-9 min-w-28"
          >
            {isUploading ? 'Uploading...' : files.length > 0 ? `Upload ${files.length} Files` : 'Upload'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
