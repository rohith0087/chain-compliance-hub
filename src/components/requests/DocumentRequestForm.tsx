
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DocumentRequestFormProps {
  isOpen: boolean;
  onClose: () => void;
}

const DocumentRequestForm = ({ isOpen, onClose }: DocumentRequestFormProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [dueDate, setDueDate] = useState<Date>();
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [connectedSuppliers, setConnectedSuppliers] = useState<any[]>([]);
  const [availableBranches, setAvailableBranches] = useState<any[]>([]);
  const [buyerProfile, setBuyerProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && user) {
      fetchBuyerData();
    }
  }, [isOpen, user]);

  const fetchBuyerData = async () => {
    try {
      // Get buyer profile
      const { data: buyer } = await supabase
        .from('buyers')
        .select('*')
        .eq('profile_id', user?.id)
        .single();

      if (buyer) {
        setBuyerProfile(buyer);

        // Get connected suppliers
        const { data: connections } = await supabase
          .from('buyer_supplier_connections')
          .select(`
            *,
            suppliers (*)
          `)
          .eq('buyer_id', buyer.id)
          .eq('status', 'approved');

        if (connections) {
          setConnectedSuppliers(connections.map(conn => conn.suppliers));
        }

        // Get available branches for this buyer company
        const { data: branches } = await supabase
          .from('company_branches')
          .select('*')
          .eq('company_id', buyer.id)
          .eq('company_type', 'buyer')
          .eq('status', 'active')
          .order('branch_name');

        if (branches) {
          setAvailableBranches(branches);
          // Set default branch if available
          if (branches.length > 0) {
            const mainBranch = branches.find(b => b.branch_name === 'Main Office') || branches[0];
            setSelectedBranch(mainBranch.id);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching buyer data:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !buyerProfile) return;

    setLoading(true);

    try {
      // Create the document request
      const { data: request, error } = await supabase
        .from('document_requests')
        .insert({
          title,
          description,
          document_type: documentType,
          category,
          priority,
          due_date: dueDate?.toISOString().split('T')[0],
          supplier_id: selectedSupplier,
          buyer_id: buyerProfile.id,
          branch_id: selectedBranch,
          requester_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Create notification for supplier
      const supplier = connectedSuppliers.find(s => s.id === selectedSupplier);
      if (supplier) {
        await supabase.rpc('create_notification', {
          p_user_id: supplier.profile_id,
          p_title: 'New Document Request',
          p_message: `You have received a new document request: ${title}`,
          p_type: 'request_created',
          p_reference_id: request.id
        });
      }

      toast({
        title: "Request Created",
        description: "Document request has been sent to the supplier.",
      });

      // Reset form
      setTitle('');
      setDescription('');
      setDocumentType('');
      setCategory('');
      setPriority('medium');
      setDueDate(undefined);
      setSelectedSupplier('');
      setSelectedBranch('');
      onClose();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!buyerProfile) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Setup Required</DialogTitle>
          </DialogHeader>
          <div className="text-center py-4">
            <p>Please complete your buyer profile and connect with suppliers before creating document requests.</p>
            <Button onClick={onClose} className="mt-4">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (connectedSuppliers.length === 0) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>No Connected Suppliers</DialogTitle>
          </DialogHeader>
          <div className="text-center py-4">
            <p>You need to connect with suppliers before creating document requests.</p>
            <Button onClick={onClose} className="mt-4">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Document Request</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="supplier">Supplier *</Label>
              <Select value={selectedSupplier} onValueChange={setSelectedSupplier} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {connectedSuppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="branch">Branch *</Label>
            <Select value={selectedBranch} onValueChange={setSelectedBranch} required>
              <SelectTrigger>
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent>
                {availableBranches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.branch_name} {branch.location && `- ${branch.location}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>


          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="documentType">Document Type *</Label>
              <Select value={documentType} onValueChange={setDocumentType} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="certificate">Certificate</SelectItem>
                  <SelectItem value="insurance">Insurance</SelectItem>
                  <SelectItem value="license">License</SelectItem>
                  <SelectItem value="quality_report">Quality Report</SelectItem>
                  <SelectItem value="safety_data">Safety Data Sheet</SelectItem>
                  <SelectItem value="audit_report">Audit Report</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="category">Category *</Label>
              <Select value={category} onValueChange={setCategory} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="quality">Quality</SelectItem>
                  <SelectItem value="safety">Safety</SelectItem>
                  <SelectItem value="environmental">Environmental</SelectItem>
                  <SelectItem value="financial">Financial</SelectItem>
                  <SelectItem value="legal">Legal</SelectItem>
                  <SelectItem value="operational">Operational</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select value={priority} onValueChange={(value) => setPriority(value as 'low' | 'medium' | 'high' | 'urgent')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Due Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Request"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default DocumentRequestForm;
