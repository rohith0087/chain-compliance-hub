import { useState } from 'react';
import { Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useDocumentSets } from '@/hooks/useDocumentSets';

interface SaveDocumentSetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buyerId: string;
  selectedDocumentIds: string[];
  documentCount: number;
}

export function SaveDocumentSetDialog({
  open,
  onOpenChange,
  buyerId,
  selectedDocumentIds,
  documentCount,
}: SaveDocumentSetDialogProps) {
  const { createSet, isCreating } = useDocumentSets(buyerId);
  const [formData, setFormData] = useState({
    set_name: '',
    description: '',
    is_default: false,
  });

  const handleSave = () => {
    createSet({
      buyer_id: buyerId,
      set_name: formData.set_name,
      description: formData.description || undefined,
      document_ids: selectedDocumentIds,
      is_default: formData.is_default,
    });
    onOpenChange(false);
    setFormData({ set_name: '', description: '', is_default: false });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Save as Document Set
          </DialogTitle>
          <DialogDescription>
            Save {documentCount} selected document{documentCount !== 1 ? 's' : ''} as a reusable set
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="set_name">Set Name*</Label>
            <Input
              id="set_name"
              value={formData.set_name}
              onChange={(e) => setFormData({ ...formData, set_name: e.target.value })}
              placeholder="e.g., Food Safety Package"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe what this set is used for..."
              rows={3}
            />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_default"
              checked={formData.is_default}
              onCheckedChange={(checked) => 
                setFormData({ ...formData, is_default: checked as boolean })
              }
            />
            <Label htmlFor="is_default" className="text-sm font-normal cursor-pointer">
              Set as default (auto-select when creating new requests)
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!formData.set_name.trim() || isCreating}
          >
            {isCreating ? 'Saving...' : 'Save Set'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
