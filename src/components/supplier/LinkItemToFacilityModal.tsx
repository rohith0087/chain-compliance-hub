import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { SafeSelect } from '@/components/ui/SafeSelect';
import { useCompanyBranches } from '@/hooks/useCompanyBranches';
import { useSupplierItems } from '@/hooks/useSupplierItems';
import { useItemFacilityMappings } from '@/hooks/useItemFacilityMappings';

interface LinkItemToFacilityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  facilityId?: string | null;
  itemId?: string | null;
  supplierId?: string;
}

export const LinkItemToFacilityModal = ({
  open,
  onOpenChange,
  facilityId,
  itemId,
  supplierId
}: LinkItemToFacilityModalProps) => {
  const [selectedFacility, setSelectedFacility] = useState(facilityId || '');
  const [selectedItem, setSelectedItem] = useState(itemId || '');
  const [isPrimary, setIsPrimary] = useState(false);
  const [productionCapacity, setProductionCapacity] = useState('');
  const [leadTimeDays, setLeadTimeDays] = useState('');
  const [notes, setNotes] = useState('');

  const { branches } = useCompanyBranches('supplier');
  const { items } = useSupplierItems();
  const { createMapping } = useItemFacilityMappings(supplierId);

  useEffect(() => {
    if (facilityId) setSelectedFacility(facilityId);
    if (itemId) setSelectedItem(itemId);
  }, [facilityId, itemId]);

  const handleSubmit = async () => {
    if (!selectedFacility || !selectedItem) return;

    await createMapping({
      item_id: selectedItem,
      facility_id: selectedFacility,
      is_primary_producer: isPrimary,
      production_capacity: productionCapacity ? parseInt(productionCapacity) : undefined,
      lead_time_days: leadTimeDays ? parseInt(leadTimeDays) : undefined,
      notes: notes || undefined
    });

    // Reset form
    setSelectedFacility(facilityId || '');
    setSelectedItem(itemId || '');
    setIsPrimary(false);
    setProductionCapacity('');
    setLeadTimeDays('');
    setNotes('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Link Item to Facility</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Facility</Label>
            <SafeSelect
              value={selectedFacility}
              onValueChange={setSelectedFacility}
              disabled={!!facilityId}
            >
              <option value="">Select facility...</option>
              {branches.map(branch => (
                <option key={branch.id} value={branch.id}>
                  {branch.branch_name} - {branch.location}
                </option>
              ))}
            </SafeSelect>
          </div>

          <div className="space-y-2">
            <Label>Item</Label>
            <SafeSelect
              value={selectedItem}
              onValueChange={setSelectedItem}
              disabled={!!itemId}
            >
              <option value="">Select item...</option>
              {items.map(item => (
                <option key={item.id} value={item.id}>
                  {item.item_name}
                </option>
              ))}
            </SafeSelect>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="primary"
              checked={isPrimary}
              onCheckedChange={(checked) => setIsPrimary(checked as boolean)}
            />
            <Label htmlFor="primary" className="cursor-pointer">
              Primary production facility for this item
            </Label>
          </div>

          <div className="space-y-2">
            <Label>Production Capacity (optional)</Label>
            <Input
              type="number"
              value={productionCapacity}
              onChange={(e) => setProductionCapacity(e.target.value)}
              placeholder="Units per month"
            />
          </div>

          <div className="space-y-2">
            <Label>Lead Time (optional)</Label>
            <Input
              type="number"
              value={leadTimeDays}
              onChange={(e) => setLeadTimeDays(e.target.value)}
              placeholder="Days"
            />
          </div>

          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional information..."
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!selectedFacility || !selectedItem}
            >
              Link
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
