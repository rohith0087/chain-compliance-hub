import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Bot, Loader2, SendHorizonal, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  reviewCardContainerClass,
  reviewPageSubtitleClass,
  reviewPageTitleClass,
} from '@/components/documents/buyerReviewDesignSystem';

interface ComplianceQAViewProps {
  buyerId: string;
  lockSupplierId?: string;   // when set, scope to one supplier and hide the picker
}

interface SupplierOption { id: string; company_name: string }
interface Turn { question: string; answer: string; scope?: { requirements: number; approved_evidence: number; open_gaps: number; documents_read?: number } }

const SUGGESTED = [
  'Is this supplier fully compliant right now?',
  'What evidence is still missing?',
  'When does their food safety certification expire?',
  'What are the biggest compliance risks for this supplier?',
];

export default function ComplianceQAView({ buyerId, lockSupplierId }: ComplianceQAViewProps) {
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [supplierId, setSupplierId] = useState(lockSupplierId ?? '');
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadSuppliers = useCallback(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any).from('buyer_supplier_connections')
        .select('supplier_id, suppliers(id, company_name)').eq('buyer_id', buyerId).eq('status', 'approved');
      const opts = ((data || []) as Array<{ suppliers: SupplierOption | SupplierOption[] | null }>)
        .flatMap((row) => { const s = Array.isArray(row.suppliers) ? row.suppliers[0] : row.suppliers; return s ? [s] : []; });
      setSuppliers(opts);
      if (opts.length && !supplierId) setSupplierId(opts[0].id);
    } catch { /* non-fatal */ }
  }, [buyerId, supplierId]);

  useEffect(() => { void loadSuppliers(); }, [loadSuppliers]);

  const ask = async (q: string) => {
    if (!supplierId) { toast.error('Pick a supplier first.'); return; }
    if (q.trim().length < 3) return;
    setAsking(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('compliance-qa-v1', {
        body: { buyer_id: buyerId, supplier_id: supplierId, question: q },
      });
      if (fnError) throw fnError;
      const res = data as { answer: string; scope_summary?: Turn['scope'] };
      setTurns((prev) => [{ question: q, answer: res.answer, scope: res.scope_summary }, ...prev]);
      setQuestion('');
    } catch (askError) {
      setError(askError instanceof Error ? askError.message : 'Q&A failed');
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="space-y-6">
      {!lockSupplierId && (
        <div>
          <h1 className={reviewPageTitleClass}>
            <Bot className="mr-2 inline h-7 w-7 text-primary" />
            Compliance Assistant
          </h1>
          <p className={reviewPageSubtitleClass}>
            Ask about a supplier's compliance and get grounded answers — restricted to their active
            requirements, approved evidence, and open gaps. Answers cite the requirements they draw from.
          </p>
        </div>
      )}

      <div className={`${reviewCardContainerClass} space-y-3 p-4`}>
        {!lockSupplierId && (
          <div className="flex flex-wrap items-center gap-2">
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger className="max-w-xs"><SelectValue placeholder="Select supplier" /></SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.company_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Input
            placeholder="Ask about this supplier's compliance…"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !asking) void ask(question); }}
          />
          <Button onClick={() => void ask(question)} disabled={asking}>
            {asking ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED.map((s) => (
            <Button key={s} size="sm" variant="ghost" className="h-auto py-1 text-xs" disabled={asking} onClick={() => void ask(s)}>
              <Sparkles className="mr-1 h-3 w-3" />{s}
            </Button>
          ))}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-3">
        {turns.map((turn, i) => (
          <div key={i} className={`${reviewCardContainerClass} p-4`}>
            <p className="text-sm font-medium">{turn.question}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{turn.answer}</p>
            {turn.scope && (
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="outline" className="text-xs">{turn.scope.requirements} requirements in scope</Badge>
                <Badge variant="outline" className="text-xs">{turn.scope.approved_evidence} approved evidence</Badge>
                <Badge variant="outline" className="text-xs">{turn.scope.open_gaps} open gaps</Badge>
                {typeof turn.scope.documents_read === 'number' && turn.scope.documents_read > 0 && (
                  <Badge variant="outline" className="text-xs">{turn.scope.documents_read} document{turn.scope.documents_read > 1 ? 's' : ''} read</Badge>
                )}
                <span className="text-[10px] text-muted-foreground">· grounded in this supplier's compliance record only</span>
              </div>
            )}
          </div>
        ))}
        {turns.length === 0 && (
          <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
            Pick a supplier and ask a question, or try a suggestion above.
          </div>
        )}
      </div>
    </div>
  );
}
