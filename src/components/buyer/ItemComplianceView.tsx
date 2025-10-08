import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { AlertTriangle, CheckCircle, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import DocumentCard from '@/components/documents/DocumentCard';
import { ITEM_CATEGORIES } from '@/hooks/useSupplierItems';

interface ItemComplianceViewProps {
  buyerId: string;
}

const ItemComplianceView = ({ buyerId }: ItemComplianceViewProps) => {
  const [allItems, setAllItems] = useState<any[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [linkedDocuments, setLinkedDocuments] = useState<any[]>([]);
  const [generalDocuments, setGeneralDocuments] = useState<any[]>([]);
  const [missingDocs, setMissingDocs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [facilityFilter, setFacilityFilter] = useState<string>('all');
  const [facilities, setFacilities] = useState<any[]>([]);

  useEffect(() => {
    fetchSupplierItems();
  }, [buyerId]);

  useEffect(() => {
    if (selectedItemId) {
      fetchDocumentsForItem();
    }
  }, [selectedItemId]);

  const fetchSupplierItems = async () => {
    const { data: connections } = await supabase
      .from('buyer_supplier_connections')
      .select('supplier_id')
      .eq('buyer_id', buyerId)
      .eq('status', 'approved');

    if (!connections) return;

    const supplierIds = connections.map(c => c.supplier_id);

    const { data: items } = await supabase
      .from('supplier_items')
      .select(`
        *,
        suppliers!inner(company_name)
      `)
      .in('supplier_id', supplierIds)
      .order('item_category', { ascending: true })
      .order('item_name', { ascending: true });

    setAllItems(items || []);
  };

  const fetchDocumentsForItem = async () => {
    setLoading(true);
    
    // Fetch facilities for the selected item
    const selectedItem = allItems.find(i => i.id === selectedItemId);
    if (selectedItem) {
      const { data: facilityData } = await supabase
        .from('company_branches')
        .select('*')
        .eq('company_id', selectedItem.supplier_id)
        .eq('company_type', 'supplier');
      setFacilities(facilityData || []);
    }
    
    let linkedQuery = supabase
      .from('document_uploads')
      .select(`
        *,
        document_requests!inner(
          title,
          document_type,
          category,
          buyer_id,
          suppliers(company_name)
        )
      `)
      .eq('document_requests.buyer_id', buyerId)
      .contains('linked_item_ids', [selectedItemId]);
    
    // Apply facility filter if selected
    if (facilityFilter !== 'all') {
      linkedQuery = linkedQuery.contains('linked_facility_ids', [facilityFilter]);
    }
    
    const { data: linked } = await linkedQuery;

    const { data: general } = await supabase
      .from('document_uploads')
      .select(`
        *,
        document_requests!inner(
          title,
          document_type,
          category,
          buyer_id,
          suppliers(company_name)
        )
      `)
      .eq('document_requests.buyer_id', buyerId)
      .is('linked_item_ids', null);

    setLinkedDocuments(linked || []);
    setGeneralDocuments(general || []);
    
    const requiredDocs = ['COA', 'Safety Data Sheet', 'Origin Certificate'];
    const existingTypes = (linked || []).map(d => d.document_requests?.document_type);
    const missing = requiredDocs.filter(req => !existingTypes.includes(req));
    setMissingDocs(missing);
    
    setLoading(false);
  };

  const getCategoryIcon = (category: string) => {
    const categoryItem = ITEM_CATEGORIES.find(c => c.value === category);
    return categoryItem?.icon || '📋';
  };

  const selectedItem = allItems.find(i => i.id === selectedItemId);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Item-Specific Compliance View</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Select Item to Review</Label>
                <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an item..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ITEM_CATEGORIES.map(category => {
                      const categoryItems = allItems.filter(i => i.item_category === category.value);
                      if (categoryItems.length === 0) return null;
                      return (
                        <div key={category.value}>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                            {category.icon} {category.label}
                          </div>
                          {categoryItems.map(item => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.item_name} ({item.suppliers?.company_name})
                            </SelectItem>
                          ))}
                        </div>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Filter by Facility</Label>
                <Select value={facilityFilter} onValueChange={(val) => { setFacilityFilter(val); fetchDocumentsForItem(); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="All facilities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Facilities</SelectItem>
                    {facilities.map(facility => (
                      <SelectItem key={facility.id} value={facility.id}>
                        {facility.branch_name} - {facility.location}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedItem && (
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="text-3xl">{getCategoryIcon(selectedItem.item_category)}</div>
                  <div>
                    <h3 className="font-medium">{selectedItem.item_name}</h3>
                    <p className="text-sm text-muted-foreground">
                      Category: {ITEM_CATEGORIES.find(c => c.value === selectedItem.item_category)?.label} | 
                      Supplier: {selectedItem.suppliers?.company_name}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedItemId && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Compliance Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-medium">Linked Documents</span>
                  </div>
                  <p className="text-2xl font-bold text-green-600 mt-2">{linkedDocuments.length}</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-medium">General Documents</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-600 mt-2">{generalDocuments.length}</p>
                </div>
                <div className="p-4 bg-orange-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-600" />
                    <span className="text-sm font-medium">Missing Documents</span>
                  </div>
                  <p className="text-2xl font-bold text-orange-600 mt-2">{missingDocs.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {missingDocs.length > 0 && (
            <Card className="border-orange-200 bg-orange-50">
              <CardHeader>
                <CardTitle className="text-orange-800">Missing Compliance Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {missingDocs.map((doc, idx) => (
                    <li key={idx} className="text-sm text-orange-700">• {doc}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Documents Linked to {selectedItem?.item_name}</CardTitle>
            </CardHeader>
            <CardContent>
              {linkedDocuments.length === 0 ? (
                <p className="text-muted-foreground text-sm">No documents specifically linked to this item yet.</p>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {linkedDocuments.map(doc => (
                    <DocumentCard key={doc.id} document={{
                      ...doc,
                      title: doc.document_requests?.title,
                      document_type: doc.document_requests?.document_type,
                      category: doc.document_requests?.category,
                      supplier: doc.document_requests?.suppliers
                    }} userRole="buyer" />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>General Supplier Documents (Not Item-Specific)</CardTitle>
            </CardHeader>
            <CardContent>
              {generalDocuments.length === 0 ? (
                <p className="text-muted-foreground text-sm">No general documents available.</p>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {generalDocuments.slice(0, 5).map(doc => (
                    <DocumentCard key={doc.id} document={{
                      ...doc,
                      title: doc.document_requests?.title,
                      document_type: doc.document_requests?.document_type,
                      category: doc.document_requests?.category,
                      supplier: doc.document_requests?.suppliers
                    }} userRole="buyer" />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default ItemComplianceView;
