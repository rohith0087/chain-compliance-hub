import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface ConnectWithBuyerModalProps {
  onConnectionRequest: () => void;
}

export const ConnectWithBuyerModal = ({ onConnectionRequest }: ConnectWithBuyerModalProps) => {
  const [buyerId, setBuyerId] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!buyerId.trim()) {
      toast.error('Please enter a buyer ID');
      return;
    }

    if (!user) {
      toast.error('You must be logged in');
      return;
    }

    setIsLoading(true);

    try {
      // Call the database function to create connection
      const { data, error } = await supabase.rpc('create_supplier_to_buyer_connection', {
        p_buyer_id_number: buyerId.trim(),
        p_supplier_profile_id: user.id,
        p_notes: notes.trim() || null
      });

      if (error) {
        console.error('Error creating connection:', error);
        throw error;
      }

      // Check the result from the function
      const result = data as { success: boolean; error?: string; message?: string };
      if (result && !result.success) {
        toast.error(result.error || 'Failed to create connection request');
        return;
      }

      toast.success(result?.message || 'Connection request sent successfully!');
      
      // Reset form and close modal
      setBuyerId('');
      setNotes('');
      setIsOpen(false);
      
      // Notify parent to refresh data
      onConnectionRequest();
      
    } catch (error: any) {
      console.error('Error in handleSubmit:', error);
      toast.error(error.message || 'Failed to send connection request');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="mb-4">
          <Plus className="h-4 w-4 mr-2" />
          Connect with Buyer
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Connect with Buyer</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="buyerId">Buyer ID</Label>
            <Input
              id="buyerId"
              placeholder="Enter buyer ID (e.g., BUY-1234-5678)"
              value={buyerId}
              onChange={(e) => setBuyerId(e.target.value)}
              disabled={isLoading}
              className="font-mono"
            />
            <p className="text-sm text-muted-foreground">
              Enter the unique buyer identification number provided by the buyer
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add a note to introduce yourself or explain your interest..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isLoading}
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !buyerId.trim()}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send Request
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};