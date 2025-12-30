import { useState, useMemo } from 'react';
import { Package, Edit2, Trash2, Copy, FileText, X, Plus, Search, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDocumentSets, DocumentSet } from '@/hooks/useDocumentSets';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { getComplianceDocuments, ComplianceDocument } from '@/components/requests/ComplianceDocuments';

interface DocumentSetManagerProps {
  buyerId: string;
}

interface FormData {
  set_name: string;
  description: string;
  document_ids: string[];
  is_default: boolean;
}

interface FormErrors {
  set_name?: string;
  description?: string;
  documents?: string;
}

// Category groups for better organization
const categoryGroups: Record<string, string[]> = {
  'Poultry / Egg Processing': [
    'Egg Processing Documentation',
    'Egg Processing Food Safety',
    'Egg Processing Certification',
    'Egg Processing Compliance',
    'Egg Processing Quality',
    'Egg Processing Testing',
    'Egg Processing Traceability',
    'Egg Processing Logistics',
    'Egg Processing Packaging',
    'Egg Processing Insurance',
    'Egg Processing Ethics',
    'Egg Processing Security',
    'Egg Processing Risk',
    'Egg Processing Health',
    'Egg Processing Ingredients',
    'Egg Processing Religious',
    'Egg Processing Safety',
    'Egg Processing Legal',
    'Egg Supplier Documentation',
    'Egg Supplier Food Safety',
    'Egg Supplier Quality',
    'Egg Supplier Certification',
    'Egg Supplier Compliance',
    'Egg Supplier Traceability',
    'Egg Supplier Insurance',
    'Egg Supplier Testing',
    'Egg Supplier Ethics'
  ],
  'Food Safety': [
    'Food Safety',
    'Seafood Safety',
    'Allergen Management'
  ],
  'Financial Compliance': [
    'Financial Compliance'
  ],
  'Regulatory Compliance': [
    'Regulatory Compliance'
  ],
  'Quality Management': [
    'Quality Management',
    'Quality Control'
  ],
  'Legal & Corporate': [
    'Legal & Corporate',
    'Legal Compliance'
  ],
  'Insurance': [
    'Insurance'
  ],
  'Traceability': [
    'Traceability'
  ],
  'Packaging & Logistics': [
    'Packaging Supplier',
    'Logistics'
  ],
  'Other': [] // Will catch uncategorized docs
};

