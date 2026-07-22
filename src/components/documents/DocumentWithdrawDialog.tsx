import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertTriangle } from 'lucide-react';

interface DocumentWithdrawDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (note: string) => void;
  documentTitle: string;
  loading?: boolean;
}

const DocumentWithdrawDialog = ({
  isOpen,
  onClose,
  onConfirm,
  documentTitle,
  loading = false
}: DocumentWithdrawDialogProps) => {
  const [note, setNote] = useState('');

  const handleConfirm = () => {
    if (!note.trim()) return;
    onConfirm(note);
    setNote('');
  };

  const handleCancel = () => {
    setNote('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Withdraw Document Request
          </DialogTitle>
          <DialogDescription>
            You are about to withdraw "{documentTitle}". The supplier will no longer see this request.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg text-sm text-warning">
            This action cannot be undone. The request will be removed from the supplier's view.
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="withdraw-note">Reason for withdrawing (required)</Label>
            <Textarea
              id="withdraw-note"
              placeholder="Please explain why you're withdrawing this request..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={loading}>
            Cancel
          </Button>
          <Button 
            variant="default"
            className="bg-warning hover:bg-warning text-white"
            onClick={handleConfirm} 
            disabled={loading || !note.trim()}
          >
            {loading ? 'Withdrawing...' : 'Withdraw Request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DocumentWithdrawDialog;
