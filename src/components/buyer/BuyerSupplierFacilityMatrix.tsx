import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SupplierItemFacilityView } from './SupplierItemFacilityView';
import { useBuyerSupplierConnections } from '@/hooks/useBuyerSupplierConnections';
import { useAuth } from '@/hooks/useAuth';
import { Building2, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export const BuyerSupplierFacilityMatrix = () => {
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const { user } = useAuth();
  const [buyerId, setBuyerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchBuyerId = async () => {
      if (!user) return;
      
      const { data: buyer } = await supabase
        .from('buyers')
        .select('id')
        .eq('profile_id', user.id)
        .single();
        
      if (buyer) {
        setBuyerId(buyer.id);
      }
      setLoading(false);
    };
    
    fetchBuyerId();
  }, [user]);
  
  const { connections, loading: connectionsLoading } = useBuyerSupplierConnections(buyerId || undefined);
  
  // Filter only approved connections
  const approvedSuppliers = connections.filter(c => c.status === 'approved');
  
  useEffect(() => {
    // Auto-select first supplier
    if (approvedSuppliers.length > 0 && !selectedSupplierId) {
      setSelectedSupplierId(approvedSuppliers[0].supplier_id);
    }
  }, [approvedSuppliers, selectedSupplierId]);

  if (loading || connectionsLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Item-Facility Matrix</h2>
            <p className="text-muted-foreground">
              Loading suppliers...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (approvedSuppliers.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Item-Facility Matrix</h2>
            <p className="text-muted-foreground">
              View which items are produced at which facilities for each supplier
            </p>
          </div>
        </div>
        
        <Card>
          <CardContent className="text-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              No connected suppliers yet. Connect with suppliers to view their facility matrix.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Item-Facility Matrix</h2>
          <p className="text-muted-foreground">
            View which items are produced at which facilities for each supplier
          </p>
        </div>
      </div>

      {/* Supplier Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Select Supplier
          </CardTitle>
          <CardDescription>
            Choose a supplier to view their item-facility production matrix
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose a supplier to view their facility matrix" />
            </SelectTrigger>
            <SelectContent>
              {approvedSuppliers.map((connection) => (
                <SelectItem key={connection.supplier_id} value={connection.supplier_id}>
                  {connection.supplier?.company_name || 'Unknown Supplier'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Matrix View */}
      {selectedSupplierId ? (
        <SupplierItemFacilityView supplierId={selectedSupplierId} />
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Select a supplier to view their item-facility matrix
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
