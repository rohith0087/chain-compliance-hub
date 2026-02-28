import React, { useState } from 'react';
import logger from '@/utils/logger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Building2, MapPin, Phone, Mail, Users } from 'lucide-react';
import { useBranchSupplierConnections } from '@/hooks/useBranchSupplierConnections';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useCompanyBranches } from '@/hooks/useCompanyBranches';
import { useBuyerSupplierConnections } from '@/hooks/useBuyerSupplierConnections';

interface BranchSupplierManagementProps {
  buyerId: string;
  currentUserRole?: string;
  companyUserRole?: string;
}

export const BranchSupplierManagement: React.FC<BranchSupplierManagementProps> = ({
  buyerId,
  currentUserRole,
  companyUserRole
}) => {
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');

  const { branches } = useCompanyBranches(buyerId, 'buyer');
  const { suppliers } = useSuppliers();
  const { connections: buyerSupplierConnections } = useBuyerSupplierConnections(buyerId);
  const { 
    connections, 
    loading, 
    assignSupplierToBranch, 
    removeSupplierFromBranch 
  } = useBranchSupplierConnections(selectedBranchId);
  
  const isAdmin = companyUserRole === 'company_admin' || currentUserRole === 'admin';
  logger.debug('BranchSupplierManagement - isAdmin:', isAdmin, 'companyUserRole:', companyUserRole, 'currentUserRole:', currentUserRole);

  const handleAssignSupplier = async () => {
    if (!selectedSupplierId) return;

    const success = await assignSupplierToBranch(selectedSupplierId, notes);
    if (success) {
      setIsAssignModalOpen(false);
      setSelectedSupplierId('');
      setNotes('');
    }
  };

  const handleRemoveSupplier = async (connectionId: string) => {
    if (window.confirm('Are you sure you want to remove this supplier from the branch?')) {
      await removeSupplierFromBranch(connectionId);
    }
  };

  // Get connected suppliers that are not yet assigned to the selected branch
  const connectedSuppliers = buyerSupplierConnections
    .map(conn => conn.supplier)
    .filter(supplier => supplier && !connections.some(conn => conn.supplier_id === supplier.id));

  // Get all suppliers that are not yet assigned to the selected branch (including non-connected ones)
  const availableSuppliers = suppliers.filter(supplier => 
    !connections.some(conn => conn.supplier_id === supplier.id)
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6 space-y-6">
          {/* Branch Selector */}
          <div className="space-y-3">
            <Label htmlFor="branch-select" className="text-base font-medium">
              Select a branch to manage its suppliers
            </Label>
            <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
              <SelectTrigger id="branch-select" className="w-full">
                <SelectValue placeholder="Choose a branch..." />
              </SelectTrigger>
              <SelectContent>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.branch_name} {branch.location && `- ${branch.location}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedBranchId && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Connected Suppliers</h3>
                {isAdmin && (
                  <div className="space-y-2">
                    {connectedSuppliers.length > 0 && (
                      <div className="p-3 border rounded-lg bg-blue-50 border-blue-200">
                        <div className="flex items-center gap-2 mb-2">
                          <Users className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-medium text-blue-900">Quick Assign Connected Suppliers</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {connectedSuppliers.map((supplier) => (
                            <Button
                              key={supplier.id}
                              variant="outline"
                              size="sm"
                              onClick={() => assignSupplierToBranch(supplier.id, 'Assigned from connected suppliers')}
                              className="text-xs border-blue-200 hover:bg-blue-100"
                            >
                              + {supplier.company_name}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
                      <DialogTrigger asChild>
                        <Button>
                          <Plus className="h-4 w-4 mr-2" />
                          Assign Supplier
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Assign Supplier to Branch</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="supplier-select">Select Supplier</Label>
                            <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                              <SelectTrigger id="supplier-select">
                                <SelectValue placeholder="Choose a supplier" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableSuppliers.map((supplier) => (
                                  <SelectItem key={supplier.id} value={supplier.id}>
                                    {supplier.company_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="notes">Notes (Optional)</Label>
                            <Textarea
                              id="notes"
                              value={notes}
                              onChange={(e) => setNotes(e.target.value)}
                              placeholder="Add any notes about this assignment..."
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="outline" 
                              onClick={() => setIsAssignModalOpen(false)}
                            >
                              Cancel
                            </Button>
                            <Button 
                              onClick={handleAssignSupplier}
                              disabled={!selectedSupplierId}
                            >
                              Assign Supplier
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                )}
              </div>

              {loading ? (
                <div className="text-center py-4">Loading suppliers...</div>
              ) : connections.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No suppliers assigned to this branch yet.
                </div>
              ) : (
                <div className="grid gap-4">
                  {connections.map((connection) => (
                    <Card key={connection.id} className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium">
                              {connection.supplier?.company_name}
                            </h4>
                            <Badge variant="secondary">{connection.status}</Badge>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                            {connection.supplier?.contact_email && (
                              <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4" />
                                {connection.supplier.contact_email}
                              </div>
                            )}
                            {connection.supplier?.phone && (
                              <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4" />
                                {connection.supplier.phone}
                              </div>
                            )}
                            {connection.supplier?.industry && (
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4" />
                                {connection.supplier.industry}
                              </div>
                            )}
                            {connection.supplier?.address && (
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4" />
                                {connection.supplier.address}
                              </div>
                            )}
                          </div>
                          
                          {connection.notes && (
                            <div className="mt-2 p-2 bg-muted rounded text-sm">
                              <strong>Notes:</strong> {connection.notes}
                            </div>
                          )}
                          
                          <div className="mt-2 text-xs text-muted-foreground">
                            Assigned: {new Date(connection.assigned_at).toLocaleDateString()}
                          </div>
                        </div>
                        
                        {isAdmin && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveSupplier(connection.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};