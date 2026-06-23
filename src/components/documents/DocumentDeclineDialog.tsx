
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
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from '@/components/ui/select';

interface DocumentDeclineDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reasonCode: string, notes: string) => void;
  documentTitle: string;
  loading?: boolean;
}

const DocumentDeclineDialog = ({
  isOpen,
  onClose,
  onConfirm,
  documentTitle,
  loading = false
}: DocumentDeclineDialogProps) => {
  const [reason, setReason] = useState('');
  const [reasonCode,setReasonCode]=useState('');

  const handleConfirm = () => {
    onConfirm(reasonCode,reason);
    setReason('');
    setReasonCode('');
  };

  const handleCancel = () => {
    setReason('');
    setReasonCode('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Decline Document</DialogTitle>
          <DialogDescription>
            You are about to decline "{documentTitle}". Please provide a reason for the supplier.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Rejection reason</Label>
            <Select value={reasonCode} onValueChange={setReasonCode}><SelectTrigger><SelectValue placeholder="Select a reason"/></SelectTrigger><SelectContent>
              <SelectItem value="expired">Expired</SelectItem><SelectItem value="wrong_supplier">Wrong supplier</SelectItem><SelectItem value="wrong_facility">Wrong facility</SelectItem><SelectItem value="wrong_document_type">Wrong document type</SelectItem><SelectItem value="missing_pages">Missing pages</SelectItem><SelectItem value="unreadable">Unreadable</SelectItem><SelectItem value="scope_mismatch">Scope mismatch</SelectItem><SelectItem value="signature_missing">Signature missing</SelectItem><SelectItem value="validity_insufficient">Validity insufficient</SelectItem><SelectItem value="other">Other</SelectItem>
            </SelectContent></Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reason">Correction instructions</Label>
            <Textarea
              id="reason"
              placeholder="Please provide feedback to help the supplier improve their submission..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={loading}>
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleConfirm} 
            disabled={loading||!reasonCode||reason.trim().length<3||(reasonCode==='other'&&reason.trim().length<10)}
          >
            {loading ? 'Declining...' : 'Decline Document'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DocumentDeclineDialog;
