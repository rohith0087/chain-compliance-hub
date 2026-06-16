import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface DocumentNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: any;
  onNotesSaved: (documentId: string, notes: string) => void;
}

export function DocumentNotesModal({ isOpen, onClose, document, onNotesSaved }: DocumentNotesModalProps) {
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (document) {
      setNotes(document.notes || '');
    }
  }, [document, isOpen]);

  const handleSave = async () => {
    if (!document) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('document_requests')
        .update({ notes })
        .eq('id', document.id);

      if (error) throw error;

      toast({
        title: "Notes saved successfully",
        description: "Your notes have been attached to this document.",
      });
      onNotesSaved(document.id, notes);
      onClose();
    } catch (error: any) {
      console.error('Error saving notes:', error);
      toast({
        title: "Error saving notes",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!document) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Document Notes</DialogTitle>
          <DialogDescription>
            Add notes or observations for <strong>{document.title || document.document_type}</strong>. 
            These notes will be analyzed by the Audit Assistant.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="E.g., Document looks valid, but page 2 is slightly blurry..."
            className="min-h-[150px] resize-y"
          />
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Save Notes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
