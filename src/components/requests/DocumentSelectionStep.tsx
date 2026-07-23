import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter, Search, Loader2, Sparkles, Check, ExternalLink } from 'lucide-react';
import { ComplianceDocument } from './ComplianceDocuments';
import { useDocumentSets } from '@/hooks/useDocumentSets';
import { SaveDocumentSetDialog } from '@/components/buyer/SaveDocumentSetDialog';
import { recommendDocuments, type DocRecommendation } from '@/lib/requestAiAssist';
import {
  cardClass,
  cardPadClass,
  sectionLabelClass,
  pillClass,
  pillAccentClass,
  emptyStateClass,
  hoverSurfaceClass,
  inlineIconClass,
} from '@/design/system';

interface DocumentSelectionStepProps {
  complianceDocuments: ComplianceDocument[];
  selectedDocuments: ComplianceDocument[];
  onDocumentToggle: (doc: ComplianceDocument, checked: boolean) => void;
  onRemoveSelected: (docId: string) => void;
  onNext: () => void;
  buyerId?: string;
  entityType?: string;
}

const DocumentSelectionStep = ({
  complianceDocuments,
  selectedDocuments,
  onDocumentToggle,
  onRemoveSelected,
  onNext,
  buyerId,
  entityType = 'General Supplier'
}: DocumentSelectionStepProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedRegulatoryBody, setSelectedRegulatoryBody] = useState('all');
  const [showRequiredOnly, setShowRequiredOnly] = useState(false);
  const [selectedSetId, setSelectedSetId] = useState<string>('none');
  const [showSaveSetDialog, setShowSaveSetDialog] = useState(false);
  const [showAIBanner, setShowAIBanner] = useState(true);

  const { documentSets, incrementUsage } = useDocumentSets(buyerId);

  // ── AI document recommendations (fail soft — falls back to `required` docs) ──
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState<string>('');
  const [aiRecs, setAiRecs] = useState<DocRecommendation[]>([]);

  const fallbackRecs = useMemo(
    () => complianceDocuments.filter((d) => d.required).slice(0, 6),
    [complianceDocuments],
  );

  useEffect(() => {
    if (!buyerId || complianceDocuments.length === 0) return;
    let cancelled = false;
    setAiLoading(true);
    setAiSummary('');
    setAiRecs([]);
    recommendDocuments(
      buyerId,
      entityType,
      complianceDocuments.map((d) => ({ id: d.id, title: d.title, category: d.category })),
    ).then((result) => {
      if (cancelled) return;
      if (result && result.recommendations.length > 0) {
        setAiRecs(result.recommendations);
        setAiSummary(result.summary);
      }
      setAiLoading(false);
    });
    return () => { cancelled = true; };
  }, [buyerId, entityType, complianceDocuments]);

  const recommendedDocs: ComplianceDocument[] = useMemo(() => {
    if (aiRecs.length > 0) {
      return aiRecs
        .map((r) => complianceDocuments.find((d) => d.id === r.id))
        .filter((d): d is ComplianceDocument => Boolean(d));
    }
    return fallbackRecs;
  }, [aiRecs, complianceDocuments, fallbackRecs]);

  const suggestedIds = useMemo(() => new Set(recommendedDocs.map((d) => d.id)), [recommendedDocs]);

  const applyRecommendations = () => {
    recommendedDocs.forEach((doc) => {
      if (!selectedDocuments.find((sd) => sd.id === doc.id)) {
        onDocumentToggle(doc, true);
      }
    });
    setShowAIBanner(false);
  };

  // ── Filters ──────────────────────────────────────────────────────────────────
  const categories = useMemo(() => {
    const uniqueCategories = [...new Set(complianceDocuments.map(doc => doc.category))];
    return uniqueCategories.sort();
  }, [complianceDocuments]);

  const regulatoryBodies = useMemo(() => {
    const uniqueBodies = [...new Set(complianceDocuments.map(doc => doc.regulatoryBody))];
    return uniqueBodies.sort();
  }, [complianceDocuments]);

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

  // Handle document set selection
  const handleSetSelection = (setId: string) => {
    setSelectedSetId(setId);
    if (setId === 'none') return;

    const selectedSet = documentSets.find(s => s.id === setId);
    if (!selectedSet) return;

    selectedSet.document_ids.forEach(docId => {
      const doc = complianceDocuments.find(d => d.id === docId);
      if (doc && !selectedDocuments.find(sd => sd.id === docId)) {
        onDocumentToggle(doc, true);
      }
    });

    incrementUsage(setId);
  };

  return (
    // Full-height column on lg+ (the section pins the surrounding chrome):
    // the strip / toolbar / count stay put and only the document list scrolls.
    <div className="flex h-full min-h-0 flex-col gap-4">
      {/* AI recommendation strip */}
      {showAIBanner && (
        <div className={`${cardClass} ${cardPadClass} flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}>
          <div className="flex items-start gap-3 min-w-0">
            <Sparkles className={`${inlineIconClass} text-primary mt-0.5 shrink-0`} />
            <div className="min-w-0">
              <p className={sectionLabelClass}>AI recommendation</p>
              <p className="mt-1 text-small text-muted-foreground">
                {aiLoading ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analyzing {entityType} requirements…
                  </span>
                ) : (
                  <>
                    {aiSummary || `Suggested documents for ${entityType}.`}{' '}
                    <span className="font-medium text-foreground">
                      {recommendedDocs.length} suggested.
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              onClick={applyRecommendations}
              disabled={aiLoading || recommendedDocs.length === 0}
              className="bg-primary text-primary-foreground hover:bg-primary-hover"
            >
              <Check className="h-4 w-4 mr-1.5" /> Apply suggestions
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowAIBanner(false)}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Filter toolbar */}
      <div className={`${cardClass} flex shrink-0 flex-wrap items-center gap-2 p-2`}>
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search documents…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-9 border-0 pl-9 text-body shadow-none focus-visible:ring-0"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="h-9 w-auto gap-1 border-border text-small"><SelectValue placeholder="All categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map(category => (<SelectItem key={category} value={category}>{category}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={selectedRegulatoryBody} onValueChange={setSelectedRegulatoryBody}>
          <SelectTrigger className="h-9 w-auto gap-1 border-border text-small"><SelectValue placeholder="All frameworks" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All frameworks</SelectItem>
            {regulatoryBodies.map(body => (<SelectItem key={body} value={body}>{body}</SelectItem>))}
          </SelectContent>
        </Select>
        {buyerId && documentSets && documentSets.length > 0 && (
          <Select value={selectedSetId} onValueChange={handleSetSelection}>
            <SelectTrigger className="h-9 w-auto gap-1 border-border text-small"><SelectValue placeholder="Document sets" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No set selected</SelectItem>
              {documentSets.map(set => (
                <SelectItem key={set.id} value={set.id}>{set.set_name} ({set.document_ids.length})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="flex items-center gap-2 px-2">
          <Checkbox
            id="required-only"
            checked={showRequiredOnly}
            onCheckedChange={(checked) => setShowRequiredOnly(checked === true)}
            className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
          />
          <label htmlFor="required-only" className="cursor-pointer text-small font-medium text-muted-foreground">Required only</label>
        </div>
        <div className="ml-auto pl-2 pr-1">
          <span className={pillAccentClass}>{selectedDocuments.length} selected</span>
        </div>
      </div>

      <p className="shrink-0 text-caption text-muted-foreground">
        Showing {filteredDocuments.length} of {complianceDocuments.length} documents
      </p>

      {/* Document list — the one internally-scrolling region of step 1 */}
      <div className={`${cardClass} divide-y divide-border overflow-hidden lg:min-h-0 lg:flex-1 lg:overflow-y-auto`}>
        {filteredDocuments.length === 0 ? (
          <div className={emptyStateClass}>
            <Filter className="h-8 w-8 text-muted-foreground/70" />
            <p className="text-body font-medium text-foreground">No documents found</p>
            <p className="text-small">Try adjusting your search or filters.</p>
          </div>
        ) : (
          filteredDocuments.map((doc) => {
            const isSelected = !!selectedDocuments.find(d => d.id === doc.id);
            const isSuggested = suggestedIds.has(doc.id);
            return (
              <div
                key={doc.id}
                className={`flex items-center justify-between gap-4 px-4 py-3.5 cursor-pointer ${hoverSurfaceClass} ${isSelected ? 'bg-muted/60' : ''}`}
                onClick={() => onDocumentToggle(doc, !isSelected)}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3.5">
                  <div onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => onDocumentToggle(doc, checked === true)}
                      className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                  </div>
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-control ${isSelected ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    <doc.icon className="h-[18px] w-[18px]" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-body font-semibold text-foreground">{doc.title}</span>
                      <span className={pillClass}>{doc.category}</span>
                      <span className={pillClass}>{doc.regulatoryBody}</span>
                      {doc.required ? (
                        <span className="inline-flex items-center rounded-pill border border-danger/30 bg-danger/10 px-2.5 py-0.5 text-caption font-medium text-danger">Required</span>
                      ) : (
                        <span className={pillClass}>Optional</span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-small text-muted-foreground">{doc.description}</p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  {isSuggested && (
                    <span className={pillAccentClass}>
                      <Sparkles className="h-3 w-3" /> AI
                    </span>
                  )}
                  <Button
                    variant="link"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); /* Preview action */ }}
                    className="h-auto gap-1.5 p-0 text-small text-primary"
                  >
                    Preview template <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
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
