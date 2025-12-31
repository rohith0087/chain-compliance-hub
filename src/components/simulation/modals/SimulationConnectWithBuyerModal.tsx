import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Building2, Search, Send } from 'lucide-react';
import { useSimulation } from '@/contexts/SimulationContext';

export const SimulationConnectWithBuyerModal = () => {
  const { showConnectModal, setShowConnectModal, sendConnectionRequest, getAvailableBuyers } = useSimulation();
  const [buyerId, setBuyerId] = useState('');
  const [notes, setNotes] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  const availableBuyers = getAvailableBuyers();
  const filteredBuyers = availableBuyers.filter(b => 
    b.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = () => {
    if (!buyerId) return;
    sendConnectionRequest(buyerId, notes);
    setBuyerId('');
    setNotes('');
    setSearchTerm('');
  };

  const selectBuyer = (id: string) => {
    setBuyerId(id);
    setSearchTerm('');
  };

  return (
    <Dialog open={showConnectModal} onOpenChange={setShowConnectModal}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Connect with a Buyer
          </DialogTitle>
          <DialogDescription>
            Enter the buyer's ID or search for a buyer to send a connection request.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="buyerId">Buyer ID</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="buyerId"
                placeholder="Enter Buyer ID (e.g., BUY-FRESH-2024)"
                value={buyerId || searchTerm}
                onChange={(e) => {
                  if (buyerId) setBuyerId('');
                  setSearchTerm(e.target.value);
                }}
                className="pl-9"
              />
            </div>
            
            {/* Demo Buyers List */}
            {searchTerm && !buyerId && (
              <div className="border rounded-lg p-2 space-y-1 max-h-40 overflow-auto">
                <p className="text-xs text-muted-foreground px-2">Demo Buyers (click to select):</p>
                {filteredBuyers.map(buyer => (
                  <button
                    key={buyer.id}
                    onClick={() => selectBuyer(buyer.id)}
                    className="w-full text-left p-2 rounded hover:bg-muted transition-colors"
                  >
                    <p className="font-medium text-sm">{buyer.company_name}</p>
                    <p className="text-xs text-muted-foreground">{buyer.id} • {buyer.city}, {buyer.state}</p>
                  </button>
                ))}
              </div>
            )}
            
            {buyerId && (
              <Badge variant="secondary" className="gap-1">
                Selected: {availableBuyers.find(b => b.id === buyerId)?.company_name}
              </Badge>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add a message to introduce your company..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setShowConnectModal(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!buyerId} className="gap-2">
            <Send className="h-4 w-4" />
            Send Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
