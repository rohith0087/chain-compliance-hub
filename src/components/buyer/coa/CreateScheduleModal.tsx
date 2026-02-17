import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useConnectedSuppliers, useCOASchedules } from '@/hooks/useCOA';
import { Loader2 } from 'lucide-react';

interface CreateScheduleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateScheduleModal({ open, onOpenChange }: CreateScheduleModalProps) {
  const { data: suppliers = [], isLoading: loadingSuppliers } = useConnectedSuppliers();
  const { createSchedule } = useCOASchedules();

  const [supplierId, setSupplierId] = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const [productName, setProductName] = useState('');
  const [nextDueDate, setNextDueDate] = useState('');
  const [gracePeriod, setGracePeriod] = useState('3');
  const [autoRemind, setAutoRemind] = useState(true);
  const [notes, setNotes] = useState('');
  const [customDays, setCustomDays] = useState('');

  const handleSubmit = () => {
    if (!supplierId || !nextDueDate) return;

    createSchedule.mutate({
      supplier_id: supplierId,
      frequency,
      next_due_date: nextDueDate,
      product_name: productName || undefined,
      grace_period_days: parseInt(gracePeriod) || 3,
      auto_remind: autoRemind,
      reminder_days_before: [7, 3, 1],
      notes: notes || undefined,
      custom_interval_days: frequency === 'custom' ? parseInt(customDays) || undefined : undefined,
    }, {
      onSuccess: () => {
        onOpenChange(false);
        resetForm();
      },
    });
  };

  const resetForm = () => {
    setSupplierId('');
    setFrequency('monthly');
    setProductName('');
    setNextDueDate('');
    setGracePeriod('3');
    setAutoRemind(true);
    setNotes('');
    setCustomDays('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Create COA Schedule</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Supplier *</Label>
            {loadingSuppliers ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading suppliers...
              </div>
            ) : (
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.company_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label>Product Name</Label>
            <Input value={productName} onChange={e => setProductName(e.target.value)} placeholder="e.g. Organic Flour Blend" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Frequency *</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="per_lot">Per Lot</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {frequency === 'custom' && (
              <div className="space-y-2">
                <Label>Interval (days)</Label>
                <Input type="number" value={customDays} onChange={e => setCustomDays(e.target.value)} placeholder="e.g. 45" />
              </div>
            )}

            <div className="space-y-2">
              <Label>Next Due Date *</Label>
              <Input type="date" value={nextDueDate} onChange={e => setNextDueDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Grace Period (days)</Label>
              <Input type="number" value={gracePeriod} onChange={e => setGracePeriod(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Auto-remind supplier</p>
              <p className="text-xs text-muted-foreground">Send email reminders at 7, 3, and 1 day(s) before due</p>
            </div>
            <Switch checked={autoRemind} onCheckedChange={setAutoRemind} />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional notes..." rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!supplierId || !nextDueDate || createSchedule.isPending}>
            {createSchedule.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Create Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
