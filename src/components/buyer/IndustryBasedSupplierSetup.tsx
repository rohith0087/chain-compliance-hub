import { useState, useEffect } from 'react';
import logger from '@/utils/logger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Building2, Users, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { VALID_INDUSTRIES } from '@/config/industries';

interface Supplier {
  id: string;
  company_name: string;
  industry: string;
  contact_email: string;
  auto_approve_connections: boolean;
  description?: string;
  phone?: string;
  address?: string;
  profile_id: string;
}

interface IndustryBasedSupplierSetupProps {
  buyerProfile: any;
  onComplete: () => void;
}

const IndustryBasedSupplierSetup = ({ buyerProfile, onComplete }: IndustryBasedSupplierSetupProps) => {
  const [selectedIndustry, setSelectedIndustry] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  logger.debug('IndustryBasedSupplierSetup - Valid industries:', VALID_INDUSTRIES);

  useEffect(() => {
    if (selectedIndustry) {
      fetchSuppliers();
    }
  }, [selectedIndustry]);

  const fetchSuppliers = async () => {
    if (!selectedIndustry) return;
    
    logger.debug('Fetching suppliers for industry:', selectedIndustry);
    setLoading(true);
    try {
      const { data: suppliersData, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('industry', selectedIndustry)
        .order('company_name');

      if (error) {
        console.error('Error fetching suppliers:', error);
        throw error;
      }

      logger.debug('Suppliers found for industry:', suppliersData?.length || 0);
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

  const handleConnectSuppliers = async () => {
    if (selectedSuppliers.length === 0) {
      toast({
        title: "No Suppliers Selected",
        description: "Please select at least one supplier to connect with.",
        variant: "destructive",
      });
      return;
    }

    logger.debug('Connecting with suppliers:', selectedSuppliers);
    setSubmitting(true);

    try {
      // Create connection requests for selected suppliers
      const connectionPromises = selectedSuppliers.map(async (supplierId) => {
        const supplier = suppliers.find(s => s.id === supplierId);
        
        logger.debug('Creating connection for supplier:', supplier?.company_name);
        
        // Insert connection record
        const { error: connectionError } = await supabase
          .from('buyer_supplier_connections')
          .insert({
            buyer_id: buyerProfile.id,
            supplier_id: supplierId,
            status: supplier?.auto_approve_connections ? 'approved' : 'pending'
          });

        if (connectionError) {
          console.error('Error creating connection:', connectionError);
          throw connectionError;
        }

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

      const approvedCount = selectedSuppliers.filter(id => 
        suppliers.find(s => s.id === id)?.auto_approve_connections
      ).length;
      const pendingCount = selectedSuppliers.length - approvedCount;

      toast({
        title: "Success",
        description: `Connected with ${selectedSuppliers.length} supplier(s). ${approvedCount} approved automatically, ${pendingCount} pending approval.`,
      });

      logger.debug('Connections created successfully');
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Hey! You don't have any suppliers in your network yet
          </CardTitle>
          <p className="text-sm text-gray-600">
            Let's fix that! Select an industry below to discover and connect with relevant suppliers for your business needs.
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="industry">Select Industry</Label>
              <Select value={selectedIndustry} onValueChange={setSelectedIndustry}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an industry to explore suppliers" />
                </SelectTrigger>
                <SelectContent>
                  {VALID_INDUSTRIES.map((industry) => (
                    <SelectItem key={industry} value={industry}>
                      {industry}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {loading && (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                Loading suppliers in {selectedIndustry}...
              </div>
            )}

            {selectedIndustry && !loading && suppliers.length === 0 && (
              <Card>
                <CardContent className="p-6 text-center">
                  <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Suppliers Found</h3>
                  <p className="text-gray-600">
                    There are currently no suppliers in the {selectedIndustry} industry.
                  </p>
                </CardContent>
              </Card>
            )}

            {suppliers.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Available Suppliers in {selectedIndustry}
                </h3>
                <div className="grid md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
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
                              <p className="text-sm text-gray-600">{supplier.contact_email}</p>
                              {supplier.phone && (
                                <p className="text-sm text-gray-600">{supplier.phone}</p>
                              )}
                            </div>
                          </div>
                          <Badge variant={supplier.auto_approve_connections ? "default" : "secondary"}>
                            {supplier.auto_approve_connections ? "Auto-Approve" : "Requires Approval"}
                          </Badge>
                        </div>
                      </CardHeader>
                      {(supplier.description || supplier.address) && (
                        <CardContent>
                          {supplier.description && (
                            <p className="text-sm text-gray-600 mb-2">{supplier.description}</p>
                          )}
                          {supplier.address && (
                            <p className="text-sm text-gray-500">{supplier.address}</p>
                          )}
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>

                <div className="flex gap-3 pt-4">
                  <Button 
                    onClick={handleConnectSuppliers} 
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
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default IndustryBasedSupplierSetup;
