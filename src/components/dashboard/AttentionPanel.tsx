import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, CheckCircle, Clock, Eye, ThumbsUp, ThumbsDown, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useBranchContext } from '@/contexts/BranchContext';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface AttentionPanelProps {
  buyerId: string;
  onNavigateToDocuments: (filter?: string) => void;
}

interface AttentionItem {
  id: string;
  title: string;
  supplier_id: string;
  supplier_name: string;
  status: string;
  due_date: string | null;
  submitted_at: string | null;
  is_overdue: boolean;
  priority: string | null;
}

export function AttentionPanel({ buyerId, onNavigateToDocuments }: AttentionPanelProps) {
  const [items, setItems] = useState<AttentionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ submitted: 0, overdue: 0 });
  const { currentBranch, allBranchesView } = useBranchContext();

  useEffect(() => {
    const fetchAttentionItems = async () => {
      if (!buyerId) return;
      
      setLoading(true);
      try {
        const branchFilter = !allBranchesView && currentBranch?.id ? currentBranch.id : null;
        const now = new Date().toISOString();

        // Fetch submitted documents (need review)
        let submittedQuery = supabase
          .from('document_requests')
          .select(`
            id, 
            title, 
            status, 
            due_date, 
            priority,
            updated_at,
            supplier_id,
            suppliers (company_name)
          `)
          .eq('buyer_id', buyerId)
          .eq('status', 'submitted')
          .order('updated_at', { ascending: false })
          .limit(20);
        
        if (branchFilter) submittedQuery = submittedQuery.eq('branch_id', branchFilter);
        const { data: submittedData } = await submittedQuery;

        // Fetch overdue pending documents
        let overdueQuery = supabase
          .from('document_requests')
          .select(`
            id, 
            title, 
            status, 
            due_date, 
            priority,
            updated_at,
            supplier_id,
            suppliers (company_name)
          `)
          .eq('buyer_id', buyerId)
          .eq('status', 'pending')
          .lt('due_date', now)
          .order('due_date', { ascending: true })
          .limit(10);
        
        if (branchFilter) overdueQuery = overdueQuery.eq('branch_id', branchFilter);
        const { data: overdueData } = await overdueQuery;

        const submitted = (submittedData || []).map(item => ({
          id: item.id,
          title: item.title,
          supplier_id: item.supplier_id,
          supplier_name: (item.suppliers as any)?.company_name || 'Unknown',
          status: 'submitted',
          due_date: item.due_date,
          submitted_at: item.updated_at,
          is_overdue: false,
          priority: item.priority
        }));

        const overdue = (overdueData || []).map(item => ({
          id: item.id,
          title: item.title,
          supplier_id: item.supplier_id,
          supplier_name: (item.suppliers as any)?.company_name || 'Unknown',
          status: 'overdue',
          due_date: item.due_date,
          submitted_at: null,
          is_overdue: true,
          priority: item.priority
        }));

        setCounts({
          submitted: submitted.length,
          overdue: overdue.length
        });

        // Combine and sort: overdue first, then by date
        setItems([...overdue, ...submitted]);
      } catch (error) {
        console.error('Error fetching attention items:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAttentionItems();
  }, [buyerId, currentBranch?.id, allBranchesView]);

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays}d ago`;
  };

  const handleItemClick = (item: AttentionItem) => {
    // Set multiple filters via sessionStorage for deep-link navigation
    sessionStorage.setItem('buyer_docs_filter_search', item.title);
    if (item.supplier_id) {
      sessionStorage.setItem('buyer_docs_filter_supplier', item.supplier_id);
    }
    sessionStorage.setItem('buyer_docs_filter_status', item.is_overdue ? 'pending' : 'submitted');
    sessionStorage.setItem('buyer_docs_highlight_request', item.id);
    onNavigateToDocuments();
  };

  const handleQuickAction = async (itemId: string, action: 'view' | 'approve' | 'decline') => {
    if (action === 'view') {
      const item = items.find(i => i.id === itemId);
      if (item) {
        handleItemClick(item);
      }
    }
    // Approve/Decline would need more complex handling with modals
  };

  return (
    <Card className="h-full flex flex-col border-0 bg-gradient-to-br from-card via-card to-amber-500/5">
      <CardHeader className="flex-shrink-0 pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          Needs Your Attention
        </CardTitle>
        <div className="flex gap-2 mt-2">
          <Badge 
            variant="secondary" 
            className={cn(
              "text-xs cursor-pointer transition-colors",
              counts.submitted > 0 && "bg-teal-500/15 text-teal-600 hover:bg-teal-500/25"
            )}
            onClick={() => onNavigateToDocuments('submitted')}
          >
            <FileText className="w-3 h-3 mr-1" />
            {counts.submitted} Submitted
          </Badge>
          <Badge 
            variant="secondary" 
            className={cn(
              "text-xs cursor-pointer transition-colors",
              counts.overdue > 0 && "bg-red-500/15 text-red-600 hover:bg-red-500/25"
            )}
            onClick={() => onNavigateToDocuments('pending')}
          >
            <Clock className="w-3 h-3 mr-1" />
            {counts.overdue} Overdue
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 min-h-0 p-0">
        <ScrollArea className="h-full px-4 pb-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-20 bg-muted/50 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : items.length > 0 ? (
            <div className="space-y-2">
              {items.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleItemClick(item)}
                  className={cn(
                    "group p-3 rounded-lg border transition-all duration-200 cursor-pointer",
                    "hover:shadow-md hover:border-primary/30",
                    item.is_overdue 
                      ? "bg-red-500/5 border-red-500/20" 
                      : "bg-teal-500/5 border-teal-500/20"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-2 h-2 rounded-full flex-shrink-0",
                          item.is_overdue ? "bg-red-500 animate-pulse" : "bg-teal-500"
                        )} />
                        <p className="text-sm font-medium truncate">{item.title}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 pl-4">
                        {item.supplier_name}
                      </p>
                      <div className="flex items-center gap-2 mt-1 pl-4">
                        <span className={cn(
                          "text-xs",
                          item.is_overdue ? "text-red-500" : "text-teal-600"
                        )}>
                          {item.is_overdue 
                            ? `Overdue ${item.due_date ? formatTimeAgo(item.due_date) : ''}` 
                            : `Submitted ${item.submitted_at ? formatTimeAgo(item.submitted_at) : ''}`
                          }
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleQuickAction(item.id, 'view')}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-8">
              <CheckCircle className="w-10 h-10 text-green-500 mb-3" />
              <p className="text-sm font-medium text-foreground">All caught up!</p>
              <p className="text-xs text-muted-foreground mt-1">No items need your attention</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
