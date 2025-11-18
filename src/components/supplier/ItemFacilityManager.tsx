import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, Package, Plus, Unlink } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCompanyBranches } from '@/hooks/useCompanyBranches';
import { useSupplierItems } from '@/hooks/useSupplierItems';
import { useItemFacilityMappings } from '@/hooks/useItemFacilityMappings';
import { LinkItemToFacilityModal } from './LinkItemToFacilityModal';
import { useToast } from '@/hooks/use-toast';

interface ItemFacilityManagerProps {
  supplierId: string;
}

export const ItemFacilityManager = ({ supplierId }: ItemFacilityManagerProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [selectedFacility, setSelectedFacility] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'by-facility' | 'by-item'>('by-facility');

  const { branches, loading: branchesLoading } = useCompanyBranches('supplier');
  const { items, loading: itemsLoading } = useSupplierItems(supplierId);
  const { mappings, loading: mappingsLoading, deleteMapping } = useItemFacilityMappings(supplierId);

  const handleLinkItem = (facilityId?: string, itemId?: string) => {
    setSelectedFacility(facilityId || null);
    setSelectedItem(itemId || null);
    setLinkModalOpen(true);
  };

  const handleUnlink = async (mappingId: string) => {
    await deleteMapping(mappingId);
  };

  const getItemsForFacility = (facilityId: string) => {
    return mappings
      .filter(m => m.facility_id === facilityId)
      .map(m => ({
        ...m.item,
        mapping: m
      }));
  };

  const getFacilitiesForItem = (itemId: string) => {
    return mappings
      .filter(m => m.item_id === itemId)
      .map(m => ({
        ...m.facility,
        mapping: m
      }));
  };

  if (branchesLoading || itemsLoading || mappingsLoading) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Item-Facility Assignments</CardTitle>
          <CardDescription>
            Manage which items are produced at which facilities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="by-facility">
                <Building2 className="mr-2 h-4 w-4" />
                Items by Facility
              </TabsTrigger>
              <TabsTrigger value="by-item">
                <Package className="mr-2 h-4 w-4" />
                Facilities by Item
              </TabsTrigger>
            </TabsList>

            <TabsContent value="by-facility" className="space-y-4">
              {branches.map(facility => {
                const facilityItems = getItemsForFacility(facility.id);
                return (
                  <Card key={facility.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">{facility.branch_name}</CardTitle>
                          <CardDescription>{facility.location}</CardDescription>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleLinkItem(facility.id)}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Link Items
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {facilityItems.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No items assigned</p>
                      ) : (
                        <div className="space-y-2">
                          {facilityItems.map(item => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between p-3 border rounded-lg"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium">{item.item_name}</p>
                                  {item.mapping?.is_primary_producer && (
                                    <Badge variant="default">Primary</Badge>
                                  )}
                                </div>
                                {item.mapping?.production_capacity && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Capacity: {item.mapping.production_capacity} units
                                  </p>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleUnlink(item.mapping.id)}
                              >
                                <Unlink className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>

            <TabsContent value="by-item" className="space-y-4">
              {items.map(item => {
                const itemFacilities = getFacilitiesForItem(item.id);
                return (
                  <Card key={item.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">{item.item_name}</CardTitle>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleLinkItem(undefined, item.id)}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Link Facilities
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {itemFacilities.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No facilities assigned</p>
                      ) : (
                        <div className="space-y-2">
                          {itemFacilities.map(facility => (
                            <div
                              key={facility.id}
                              className="flex items-center justify-between p-3 border rounded-lg"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium">{facility.branch_name}</p>
                                  {facility.mapping?.is_primary_producer && (
                                    <Badge variant="default">Primary</Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {facility.location}
                                </p>
                                {facility.mapping?.lead_time_days && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Lead time: {facility.mapping.lead_time_days} days
                                  </p>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleUnlink(facility.mapping.id)}
                              >
                                <Unlink className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <LinkItemToFacilityModal
        open={linkModalOpen}
        onOpenChange={setLinkModalOpen}
        facilityId={selectedFacility}
        itemId={selectedItem}
        supplierId={items[0]?.supplier_id}
      />
    </>
  );
};
