
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Building2, Users, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Supplier {
  id: string;
  company_name: string;
  industry: string;
  contact_email: string;
  auto_approve_connections: boolean;
  description?: string;
  profile_id: string;
}

interface SupplierSelectionProps {
  selectedIndustry: string;
  buyerProfile: any;
  onComplete: () => void;
}

const SupplierSelection = ({ selectedIndustry, buyerProfile, onComplete }: SupplierSelectionProps) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchSuppliers();
  }, [selectedIndustry]);

  const fetchSuppliers = async () => {
    try {
      const { data: suppliersData, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('industry', selectedIndustry)
        .order('company_name');

      if (error) throw error;

      setSuppliers(suppliersData || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      toast({
        title: "Error",
        description: "Failed to load suppliers.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSupplierToggle = (supplierId: string) => {
    setSelectedSuppliers(prev => 
      prev.includes(supplierId) 
        ? prev.filter(id => id !== supplierId)
        : [...prev, supplierId]
    );
  };

  const handleSubmit = async () => {
    if (selectedSuppliers.length === 0) {
      toast({
        title: "No Suppliers Selected",
        description: "Please select at least one supplier to connect with.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      // Create connection requests for selected suppliers
      const connectionPromises = selectedSuppliers.map(async (supplierId) => {
        const supplier = suppliers.find(s => s.id === supplierId);
        
        // Insert connection record
        const { error: connectionError } = await supabase
          .from('buyer_supplier_connections')
          .insert({
            buyer_id: buyerProfile.id,
            supplier_id: supplierId,
            status: supplier?.auto_approve_connections ? 'approved' : 'pending'
          });

        if (connectionError) throw connectionError;

        // Create notification for supplier if approval is required
        if (!supplier?.auto_approve_connections) {
          await supabase.rpc('create_notification', {
            p_user_id: supplier?.profile_id,
            p_title: 'New Connection Request',
            p_message: `${buyerProfile.company_name} wants to connect with you as a buyer.`,
            p_type: 'connection_request',
            p_reference_id: supplierId
          });
        }
      });

      await Promise.all(connectionPromises);

      toast({
        title: "Success",
        description: `Connected with ${selectedSuppliers.length} supplier(s). ${selectedSuppliers.filter(id => !suppliers.find(s => s.id === id)?.auto_approve_connections).length} requests are pending approval.`,
      });

      onComplete();
    } catch (error: any) {
      console.error('Error creating connections:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading suppliers in {selectedIndustry}...</div>;
  }

  if (suppliers.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Building2 className="w-12 h-12 text-muted-foreground/70 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Suppliers Found</h3>
          <p className="text-muted-foreground mb-4">
            There are currently no suppliers in the {selectedIndustry} industry.
          </p>
          <Button onClick={onComplete}>Continue Without Connections</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Select Suppliers to Connect With
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Choose suppliers in the {selectedIndustry} industry that you'd like to connect with. 
            Some may require approval while others will connect automatically.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            {suppliers.map((supplier) => (
              <Card key={supplier.id} className="relative">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id={supplier.id}
                        checked={selectedSuppliers.includes(supplier.id)}
                        onCheckedChange={() => handleSupplierToggle(supplier.id)}
                      />
                      <div>
                        <label htmlFor={supplier.id} className="font-semibold cursor-pointer">
                          {supplier.company_name}
                        </label>
                        <p className="text-sm text-muted-foreground">{supplier.contact_email}</p>
                      </div>
                    </div>
                    <Badge variant={supplier.auto_approve_connections ? "default" : "secondary"}>
                      {supplier.auto_approve_connections ? "Auto-Approve" : "Requires Approval"}
                    </Badge>
                  </div>
                </CardHeader>
                {supplier.description && (
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{supplier.description}</p>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>

          <div className="flex gap-3 mt-6">
            <Button 
              onClick={handleSubmit} 
              disabled={submitting || selectedSuppliers.length === 0}
              className="flex-1"
            >
              <Send className="w-4 h-4 mr-2" />
              {submitting ? "Connecting..." : `Connect with ${selectedSuppliers.length} Supplier(s)`}
            </Button>
            <Button variant="outline" onClick={onComplete}>
              Skip for Now
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SupplierSelection;
