import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertTriangle,
  CheckCircle,
  FileText,
  Loader2,
  Play,
  RefreshCw,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface BuyerPendingInfo {
  id: string;
  company_name: string;
  pending_count: number;
  is_demo: boolean;
  selected: boolean;
}

interface BackfillResult {
  id: string;
  success: boolean;
  summary_preview?: string;
  error?: string;
}

const DEMO_PATTERNS = ['test', 'demo', 'sample', 'example', 'dummy'];

export function DocumentBackfillManager() {
  const [buyers, setBuyers] = useState<BuyerPendingInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentDoc, setCurrentDoc] = useState<string | null>(null);
  const [results, setResults] = useState<BackfillResult[]>([]);
  const [totalProcessed, setTotalProcessed] = useState(0);
  const [totalFailed, setTotalFailed] = useState(0);

  useEffect(() => {
    fetchPendingDocuments();
  }, []);

  const fetchPendingDocuments = async () => {
    setLoading(true);
    try {
      // Get all buyers with their pending document counts
      const { data: buyersData, error: buyersError } = await supabase
        .from('buyers')
        .select('id, company_name');

      if (buyersError) throw buyersError;

      // Get pending documents count per buyer
      const { data: pendingDocs, error: docsError } = await supabase
        .from('document_uploads')
        .select(`
          id,
          document_requests!inner(buyer_id)
        `)
        .eq('status', 'approved')
        .in('content_extraction_status', ['pending']);

      if (docsError) throw docsError;

      // Count pending per buyer
      const pendingCounts: Record<string, number> = {};
      pendingDocs?.forEach(doc => {
        const buyerId = doc.document_requests?.buyer_id;
        if (buyerId) {
          pendingCounts[buyerId] = (pendingCounts[buyerId] || 0) + 1;
        }
      });

      // Build buyer list
      const buyerList: BuyerPendingInfo[] = (buyersData || [])
        .map(b => ({
          id: b.id,
          company_name: b.company_name,
          pending_count: pendingCounts[b.id] || 0,
          is_demo: DEMO_PATTERNS.some(p => b.company_name.toLowerCase().includes(p)),
          selected: !DEMO_PATTERNS.some(p => b.company_name.toLowerCase().includes(p)) && (pendingCounts[b.id] || 0) > 0
        }))
        .filter(b => b.pending_count > 0)
        .sort((a, b) => b.pending_count - a.pending_count);

      setBuyers(buyerList);
    } catch (error) {
      console.error('Error fetching pending documents:', error);
      toast({
        title: 'Error',
        description: 'Failed to load pending documents',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleBuyerSelection = (buyerId: string) => {
    setBuyers(prev => prev.map(b => 
      b.id === buyerId ? { ...b, selected: !b.selected } : b
    ));
  };

  const selectAll = (selected: boolean) => {
    setBuyers(prev => prev.map(b => ({ ...b, selected })));
  };

  const selectedBuyers = buyers.filter(b => b.selected);
  const totalSelected = selectedBuyers.reduce((sum, b) => sum + b.pending_count, 0);

  const startBackfill = async () => {
    if (selectedBuyers.length === 0) {
      toast({
        title: 'No buyers selected',
        description: 'Please select at least one buyer to process',
        variant: 'destructive'
      });
      return;
    }

    setProcessing(true);
    setProgress(0);
    setResults([]);
    setTotalProcessed(0);
    setTotalFailed(0);

    try {
      const buyerIds = selectedBuyers.map(b => b.id);
      let processedTotal = 0;
      let failedTotal = 0;
      let remaining = totalSelected;
      const allResults: BackfillResult[] = [];

      // Process in batches
      while (remaining > 0) {
        const { data, error } = await supabase.functions.invoke('backfill-buyer-document-content', {
          body: {
            buyer_ids: buyerIds,
            exclude_demo: false, // We're manually selecting
            dry_run: false,
            batch_size: 3 // Process 3 at a time
          }
        });

        if (error) throw error;

        if (data.results) {
          allResults.push(...data.results);
          setResults([...allResults]);
        }

        processedTotal += data.processed || 0;
        failedTotal += data.failed || 0;
        remaining = data.remaining || 0;

        setTotalProcessed(processedTotal);
        setTotalFailed(failedTotal);
        setProgress(Math.round((processedTotal + failedTotal) / totalSelected * 100));

        if (data.results?.[data.results.length - 1]?.id) {
          setCurrentDoc(data.results[data.results.length - 1].id);
        }

        // If no more to process, break
        if (data.processed === 0 || remaining === 0) break;

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      toast({
        title: 'Backfill Complete',
        description: `Processed ${processedTotal} documents (${failedTotal} failed)`,
      });

      // Refresh the list
      await fetchPendingDocuments();
    } catch (error) {
      console.error('Backfill error:', error);
      toast({
        title: 'Backfill Error',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    } finally {
      setProcessing(false);
      setCurrentDoc(null);
    }
  };

  const estimatedTime = Math.ceil(totalSelected * 0.5); // ~30 seconds per doc with rate limiting

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'hsl(var(--admin-text))' }}>
            Document Content Analysis
          </h2>
          <p className="text-sm mt-1" style={{ color: 'hsl(var(--admin-text-muted))' }}>
            Backfill AI analysis for legacy approved documents
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchPendingDocuments}
          disabled={loading || processing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Pending Summary Card */}
      <Card style={{ backgroundColor: 'hsl(var(--admin-card))', borderColor: 'hsl(var(--admin-border))' }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2" style={{ color: 'hsl(var(--admin-text))' }}>
            <Sparkles className="h-5 w-5" style={{ color: 'hsl(var(--admin-accent-blue))' }} />
            Pending Analysis Summary
          </CardTitle>
          <CardDescription style={{ color: 'hsl(var(--admin-text-muted))' }}>
            Select buyers to process their pending documents
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : buyers.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 mx-auto mb-3" style={{ color: 'hsl(var(--admin-accent-green))' }} />
              <p className="font-medium" style={{ color: 'hsl(var(--admin-text))' }}>
                All documents analyzed!
              </p>
              <p className="text-sm mt-1" style={{ color: 'hsl(var(--admin-text-muted))' }}>
                No pending documents found
              </p>
            </div>
          ) : (
            <>
              {/* Select All */}
              <div className="flex items-center justify-between mb-4 pb-3 border-b" style={{ borderColor: 'hsl(var(--admin-border))' }}>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={buyers.every(b => b.selected)}
                    onCheckedChange={(checked) => selectAll(!!checked)}
                    disabled={processing}
                  />
                  <span className="text-sm font-medium" style={{ color: 'hsl(var(--admin-text))' }}>
                    Select All
                  </span>
                </div>
                <span className="text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>
                  {totalSelected} documents selected
                </span>
              </div>

              {/* Buyer List */}
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {buyers.map(buyer => (
                    <div
                      key={buyer.id}
                      className="flex items-center justify-between p-3 rounded-lg border transition-colors"
                      style={{ 
                        backgroundColor: buyer.selected ? 'hsl(var(--admin-sidebar-accent))' : 'transparent',
                        borderColor: 'hsl(var(--admin-border))'
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={buyer.selected}
                          onCheckedChange={() => toggleBuyerSelection(buyer.id)}
                          disabled={processing}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium" style={{ color: 'hsl(var(--admin-text))' }}>
                              {buyer.company_name}
                            </span>
                            {buyer.is_demo && (
                              <Badge variant="outline" className="text-xs">
                                Demo
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <Badge 
                        className="text-xs"
                        style={{ 
                          backgroundColor: 'hsl(var(--admin-accent-blue) / 0.1)',
                          color: 'hsl(var(--admin-accent-blue))'
                        }}
                      >
                        {buyer.pending_count} pending
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Warning */}
              <div 
                className="mt-4 p-3 rounded-lg border flex items-start gap-3"
                style={{ 
                  backgroundColor: 'hsl(45 93% 47% / 0.1)',
                  borderColor: 'hsl(45 93% 47% / 0.3)'
                }}
              >
                <AlertTriangle className="h-5 w-5 mt-0.5" style={{ color: 'hsl(45 93% 47%)' }} />
                <div>
                  <p className="text-sm font-medium" style={{ color: 'hsl(var(--admin-text))' }}>
                    AI Credits Notice
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'hsl(var(--admin-text-muted))' }}>
                    Each document uses OpenAI Vision API credits for analysis. 
                    Estimated time: ~{estimatedTime} minutes for {totalSelected} documents.
                  </p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Start Button */}
      {buyers.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>
            {selectedBuyers.length} buyers selected • {totalSelected} documents
          </div>
          <Button
            onClick={startBackfill}
            disabled={processing || selectedBuyers.length === 0}
            className="min-w-[150px]"
            style={{ 
              backgroundColor: 'hsl(var(--admin-accent-blue))',
              color: 'white'
            }}
          >
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Start Backfill
              </>
            )}
          </Button>
        </div>
      )}

      {/* Progress */}
      {processing && (
        <Card style={{ backgroundColor: 'hsl(var(--admin-card))', borderColor: 'hsl(var(--admin-border))' }}>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span style={{ color: 'hsl(var(--admin-text))' }}>
                  Processing: {totalProcessed + totalFailed} / {totalSelected}
                </span>
                <span style={{ color: 'hsl(var(--admin-text-muted))' }}>
                  {progress}%
                </span>
              </div>
              <Progress value={progress} className="h-2" />
              {currentDoc && (
                <p className="text-xs" style={{ color: 'hsl(var(--admin-text-muted))' }}>
                  Currently processing: {currentDoc.substring(0, 8)}...
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {results.length > 0 && (
        <Card style={{ backgroundColor: 'hsl(var(--admin-card))', borderColor: 'hsl(var(--admin-border))' }}>
          <CardHeader>
            <CardTitle style={{ color: 'hsl(var(--admin-text))' }}>
              Processing Results
            </CardTitle>
            <CardDescription style={{ color: 'hsl(var(--admin-text-muted))' }}>
              {totalProcessed} succeeded, {totalFailed} failed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {results.map((result, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-2 rounded-lg"
                    style={{ backgroundColor: 'hsl(var(--admin-sidebar-accent))' }}
                  >
                    {result.success ? (
                      <CheckCircle className="h-4 w-4 mt-0.5" style={{ color: 'hsl(var(--admin-accent-green))' }} />
                    ) : (
                      <XCircle className="h-4 w-4 mt-0.5" style={{ color: 'hsl(var(--destructive))' }} />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono" style={{ color: 'hsl(var(--admin-text-muted))' }}>
                        {result.id}
                      </p>
                      {result.success && result.summary_preview && (
                        <p className="text-xs mt-1 truncate" style={{ color: 'hsl(var(--admin-text))' }}>
                          {result.summary_preview}
                        </p>
                      )}
                      {!result.success && result.error && (
                        <p className="text-xs mt-1" style={{ color: 'hsl(var(--destructive))' }}>
                          {result.error}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
