
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
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState<Date>();
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchSuppliers();
    }
  }, [isOpen]);

  const fetchSuppliers = async () => {
    const { data } = await supabase
      .from('suppliers')
      .select('*');
    
    if (data) {
      setSuppliers(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

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
          requester_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Create notification for supplier
      const supplier = suppliers.find(s => s.id === selectedSupplier);
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
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
              <Select value={priority} onValueChange={setPriority}>
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
