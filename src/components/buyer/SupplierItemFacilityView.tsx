import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Building2, Package, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SupplierItemFacilityViewProps {
  supplierId: string;
}

export const SupplierItemFacilityView = ({ supplierId }: SupplierItemFacilityViewProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [mappings, setMappings] = useState<any[]>([]);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, [supplierId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Get all items for this supplier
      const { data: itemsData, error: itemsError } = await supabase
        .from('supplier_items')
        .select('*')
        .eq('supplier_id', supplierId);

      if (itemsError) throw itemsError;
      setItems(itemsData || []);

      const itemIds = itemsData?.map(i => i.id) || [];
      if (itemIds.length === 0) {
        setMappings([]);
        setFacilities([]);
        return;
      }

      // Get mappings
      const { data: mappingsData, error: mappingsError } = await supabase
        .from('item_facility_mappings')
        .select(`
          *,
          facility:company_branches(*),
          item:supplier_items(*)
        `)
        .in('item_id', itemIds);

      if (mappingsError) throw mappingsError;
      setMappings(mappingsData || []);

      // Get unique facilities
      const facilityIds = [...new Set(mappingsData?.map(m => m.facility_id) || [])];
      const { data: facilitiesData, error: facilitiesError } = await supabase
        .from('company_branches')
        .select('*')
        .in('id', facilityIds);

      if (facilitiesError) throw facilitiesError;
      setFacilities(facilitiesData || []);

    } catch (error: any) {
      console.error('Error loading data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load item-facility data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getItemsForFacility = (facilityId: string) => {
    return mappings
      .filter(m => m.facility_id === facilityId)
      .map(m => ({ ...m.item, mapping: m }));
  };

  const getFacilitiesForItem = (itemId: string) => {
    return mappings
      .filter(m => m.item_id === itemId)
      .map(m => ({ ...m.facility, mapping: m }));
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Item-Facility Matrix</CardTitle>
        <CardDescription>
          View which items are produced at which facilities
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="by-facility">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="by-facility">
              <Building2 className="mr-2 h-4 w-4" />
              By Facility
            </TabsTrigger>
            <TabsTrigger value="by-item">
              <Package className="mr-2 h-4 w-4" />
              By Item
            </TabsTrigger>
          </TabsList>

          <TabsContent value="by-facility" className="space-y-4">
            {facilities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No facility data available</p>
            ) : (
              facilities.map(facility => {
                const facilityItems = getItemsForFacility(facility.id);
                return (
                  <Card key={facility.id}>
                    <CardHeader>
                      <CardTitle className="text-lg">{facility.branch_name}</CardTitle>
                      <CardDescription className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {facility.location}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {facilityItems.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No items</p>
                      ) : (
                        <div className="space-y-2">
                          {facilityItems.map(item => (
                            <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-medium">{item.item_name}</p>
                                  {item.mapping?.is_primary_producer && (
                                    <Badge>Primary</Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">{item.category}</p>
                              </div>
                              <div className="text-right text-sm text-muted-foreground">
                                {item.mapping?.production_capacity && (
                                  <div>Capacity: {item.mapping.production_capacity}</div>
                                )}
                                {item.mapping?.lead_time_days && (
                                  <div>Lead: {item.mapping.lead_time_days}d</div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="by-item" className="space-y-4">
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No items available</p>
            ) : (
              items.map(item => {
                const itemFacilities = getFacilitiesForItem(item.id);
                return (
                  <Card key={item.id}>
                    <CardHeader>
                      <CardTitle className="text-lg">{item.item_name}</CardTitle>
                      <CardDescription>{item.category}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {itemFacilities.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No facilities assigned</p>
                      ) : (
                        <div className="space-y-2">
                          {itemFacilities.map(facility => (
                            <div key={facility.id} className="flex items-center justify-between p-3 border rounded-lg">
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-medium">{facility.branch_name}</p>
                                  {facility.mapping?.is_primary_producer && (
                                    <Badge>Primary</Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {facility.location}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
