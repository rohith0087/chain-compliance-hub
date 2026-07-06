import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClipboardCheck, X, Filter, Search, Package, Save } from 'lucide-react';
import { ComplianceDocument } from './ComplianceDocuments';
import { useDocumentSets } from '@/hooks/useDocumentSets';
import { SaveDocumentSetDialog } from '@/components/buyer/SaveDocumentSetDialog';

interface DocumentSelectionStepProps {
  complianceDocuments: ComplianceDocument[];
  selectedDocuments: ComplianceDocument[];
  onDocumentToggle: (doc: ComplianceDocument, checked: boolean) => void;
  onRemoveSelected: (docId: string) => void;
  onNext: () => void;
  buyerId?: string;
}

const DocumentSelectionStep = ({
  complianceDocuments,
  selectedDocuments,
  onDocumentToggle,
  onRemoveSelected,
  onNext,
  buyerId
}: DocumentSelectionStepProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedRegulatoryBody, setSelectedRegulatoryBody] = useState('all');
  const [showRequiredOnly, setShowRequiredOnly] = useState(false);
  const [selectedSetId, setSelectedSetId] = useState<string>('none');
  const [showSaveSetDialog, setShowSaveSetDialog] = useState(false);
  const [showAIBanner, setShowAIBanner] = useState(true);

  const { documentSets, incrementUsage } = useDocumentSets(buyerId);

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
    setSelectedSetId('none');
  };

  // Handle document set selection
  const handleSetSelection = (setId: string) => {
    setSelectedSetId(setId);
    if (setId === 'none') return;

    const selectedSet = documentSets.find(s => s.id === setId);
    if (!selectedSet) return;

    // Auto-select documents from the set
    selectedSet.document_ids.forEach(docId => {
      const doc = complianceDocuments.find(d => d.id === docId);
      if (doc && !selectedDocuments.find(sd => sd.id === docId)) {
        onDocumentToggle(doc, true);
      }
    });

    // Increment usage count
    incrementUsage(setId);
  };

  return (
    <div className="flex flex-col h-full space-y-5">
      {/* AI Recommendation Banner */}
      {showAIBanner && (
        <div className="ai-card p-3 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-primary font-bold flex items-center gap-2 shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              AI Recommendation
              <Badge className="bg-primary/15 text-primary hover:bg-primary/15 border-0 text-[10px] px-1.5 py-0">BETA</Badge>
            </span>
            <p className="text-foreground/80 text-[13px] hidden sm:block">
              General Suppliers commonly require ISO 9001, ISO 14001, Supplier Questionnaire, and Code of Conduct. <span className="font-medium text-foreground">4 suggested documents.</span>
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button className="bg-primary hover:bg-primary-hover text-white rounded-[10px] h-8 px-3 text-[12px] font-semibold shadow-sm transition-colors">
              <svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Apply Suggestions
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => setShowAIBanner(false)}
              className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-[10px] h-8 px-3 text-[12px] font-semibold transition-colors"
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-card border border-border rounded-[16px] p-2 flex flex-wrap items-center gap-2 shadow-sm shrink-0">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground/70 w-4 h-4" />
          <Input
            placeholder="Search documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 border-0 shadow-none focus-visible:ring-0 text-[14px]"
          />
        </div>
        <div className="w-[1px] h-5 bg-muted hidden sm:block"></div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="h-9 border-0 shadow-none focus:ring-0 text-[14px] w-auto">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(category => (
              <SelectItem key={category} value={category}>{category}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="w-[1px] h-5 bg-muted hidden sm:block"></div>
        <Select value={selectedRegulatoryBody} onValueChange={setSelectedRegulatoryBody}>
          <SelectTrigger className="h-9 border-0 shadow-none focus:ring-0 text-[14px] w-auto">
            <SelectValue placeholder="All Regulatory Frameworks" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Regulatory Frameworks</SelectItem>
            {regulatoryBodies.map(body => (
              <SelectItem key={body} value={body}>{body}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {buyerId && documentSets && documentSets.length > 0 && (
          <>
            <div className="w-[1px] h-5 bg-muted hidden sm:block"></div>
            <Select value={selectedSetId} onValueChange={handleSetSelection}>
              <SelectTrigger className="h-9 border-0 shadow-none focus:ring-0 text-[14px] w-auto">
                <SelectValue placeholder="All Document Sets" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Set Selected</SelectItem>
                {documentSets.map(set => (
                  <SelectItem key={set.id} value={set.id}>
                    {set.set_name} ({set.document_ids.length})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
        <div className="w-[1px] h-5 bg-muted hidden sm:block"></div>
        <div className="flex items-center gap-2 px-3">
          <Checkbox 
            id="required-only"
            checked={showRequiredOnly}
            onCheckedChange={(checked) => setShowRequiredOnly(checked === true)}
            className="rounded-[4px] border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
          />
          <label htmlFor="required-only" className="text-[13px] font-medium text-foreground/80 cursor-pointer">
            Required only
          </label>
        </div>
        <div className="ml-auto pr-3 pl-2 flex items-center gap-2 border-l border-border">
          <Badge className="bg-primary/10 text-primary hover:bg-primary/10 border-0 text-[13px] font-semibold px-2 py-0.5 rounded-[8px]">
            {selectedDocuments.length} selected
          </Badge>
        </div>
      </div>

      <div className="text-[13px] text-muted-foreground">
        Showing {filteredDocuments.length} of {complianceDocuments.length} documents
      </div>

      {/* Document List */}
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        <div className="bg-card border border-border rounded-[16px] divide-y divide-[#E4E7EC] overflow-hidden shadow-sm">
          {filteredDocuments.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <Filter className="w-10 h-10 mx-auto mb-3 text-muted-foreground/70" />
              <h3 className="text-[16px] font-bold mb-1 text-foreground">No documents found</h3>
              <p className="text-[14px]">Try adjusting your search criteria or filters</p>
            </div>
          ) : (
            filteredDocuments.map((doc) => {
              const isSelected = !!selectedDocuments.find(d => d.id === doc.id);
              const isSuggested = ['ISO 9001 Certificate', 'ISO 14001 Environmental Certificate', 'Completed Supplier Questionnaire', 'Supplier Code of Conduct'].includes(doc.title);
              
              return (
                <div 
                  key={doc.id} 
                  className={`flex items-center justify-between p-4 transition-colors hover:bg-muted cursor-pointer ${isSelected ? 'bg-muted' : ''}`}
                  onClick={() => onDocumentToggle(doc, !isSelected)}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => onDocumentToggle(doc, checked === true)}
                        className="w-5 h-5 rounded-[6px] border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      />
                    </div>
                    <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 ${isSelected ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                      <doc.icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1 pr-4">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-[15px] font-bold text-foreground">{doc.title}</span>
                        <Badge className="bg-primary/10 text-primary hover:bg-primary/10 border-0 text-[11px] font-semibold px-2 py-0 rounded-[6px]">{doc.category}</Badge>
                        <Badge variant="outline" className="text-muted-foreground border-border text-[11px] font-semibold px-2 py-0 rounded-[6px]">{doc.regulatoryBody}</Badge>
                        {doc.required && (
                          <Badge className="bg-danger/15 text-danger hover:bg-danger/15 border-0 text-[11px] font-semibold px-2 py-0 rounded-[6px]">Required</Badge>
                        )}
                        {!doc.required && (
                          <Badge className="bg-muted text-muted-foreground hover:bg-muted border-0 text-[11px] font-semibold px-2 py-0 rounded-[6px]">Optional</Badge>
                        )}
                      </div>
                      <p className="text-[13px] text-muted-foreground truncate">{doc.description}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6 shrink-0">
                    {isSuggested && (
                      <span className="text-primary text-[12px] font-semibold flex items-center gap-1.5 bg-primary/10 px-2.5 py-1 rounded-full border border-primary/25">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                        </svg>
                        AI Suggested
                      </span>
                    )}
                    <button 
                      onClick={(e) => { e.stopPropagation(); /* Preview action */ }}
                      className="text-primary text-[13px] font-semibold hover:underline flex items-center gap-1.5"
                    >
                      Preview Template
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {buyerId && (
        <SaveDocumentSetDialog
          open={showSaveSetDialog}
          onOpenChange={setShowSaveSetDialog}
          buyerId={buyerId}
          selectedDocumentIds={selectedDocuments.map(d => d.id)}
          documentCount={selectedDocuments.length}
        />
      )}
    </div>
  );
};

export default DocumentSelectionStep;
