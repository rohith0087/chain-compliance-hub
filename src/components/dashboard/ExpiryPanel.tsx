import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, AlertCircle, Clock, RefreshCw, Bell } from 'lucide-react';
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
  supplier_name: string;
  expiration_date: string;
  days_until_expiry: number;
  request_id: string;
}

type ExpiryTier = 'critical' | 'soon' | 'upcoming' | 'expired';

export function ExpiryPanel({ buyerId, onNavigateToDocuments }: ExpiryPanelProps) {
  const [documents, setDocuments] = useState<Record<ExpiryTier, ExpiringDocument[]>>({
    critical: [],
    soon: [],
    upcoming: [],
    expired: []
  });
  const [loading, setLoading] = useState(true);
  const [activeTier, setActiveTier] = useState<ExpiryTier>('critical');
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
              suppliers (company_name)
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

        const categorized: Record<ExpiryTier, ExpiringDocument[]> = {
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
        
        // Auto-select first non-empty tier
        if (categorized.expired.length > 0) setActiveTier('expired');
        else if (categorized.critical.length > 0) setActiveTier('critical');
        else if (categorized.soon.length > 0) setActiveTier('soon');
        else setActiveTier('upcoming');
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

  const getTierColor = (tier: ExpiryTier) => {
    switch (tier) {
      case 'expired': return 'text-red-600 bg-red-500/15';
      case 'critical': return 'text-red-500 bg-red-500/10';
      case 'soon': return 'text-amber-600 bg-amber-500/15';
      case 'upcoming': return 'text-yellow-600 bg-yellow-500/15';
    }
  };

  const getDocumentColor = (daysUntil: number) => {
    if (daysUntil < 0) return 'border-red-500/30 bg-red-500/5';
    if (daysUntil <= 7) return 'border-red-500/20 bg-red-500/5';
    if (daysUntil <= 30) return 'border-amber-500/20 bg-amber-500/5';
    return 'border-yellow-500/20 bg-yellow-500/5';
  };

  const totalExpiring = documents.critical.length + documents.soon.length + documents.upcoming.length + documents.expired.length;

  const handleRequestRenewal = (requestId: string) => {
    sessionStorage.setItem('buyer_docs_highlight_request', requestId);
    onNavigateToDocuments('expiring');
  };

  return (
    <Card className="h-full flex flex-col border-0 bg-gradient-to-br from-card via-card to-red-500/5">
      <CardHeader className="flex-shrink-0 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Calendar className="w-4 h-4 text-red-500" />
            Document Expiry Tracker
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {totalExpiring} total
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 min-h-0 flex flex-col p-0">
        <Tabs value={activeTier} onValueChange={(v) => setActiveTier(v as ExpiryTier)} className="flex-1 flex flex-col">
          <TabsList className="mx-4 mb-2 grid grid-cols-4 h-9">
            <TabsTrigger value="expired" className="text-xs px-2 data-[state=active]:bg-red-500/15 data-[state=active]:text-red-600">
              <AlertCircle className="w-3 h-3 mr-1" />
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
            <TabsTrigger value="soon" className="text-xs px-2 data-[state=active]:bg-amber-500/15 data-[state=active]:text-amber-600">
              30d
              {documents.soon.length > 0 && (
                <Badge className="ml-1 h-4 px-1 text-[10px] bg-amber-500">{documents.soon.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="text-xs px-2 data-[state=active]:bg-yellow-500/15 data-[state=active]:text-yellow-600">
              60d
              {documents.upcoming.length > 0 && (
                <Badge className="ml-1 h-4 px-1 text-[10px] bg-yellow-500">{documents.upcoming.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0">
            {(['expired', 'critical', 'soon', 'upcoming'] as ExpiryTier[]).map(tier => (
              <TabsContent key={tier} value={tier} className="h-full m-0 data-[state=inactive]:hidden">
                <ScrollArea className="h-full px-4 pb-4">
                  {loading ? (
                    <div className="space-y-3">
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
                      ))}
                    </div>
                  ) : documents[tier].length > 0 ? (
                    <div className="space-y-2">
                      {documents[tier].map((doc, index) => (
                        <motion.div
                          key={doc.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.03 }}
                          className={cn(
                            "group p-3 rounded-lg border transition-all duration-200",
                            "hover:shadow-md hover:border-primary/30",
                            getDocumentColor(doc.days_until_expiry)
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
                                "text-xs font-medium px-2 py-0.5 rounded-full",
                                getTierColor(doc.days_until_expiry < 0 ? 'expired' : 
                                            doc.days_until_expiry <= 7 ? 'critical' : 
                                            doc.days_until_expiry <= 30 ? 'soon' : 'upcoming')
                              )}>
                                {formatExpiryDate(doc.expiration_date, doc.days_until_expiry)}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleRequestRenewal(doc.request_id)}
                              >
                                <RefreshCw className="w-3 h-3 mr-1" />
                                Renew
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full py-8">
                      <Calendar className="w-10 h-10 text-muted-foreground/50 mb-3" />
                      <p className="text-sm text-muted-foreground">No documents in this tier</p>
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            ))}
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}
