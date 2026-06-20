import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, AlertCircle, Clock, RefreshCw, Bell, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useBranchContext } from '@/contexts/BranchContext';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ExpiryPanelProps {
  buyerId: string;
  onNavigateToDocuments: (filter?: string) => void;
}

interface ExpiringDocument {
  id: string;
  document_name: string;
  document_type: string;
  supplier_id: string;
  supplier_name: string;
  expiration_date: string;
  days_until_expiry: number;
  request_id: string;
}

type ExpiryTier = 'all' | 'critical' | 'soon' | 'upcoming' | 'expired';

export function ExpiryPanel({ buyerId, onNavigateToDocuments }: ExpiryPanelProps) {
  const [documents, setDocuments] = useState<Record<Exclude<ExpiryTier, 'all'>, ExpiringDocument[]>>({
    critical: [],
    soon: [],
    upcoming: [],
    expired: []
  });
  const [loading, setLoading] = useState(true);
  const [activeTier, setActiveTier] = useState<ExpiryTier>('all');
  const { currentBranch, allBranchesView } = useBranchContext();

  useEffect(() => {
    const fetchExpiringDocuments = async () => {
      if (!buyerId) return;
      
      setLoading(true);
      try {
        const branchFilter = !allBranchesView && currentBranch?.id ? currentBranch.id : null;
        const now = new Date();
        const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        const in60Days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

        // Fetch all expiring documents
        let query = supabase
          .from('document_uploads')
          .select(`
            id,
            file_name,
            expiration_date,
            document_requests!inner (
              id,
              title,
              document_type,
              buyer_id,
              branch_id,
              supplier_id,
              suppliers (id, company_name)
            )
          `)
          .eq('document_requests.buyer_id', buyerId)
          .eq('status', 'approved')
          .not('expiration_date', 'is', null)
          .lte('expiration_date', in60Days.toISOString().split('T')[0])
          .order('expiration_date', { ascending: true });

        if (branchFilter) query = query.eq('document_requests.branch_id', branchFilter);
        const { data, error } = await query;

        if (error) throw error;

        const categorized: Record<Exclude<ExpiryTier, 'all'>, ExpiringDocument[]> = {
          critical: [],
          soon: [],
          upcoming: [],
          expired: []
        };

        (data || []).forEach(doc => {
          const expiryDate = new Date(doc.expiration_date);
          const daysUntil = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          const request = doc.document_requests as any;
          
          const item: ExpiringDocument = {
            id: doc.id,
            document_name: request?.title || doc.file_name,
            document_type: request?.document_type || 'Document',
            supplier_id: request?.supplier_id || '',
            supplier_name: request?.suppliers?.company_name || 'Unknown',
            expiration_date: doc.expiration_date,
            days_until_expiry: daysUntil,
            request_id: request?.id
          };

          if (daysUntil < 0) {
            categorized.expired.push(item);
          } else if (daysUntil <= 7) {
            categorized.critical.push(item);
          } else if (daysUntil <= 30) {
            categorized.soon.push(item);
          } else {
            categorized.upcoming.push(item);
          }
        });

        setDocuments(categorized);
        // Default to "All" tab
        setActiveTier('all');
      } catch (error) {
        console.error('Error fetching expiring documents:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchExpiringDocuments();
  }, [buyerId, currentBranch?.id, allBranchesView]);

  const formatExpiryDate = (dateString: string, daysUntil: number) => {
    const date = new Date(dateString);
    if (daysUntil < 0) return `Expired ${Math.abs(daysUntil)}d ago`;
    if (daysUntil === 0) return 'Expires today';
    if (daysUntil === 1) return 'Expires tomorrow';
    return `${daysUntil}d left`;
  };

  const getTierBadgeColor = (tier: Exclude<ExpiryTier, 'all'>) => {
    switch (tier) {
      case 'expired': return 'text-red-600 bg-red-500/15';
      case 'critical': return 'text-red-500 bg-red-500/10';
      case 'soon': return 'text-amber-600 bg-amber-500/15';
      case 'upcoming': return 'text-yellow-600 bg-yellow-500/15';
    }
  };

  const getDocBadgeColor = (daysUntil: number) => {
    if (daysUntil < 0) return 'text-red-600 bg-red-500/15';
    if (daysUntil <= 7) return 'text-red-500 bg-red-500/10';
    if (daysUntil <= 30) return 'text-amber-600 bg-amber-500/15';
    return 'text-yellow-600 bg-yellow-500/15';
  };

  // White card background with colored left border — no more full-red tint
  const getDocumentBorderColor = (daysUntil: number) => {
    if (daysUntil < -90) return 'border-l-4 border-l-red-600 bg-card border-border/30';
    if (daysUntil < 0) return 'border-l-4 border-l-red-500 bg-card border-border/30';
    if (daysUntil <= 7) return 'border-l-4 border-l-red-400 bg-card border-border/30';
    if (daysUntil <= 30) return 'border-l-4 border-l-amber-500 bg-card border-border/30';
    return 'border-l-4 border-l-yellow-500 bg-card border-border/30';
  };

  // Severity scaling — expired > 90 days gets bolder badge styling
  const getSeverityWeight = (daysUntil: number) => {
    if (daysUntil < -90) return 'font-semibold';
    return 'font-medium';
  };

  const totalExpiring = documents.critical.length + documents.soon.length + documents.upcoming.length + documents.expired.length;

  // Build a combined list for "All" tab, sorted by urgency (most expired first)
  const allDocuments = [
    ...documents.expired.map(d => ({ ...d, _tier: 'expired' as const })),
    ...documents.critical.map(d => ({ ...d, _tier: 'critical' as const })),
    ...documents.soon.map(d => ({ ...d, _tier: 'soon' as const })),
    ...documents.upcoming.map(d => ({ ...d, _tier: 'upcoming' as const })),
  ];

  const handleDocumentClick = (doc: ExpiringDocument) => {
    // Set multiple filters via sessionStorage for deep-link navigation
    sessionStorage.setItem('buyer_docs_filter_search', doc.document_name);
    if (doc.supplier_id) {
      sessionStorage.setItem('buyer_docs_filter_supplier', doc.supplier_id);
    }
    sessionStorage.setItem('buyer_docs_filter_expiration', 'expiring_soon');
    sessionStorage.setItem('buyer_docs_highlight_request', doc.request_id);
    onNavigateToDocuments();
  };

  const handleRequestRenewal = (doc: ExpiringDocument, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click
    handleDocumentClick(doc);
  };

  const getDocumentsForTier = (tier: ExpiryTier): ExpiringDocument[] => {
    if (tier === 'all') return allDocuments;
    return documents[tier];
  };

  const renderDocumentList = (docs: ExpiringDocument[]) => {
    if (loading) {
      return (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
          ))}
        </div>
      );
    }

    if (docs.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full py-8">
          <Calendar className="w-10 h-10 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">No documents in this tier</p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {docs.map((doc, index) => (
          <motion.div
            key={doc.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
            onClick={() => handleDocumentClick(doc)}
            className={cn(
              "group p-3 rounded-lg border transition-all duration-200 cursor-pointer",
              "hover:shadow-md hover:border-primary/30",
              getDocumentBorderColor(doc.days_until_expiry)
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{doc.document_name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {doc.supplier_name} • {doc.document_type}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={cn(
                  "text-xs px-2 py-0.5 rounded-full",
                  getSeverityWeight(doc.days_until_expiry),
                  getDocBadgeColor(doc.days_until_expiry)
                )}>
                  {formatExpiryDate(doc.expiration_date, doc.days_until_expiry)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => handleRequestRenewal(doc, e)}
                >
                  <ChevronRight className="w-3 h-3 mr-1" />
                  View
                </Button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    );
  };

  return (
    <Card className="h-full flex flex-col border-0 bg-gradient-to-br from-card via-card to-muted/10">
      <CardHeader className="flex-shrink-0 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            Document Expiry Tracker
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {totalExpiring} total
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 min-h-0 flex flex-col p-0">
        <Tabs value={activeTier} onValueChange={(v) => setActiveTier(v as ExpiryTier)} className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-4 mb-2 grid grid-cols-5 h-9">
            <TabsTrigger value="all" className="text-xs px-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              All
              {totalExpiring > 0 && (
                <Badge className="ml-1 h-4 px-1 text-[10px] bg-primary">{totalExpiring}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="expired" className="text-xs px-2 data-[state=active]:bg-red-500/10 data-[state=active]:text-red-600">
              Expired
              {documents.expired.length > 0 && (
                <Badge className="ml-1 h-4 px-1 text-[10px] bg-red-500">{documents.expired.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="critical" className="text-xs px-2 data-[state=active]:bg-red-500/10 data-[state=active]:text-red-500">
              7d
              {documents.critical.length > 0 && (
                <Badge className="ml-1 h-4 px-1 text-[10px] bg-red-400">{documents.critical.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="soon" className="text-xs px-2 data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-600">
              30d
              {documents.soon.length > 0 && (
                <Badge className="ml-1 h-4 px-1 text-[10px] bg-amber-500">{documents.soon.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="text-xs px-2 data-[state=active]:bg-yellow-500/10 data-[state=active]:text-yellow-600">
              60d
              {documents.upcoming.length > 0 && (
                <Badge className="ml-1 h-4 px-1 text-[10px] bg-yellow-500">{documents.upcoming.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0">
            {(['all', 'expired', 'critical', 'soon', 'upcoming'] as ExpiryTier[]).map(tier => (
              <TabsContent key={tier} value={tier} className="h-full m-0 data-[state=inactive]:hidden">
                <ScrollArea className="flex-1 min-h-0 h-full px-4 pb-2">
                  {renderDocumentList(getDocumentsForTier(tier))}
                </ScrollArea>
              </TabsContent>
            ))}
          </div>
        </Tabs>

        {/* Footer link */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-border/30">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-primary hover:text-primary/80 hover:bg-primary/5 justify-center gap-1"
            onClick={() => onNavigateToDocuments('expiring_soon')}
          >
            View all documents
            <ChevronRight className="w-3 h-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
