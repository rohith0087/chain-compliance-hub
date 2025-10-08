import { useState } from 'react';
import { useSupplierItems, ITEM_CATEGORIES } from '@/hooks/useSupplierItems';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, Plus, Edit, Trash2, Search, Building2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ItemFacilityManager } from './ItemFacilityManager';

interface ItemManagementDashboardProps {
  supplierId: string;
}

export const ItemManagementDashboard = ({ supplierId }: ItemManagementDashboardProps) => {
  const { t } = useTranslation();
  const { items, loading, createItem, updateItem, deleteItem, getItemsByCategory } = useSupplierItems(supplierId);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  
  const [formData, setFormData] = useState({
    item_name: '',
    item_category: '',
    description: '',
  });

  const handleOpenDialog = (item?: any) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        item_name: item.item_name,
        item_category: item.item_category,
        description: item.description || '',
      });
    } else {
      setEditingItem(null);
      setFormData({
        item_name: '',
        item_category: '',
        description: '',
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    try {
      if (editingItem) {
        await updateItem(editingItem.id, formData);
      } else {
        await createItem(formData);
      }
      setIsDialogOpen(false);
      setFormData({ item_name: '', item_category: '', description: '' });
    } catch (error) {
      console.error('Error saving item:', error);
    }
  };

  const handleDelete = async (itemId: string) => {
    if (confirm('Are you sure you want to delete this item?')) {
      await deleteItem(itemId);
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.item_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || item.item_category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const groupedItems = getItemsByCategory();
  const categoriesToDisplay = categoryFilter === 'all' 
    ? Object.keys(groupedItems)
    : [categoryFilter];

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading items...</div>;
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="items">
        <TabsList>
          <TabsTrigger value="items">
            <Package className="h-4 w-4 mr-2" />
            Items
          </TabsTrigger>
          <TabsTrigger value="facilities">
            <Building2 className="h-4 w-4 mr-2" />
            Facility Assignments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="items">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Item Management
              </CardTitle>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </CardHeader>
            <CardContent>
          <div className="flex gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {ITEM_CATEGORIES.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.icon} {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filteredItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No items found</p>
            </div>
          ) : (
            <div className="space-y-6">
              {categoriesToDisplay.map(category => {
                const categoryItems = categoryFilter === 'all' 
                  ? groupedItems[category] 
                  : filteredItems.filter(i => i.item_category === category);
                
                if (!categoryItems || categoryItems.length === 0) return null;

                const categoryInfo = ITEM_CATEGORIES.find(c => c.value === category);
                
                return (
                  <div key={category}>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <span className="text-2xl">{categoryInfo?.icon}</span>
                      {categoryInfo?.label} ({categoryItems.length})
                    </h3>
                    <div className="space-y-2">
                      {categoryItems.map(item => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex-1">
                            <div className="font-medium">{item.item_name}</div>
                            {item.description && (
                              <div className="text-sm text-muted-foreground">{item.description}</div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenDialog(item)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(item.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="facilities">
          <ItemFacilityManager />
        </TabsContent>
      </Tabs>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Item' : 'Add New Item'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="item_name">Item Name *</Label>
              <Input
                id="item_name"
                value={formData.item_name}
                onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                placeholder="e.g., Atlantic Salmon"
              />
            </div>
            <div>
              <Label htmlFor="item_category">Category *</Label>
              <Select 
                value={formData.item_category} 
                onValueChange={(value) => setFormData({ ...formData, item_category: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {ITEM_CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.icon} {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={!formData.item_name || !formData.item_category}
            >
              {editingItem ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
