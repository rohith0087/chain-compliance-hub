import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SafeSelect } from '@/components/ui/SafeSelect';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { useDocumentAssignments } from '@/hooks/useDocumentAssignments';

interface AssignDocumentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentIds: string[];
  teamMembers: any[];
  onAssignComplete: () => void;
}

export const AssignDocumentModal = ({
  open,
  onOpenChange,
  documentIds,
  teamMembers,
  onAssignComplete
}: AssignDocumentModalProps) => {
  const { user } = useAuth();
  const { createAssignment } = useDocumentAssignments();
  const [assigneeId, setAssigneeId] = useState('');
  const [assignmentType, setAssignmentType] = useState('review');
  const [priority, setPriority] = useState('normal');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!assigneeId || !user) return;

    try {
      setSubmitting(true);

      for (const docId of documentIds) {
        await createAssignment({
          document_upload_id: docId,
          assigned_to: assigneeId,
          assigned_by: user.id,
          assignment_type: assignmentType as any,
          priority: priority as any,
          due_date: dueDate || undefined,
          notes: notes || undefined
        });
      }

      onAssignComplete();
      onOpenChange(false);

      // Reset form
      setAssigneeId('');
      setAssignmentType('review');
      setPriority('normal');
      setDueDate('');
      setNotes('');

    } catch (error) {
      console.error('Error assigning documents:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Documents ({documentIds.length})</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Assign To</Label>
            <SafeSelect value={assigneeId} onValueChange={setAssigneeId}>
              <option value="">Select team member...</option>
              {teamMembers.map(member => (
                <option key={member.profile_id} value={member.profile_id}>
                  {member.profile?.full_name} ({member.role})
                </option>
              ))}
            </SafeSelect>
          </div>

          <div className="space-y-2">
            <Label>Assignment Type</Label>
            <SafeSelect value={assignmentType} onValueChange={setAssignmentType}>
              <option value="review">Review</option>
              <option value="approve">Approve</option>
              <option value="qa_check">QA Check</option>
              <option value="final_sign_off">Final Sign-Off</option>
            </SafeSelect>
          </div>

          <div className="space-y-2">
            <Label>Priority</Label>
            <SafeSelect value={priority} onValueChange={setPriority}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </SafeSelect>
          </div>

          <div className="space-y-2">
            <Label>Due Date (optional)</Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Assignment instructions..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!assigneeId || submitting}
            >
              {submitting ? 'Assigning...' : 'Assign'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
