import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, ClipboardCheck } from 'lucide-react';
import { useAuditFindings, FindingSeverity, FindingStatus } from '@/hooks/useAuditFindings';

interface Props {
  supplierId: string;
  supplierName?: string;
}

const SEVERITY_VARIANT: Record<FindingSeverity, string> = {
  Minor: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Major: 'bg-amber-100 text-amber-800 border-amber-200',
  Critical: 'bg-red-100 text-red-700 border-red-200',
};

export function AuditFindingsTab({ supplierId, supplierName }: Props) {
  const { findings, loading, create, updateStatus, remove } = useAuditFindings(supplierId);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ title: string; description: string; severity: FindingSeverity }>({
    title: '',
    description: '',
    severity: 'Minor',
  });

  const submit = async () => {
    if (!form.title.trim()) return;
    await create({ title: form.title, description: form.description, severity: form.severity });
    setForm({ title: '', description: '', severity: 'Minor' });
    setOpen(false);
  };

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-primary" />
          Audit Findings {supplierName ? `— ${supplierName}` : ''}
          <Badge variant="secondary" className="ml-1">{findings.length}</Badge>
        </CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-3.5 w-3.5 mr-1" /> Add Finding</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Audit Finding</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Title</Label>
                <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Missing temperature log on 2026-05-12" />
              </div>
              <div>
                <Label>Severity</Label>
                <Select value={form.severity} onValueChange={(v: FindingSeverity) => setForm({ ...form, severity: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Minor">Minor</SelectItem>
                    <SelectItem value="Major">Major</SelectItem>
                    <SelectItem value="Critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={submit} disabled={!form.title.trim()}>Save Finding</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : findings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No findings recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {findings.map(f => (
              <div key={f.id} className="flex items-start justify-between gap-3 p-3 rounded-md border border-border/60 bg-card">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded border ${SEVERITY_VARIANT[f.severity]}`}>{f.severity}</span>
                    <span className="text-sm font-medium">{f.title}</span>
                  </div>
                  {f.description && <p className="text-xs text-muted-foreground mt-1">{f.description}</p>}
                  <p className="text-[11px] text-muted-foreground mt-1">{new Date(f.finding_date).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Select value={f.status} onValueChange={(v: FindingStatus) => updateStatus(f.id, v)}>
                    <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Open">Open</SelectItem>
                      <SelectItem value="In Progress">In Progress</SelectItem>
                      <SelectItem value="Closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="icon" variant="ghost" onClick={() => remove(f.id)} className="h-8 w-8">
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
