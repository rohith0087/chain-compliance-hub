import { useState } from 'react';
import { Package, Plus, Edit2, Trash2, Copy, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useDocumentSets, DocumentSet } from '@/hooks/useDocumentSets';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { getComplianceDocuments } from '@/components/requests/ComplianceDocuments';

interface DocumentSetManagerProps {
  buyerId: string;
}

export function DocumentSetManager({ buyerId }: DocumentSetManagerProps) {
  const { documentSets, deleteSet, updateSet, duplicateSet, isDeleting } = useDocumentSets(buyerId);
  const [editingSet, setEditingSet] = useState<DocumentSet | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ set_name: '', description: '' });

  const handleEdit = (set: DocumentSet) => {
    setEditingSet(set);
    setFormData({ set_name: set.set_name, description: set.description || '' });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingSet) return;
    updateSet({
      id: editingSet.id,
      updates: formData,
    });
    setIsEditDialogOpen(false);
    setEditingSet(null);
  };

  const getDocumentNames = (documentIds: string[]) => {
    // Get all compliance documents (using 'Auditor' as default, as it has the most comprehensive list)
    const allDocs = getComplianceDocuments('Auditor');
    return documentIds
      .map(id => allDocs.find(doc => doc.id === id)?.title)
      .filter(Boolean)
      .slice(0, 3);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Document Sets</h2>
          <p className="text-muted-foreground">
            Manage your reusable document collections
          </p>
        </div>
      </div>

      {documentSets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No document sets yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create document sets from the "New Request" page by selecting documents and clicking "Save as Set"
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {documentSets.map((set) => (
            <Card key={set.id} className="group hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{set.set_name}</CardTitle>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-background border-border">
                      <DropdownMenuItem onClick={() => handleEdit(set)}>
                        <Edit2 className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => duplicateSet(set.id)}>
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => deleteSet(set.id)}
                        disabled={isDeleting}
                        className="text-danger"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <CardDescription className="line-clamp-2">
                  {set.description || 'No description'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span>{set.document_ids.length} documents</span>
                  {set.is_default && (
                    <Badge variant="outline" className="ml-auto">Default</Badge>
                  )}
                </div>

                <div className="space-y-1">
                  {getDocumentNames(set.document_ids).map((name, idx) => (
                    <div key={idx} className="text-sm text-muted-foreground flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      {name}
                    </div>
                  ))}
                  {set.document_ids.length > 3 && (
                    <div className="text-sm text-muted-foreground pl-3.5">
                      + {set.document_ids.length - 3} more...
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t text-xs text-muted-foreground">
                  Used {set.usage_count} {set.usage_count === 1 ? 'time' : 'times'}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Document Set</DialogTitle>
            <DialogDescription>
              Update the name and description of your document set
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="set_name">Set Name</Label>
              <Input
                id="set_name"
                value={formData.set_name}
                onChange={(e) => setFormData({ ...formData, set_name: e.target.value })}
                placeholder="e.g., Food Safety Package"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe what this set is used for..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={!formData.set_name.trim()}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
