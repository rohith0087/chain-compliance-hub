
import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClipboardCheck, ArrowLeft, X, Filter, Search } from 'lucide-react';
import { ComplianceDocument } from './ComplianceDocuments';

interface DocumentSelectionStepProps {
  complianceDocuments: ComplianceDocument[];
  selectedDocuments: ComplianceDocument[];
  onDocumentToggle: (doc: ComplianceDocument, checked: boolean) => void;
  onRemoveSelected: (docId: string) => void;
  onNext: () => void;
}

const DocumentSelectionStep = ({
  complianceDocuments,
  selectedDocuments,
  onDocumentToggle,
  onRemoveSelected,
  onNext
}: DocumentSelectionStepProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedRegulatoryBody, setSelectedRegulatoryBody] = useState('all');
  const [showRequiredOnly, setShowRequiredOnly] = useState(false);

  // Get unique categories and regulatory bodies
  const categories = useMemo(() => {
    const uniqueCategories = [...new Set(complianceDocuments.map(doc => doc.category))];
    return uniqueCategories.sort();
  }, [complianceDocuments]);

  const regulatoryBodies = useMemo(() => {
    const uniqueBodies = [...new Set(complianceDocuments.map(doc => doc.regulatoryBody))];
    return uniqueBodies.sort();
  }, [complianceDocuments]);

  // Filter documents based on search and filters
  const filteredDocuments = useMemo(() => {
    return complianceDocuments.filter(doc => {
      const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           doc.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || doc.category === selectedCategory;
      const matchesRegulatoryBody = selectedRegulatoryBody === 'all' || doc.regulatoryBody === selectedRegulatoryBody;
      const matchesRequired = !showRequiredOnly || doc.required;

      return matchesSearch && matchesCategory && matchesRegulatoryBody && matchesRequired;
    });
  }, [complianceDocuments, searchTerm, selectedCategory, selectedRegulatoryBody, showRequiredOnly]);

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('all');
    setSelectedRegulatoryBody('all');
    setShowRequiredOnly(false);
  };

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-600" />
            Filter Documents
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search documents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>{category}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedRegulatoryBody} onValueChange={setSelectedRegulatoryBody}>
              <SelectTrigger>
                <SelectValue placeholder="All Regulatory Bodies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regulatory Bodies</SelectItem>
                {regulatoryBodies.map(body => (
                  <SelectItem key={body} value={body}>{body}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center space-x-2">
              <Checkbox 
                id="required-only"
                checked={showRequiredOnly}
                onCheckedChange={setShowRequiredOnly}
              />
              <label htmlFor="required-only" className="text-sm font-medium">
                Required Only
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing {filteredDocuments.length} of {complianceDocuments.length} documents
            </div>
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Selected Documents Summary */}
      {selectedDocuments.length > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-blue-600" />
              Selected Documents ({selectedDocuments.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {selectedDocuments.map((doc) => (
                <Badge 
                  key={doc.id} 
                  variant="secondary" 
                  className="flex items-center gap-1 px-3 py-1"
                >
                  {doc.title}
                  <X 
                    className="w-3 h-3 cursor-pointer hover:text-red-600" 
                    onClick={() => onRemoveSelected(doc.id)}
                  />
                </Badge>
              ))}
            </div>
            <div className="mt-3 flex justify-end">
              <Button 
                onClick={onNext}
                disabled={selectedDocuments.length === 0}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Configure Requests
                <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Document Selection Grid */}
      <div className="grid gap-4">
        {filteredDocuments.length === 0 ? (
          <Card className="p-8 text-center">
            <div className="text-gray-500">
              <Filter className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium mb-2">No documents found</h3>
              <p className="text-sm">Try adjusting your search criteria or filters</p>
            </div>
          </Card>
        ) : (
          filteredDocuments.map((doc) => (
            <Card 
              key={doc.id} 
              className={`cursor-pointer transition-all border-l-4 ${
                selectedDocuments.find(d => d.id === doc.id) 
                  ? 'border-l-blue-500 bg-blue-50 shadow-md' 
                  : 'border-l-gray-300 hover:shadow-md hover:border-l-blue-400'
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={!!selectedDocuments.find(d => d.id === doc.id)}
                      onCheckedChange={(checked) => onDocumentToggle(doc, checked as boolean)}
                    />
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <doc.icon className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{doc.title}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary">{doc.category}</Badge>
                        <Badge variant="outline">{doc.regulatoryBody}</Badge>
                        {doc.required && (
                          <Badge variant="destructive" className="text-xs">Required</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-3">{doc.description}</p>
                <div className="text-sm text-gray-500">
                  <strong>Template includes:</strong> {doc.template.sections.map(s => s.name).join(', ')}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default DocumentSelectionStep;