export function DocumentSetManager({ buyerId }: DocumentSetManagerProps) {
  const { documentSets, deleteSet, updateSet, duplicateSet, isDeleting, isUpdating } = useDocumentSets(buyerId);
  const [editingSet, setEditingSet] = useState<DocumentSet | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [formData, setFormData] = useState<FormData>({ 
    set_name: '', 
    description: '',
    document_ids: [],
    is_default: false
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Get all available documents from all known types
  const allDocuments = useMemo(() => {
    const docTypes = [
      'Auditor', 
      'Egg Processing', 
      'Sushi Company',
      'Poultry - Egg Supplier',
      'Poultry - Ingredient Supplier',
      'Poultry - Packaging Supplier',
      'Poultry - Gas/Lube Supplier',
      'Chicken Processor Co'
    ];
    const allDocs: ComplianceDocument[] = [];
    const seenIds = new Set<string>();
    
    docTypes.forEach(type => {
      getComplianceDocuments(type).forEach(doc => {
        if (!seenIds.has(doc.id)) {
          seenIds.add(doc.id);
          allDocs.push(doc);
        }
      });
    });
    
    return allDocs;
  }, []);

  // Get parent category for a document category
  const getParentCategory = (category: string): string => {
    for (const [parent, children] of Object.entries(categoryGroups)) {
      if (children.includes(category)) {
        return parent;
      }
    }
    return 'Other';
  };

  // Get grouped categories with document counts
  const groupedCategories = useMemo(() => {
    const groups: Record<string, { count: number; categories: Set<string> }> = {};
    
    // Initialize groups
    Object.keys(categoryGroups).forEach(group => {
      groups[group] = { count: 0, categories: new Set() };
    });
    
    // Count documents per group
    allDocuments.forEach(doc => {
      const parent = getParentCategory(doc.category);
      if (!groups[parent]) {
        groups[parent] = { count: 0, categories: new Set() };
      }
      groups[parent].count++;
      groups[parent].categories.add(doc.category);
    });
    
    // Filter out empty groups
    return Object.entries(groups)
      .filter(([_, data]) => data.count > 0)
      .sort((a, b) => b[1].count - a[1].count);
  }, [allDocuments]);

  // Get selected documents - include fallback for unknown IDs
  const selectedDocs = useMemo(() => {
    return formData.document_ids.map(id => {
      const knownDoc = allDocuments.find(d => d.id === id);
      if (knownDoc) return knownDoc;
      // Return a placeholder for unknown documents
      return {
        id,
        title: id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        category: 'Custom',
        description: 'Custom document',
        icon: FileText,
        required: false,
        regulatoryBody: 'Custom',
        template: { sections: [] }
      } as ComplianceDocument;
    });
  }, [allDocuments, formData.document_ids]);

  const availableDocs = useMemo(() => {
    return allDocuments.filter(d => {
      // Not already selected
      if (formData.document_ids.includes(d.id)) return false;
      
      // Match search term
      if (searchTerm && !d.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      
      // Match category filter
      if (categoryFilter !== 'all') {
        const parentCategory = getParentCategory(d.category);
        if (parentCategory !== categoryFilter) return false;
      }
      
      return true;
    });
  }, [allDocuments, formData.document_ids, searchTerm, categoryFilter]);

  // Validation function
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    
    // Set name validation
    const trimmedName = formData.set_name.trim();
    if (!trimmedName) {
      newErrors.set_name = 'Set name is required';
    } else if (trimmedName.length < 2) {
      newErrors.set_name = 'Set name must be at least 2 characters';
    } else if (trimmedName.length > 100) {
      newErrors.set_name = 'Set name must be less than 100 characters';
    }
    
    // Description validation
    if (formData.description.length > 500) {
      newErrors.description = 'Description must be less than 500 characters';
    }
    
    // Document validation
    if (formData.document_ids.length === 0) {
      newErrors.documents = 'At least one document is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Check if form is valid for button state
  const isFormValid = useMemo(() => {
    const trimmedName = formData.set_name.trim();
    return (
      trimmedName.length >= 2 &&
      trimmedName.length <= 100 &&
      formData.description.length <= 500 &&
      formData.document_ids.length > 0
    );
  }, [formData]);

  const handleEdit = (set: DocumentSet) => {
    setEditingSet(set);
    setFormData({ 
      set_name: set.set_name, 
      description: set.description || '',
      document_ids: set.document_ids || [],
      is_default: set.is_default || false
    });
    setErrors({});
    setSearchTerm('');
    setCategoryFilter('all');
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingSet || !validateForm()) return;
    updateSet({
      id: editingSet.id,
      updates: {
        set_name: formData.set_name.trim(),
        description: formData.description.trim() || undefined,
        document_ids: formData.document_ids,
        is_default: formData.is_default
      },
    });
    setIsEditDialogOpen(false);
    setEditingSet(null);
  };

  const addDocument = (docId: string) => {
    setFormData(prev => ({
      ...prev,
      document_ids: [...prev.document_ids, docId]
    }));
    // Clear document error when adding
    if (errors.documents) {
      setErrors(prev => ({ ...prev, documents: undefined }));
    }
  };

  const removeDocument = (docId: string) => {
    setFormData(prev => ({
      ...prev,
      document_ids: prev.document_ids.filter(id => id !== docId)
    }));
  };

  const handleSetNameChange = (value: string) => {
    setFormData(prev => ({ ...prev, set_name: value }));
    // Clear error when user starts typing
    if (errors.set_name) {
      setErrors(prev => ({ ...prev, set_name: undefined }));
    }
  };

  const handleDescriptionChange = (value: string) => {
    setFormData(prev => ({ ...prev, description: value }));
    // Clear error when user is within limit
    if (value.length <= 500 && errors.description) {
      setErrors(prev => ({ ...prev, description: undefined }));
    }
  };

  const getDocumentNames = (documentIds: string[]) => {
    return documentIds
      .map(id => allDocuments.find(doc => doc.id === id)?.title)
      .filter(Boolean)
      .slice(0, 3);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Document Sets</h2>
          <p className="text-muted-foreground">
            Manage your reusable document collections
          </p>
        </div>
      </div>

      {documentSets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No document sets yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create document sets from the "New Request" page by selecting documents and clicking "Save as Set"
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {documentSets.map((set) => (
            <Card key={set.id} className="group hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{set.set_name}</CardTitle>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-background border-border">
                      <DropdownMenuItem onClick={() => handleEdit(set)}>
                        <Edit2 className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => duplicateSet(set.id)}>
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => deleteSet(set.id)}
                        disabled={isDeleting}
                        className="text-danger"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <CardDescription className="line-clamp-2">
                  {set.description || 'No description'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span>{set.document_ids.length} documents</span>
                  {set.is_default && (
                    <Badge variant="outline" className="ml-auto">Default</Badge>
                  )}
                </div>

                <div className="space-y-1">
                  {getDocumentNames(set.document_ids).map((name, idx) => (
                    <div key={idx} className="text-sm text-muted-foreground flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      {name}
                    </div>
                  ))}
                  {set.document_ids.length > 3 && (
                    <div className="text-sm text-muted-foreground pl-3.5">
                      + {set.document_ids.length - 3} more...
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t text-xs text-muted-foreground">
                  Used {set.usage_count} {set.usage_count === 1 ? 'time' : 'times'}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Edit Document Set
            </DialogTitle>
            <DialogDescription>
              Modify the name, description, and documents in your set
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto space-y-6 py-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="set_name">Set Name*</Label>
                <Input
                  id="set_name"
                  value={formData.set_name}
                  onChange={(e) => handleSetNameChange(e.target.value)}
                  placeholder="e.g., Food Safety Package"
                  className={errors.set_name ? 'border-destructive focus-visible:ring-destructive' : ''}
                  maxLength={100}
                />
                <div className="flex justify-between items-center">
                  {errors.set_name ? (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.set_name}
                    </p>
                  ) : (
                    <span />
                  )}
                  <span className="text-xs text-muted-foreground">
                    {formData.set_name.length}/100
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleDescriptionChange(e.target.value)}
                  placeholder="Describe what this set is used for..."
                  rows={2}
                  className={errors.description ? 'border-destructive focus-visible:ring-destructive' : ''}
                  maxLength={500}
                />
                <div className="flex justify-between items-center">
                  {errors.description ? (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.description}
                    </p>
                  ) : (
                    <span />
                  )}
                  <span className={`text-xs ${formData.description.length > 450 ? 'text-warning' : 'text-muted-foreground'}`}>
                    {formData.description.length}/500
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_default"
                  checked={formData.is_default}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, is_default: checked as boolean })
                  }
                />
                <Label htmlFor="is_default" className="text-sm font-normal cursor-pointer">
                  Set as default (auto-select when creating new requests)
                </Label>
              </div>
            </div>

            {/* Selected Documents */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">
                  Documents in Set ({formData.document_ids.length})
                </Label>
              </div>
              
              {selectedDocs.length === 0 ? (
                <div className={`text-sm bg-muted/50 rounded-lg p-4 text-center ${errors.documents ? 'border border-destructive' : ''}`}>
                  <div className="text-muted-foreground">No documents selected. Add documents from the list below.</div>
                  {errors.documents && (
                    <p className="text-sm text-destructive flex items-center justify-center gap-1 mt-2">
                      <AlertCircle className="h-3 w-3" />
                      {errors.documents}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {selectedDocs.map((doc) => (
                    <Badge
                      key={doc.id}
                      variant="secondary"
                      className="pl-3 pr-1 py-1.5 flex items-center gap-1 text-sm"
                    >
                      <span className="max-w-[200px] truncate">{doc.title}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 hover:bg-destructive/20 rounded-full"
                        onClick={() => removeDocument(doc.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Available Documents */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">
                Add Documents
              </Label>
              
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search documents..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {groupedCategories.map(([group, data]) => (
                      <SelectItem key={group} value={group}>
                        {group} ({data.count})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <ScrollArea className="h-[200px] border rounded-lg">
                <div className="p-2 space-y-1">
                  {availableDocs.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-8">
                      {searchTerm || categoryFilter !== 'all' 
                        ? 'No documents match your search'
                        : 'All documents are already in this set'}
                    </div>
                  ) : (
                    availableDocs.map((doc) => (
                      <button
                        key={doc.id}
                        onClick={() => addDocument(doc.id)}
                        className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-muted/70 text-left transition-colors group"
                      >
                        <Plus className="h-4 w-4 text-muted-foreground group-hover:text-primary flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{doc.title}</div>
                          <div className="text-xs text-muted-foreground">{getParentCategory(doc.category)}</div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>

          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveEdit} 
              disabled={!isFormValid || isUpdating}
            >
              {isUpdating ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
