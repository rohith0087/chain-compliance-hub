import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Building2, 
  ArrowLeft, 
  MapPin, 
  Search, 
  ChevronDown,
  Check,
  Users
} from 'lucide-react';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCompanyBranches } from '@/hooks/useCompanyBranches';
import { useCompanyUserRole } from '@/hooks/useCompanyUserRole';
import { useBuyerSupplierConnections } from '@/hooks/useBuyerSupplierConnections';
import { useBranchSupplierConnections } from '@/hooks/useBranchSupplierConnections';
import { toast } from 'sonner';

interface BranchSupplierDashboardProps {
  buyerId: string;
  currentUserRole?: string;
  onBack?: () => void;
}

interface BranchCardProps {
  branch: {
    id: string;
    branch_name: string;
    location?: string | null;
    address?: string | null;
  };
  buyerId: string;
  isAdmin: boolean;
  connectedSuppliers: Array<{ id: string; company_name: string }>;
}

const BranchCard: React.FC<BranchCardProps> = ({ 
  branch, 
  buyerId, 
  isAdmin, 
  connectedSuppliers 
}) => {
  const { 
    connections, 
    loading,
    assignSupplierToBranch, 
    removeSupplierFromBranch,
    refetch
  } = useBranchSupplierConnections(branch.id);

  const assignedSupplierIds = useMemo(() => 
    new Set(connections.map(c => c.supplier_id)),
    [connections]
  );

  const handleToggleSupplier = async (supplierId: string, isCurrentlyAssigned: boolean) => {
    if (isCurrentlyAssigned) {
      const connection = connections.find(c => c.supplier_id === supplierId);
      if (connection) {
        const success = await removeSupplierFromBranch(connection.id);
        if (success) {
          toast.success('Supplier removed from branch');
        }
      }
    } else {
      const success = await assignSupplierToBranch(supplierId);
      if (success) {
        toast.success('Supplier assigned to branch');
      }
    }
  };

  const supplierCount = connections.length;

  return (
    <Card className="group hover:shadow-md transition-all duration-200 border-border/50 hover:border-primary/30">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground truncate">
                {branch.branch_name}
              </h3>
              {(branch.location || branch.address) && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{branch.location || branch.address}</span>
                </div>
              )}
            </div>
          </div>
          <Badge 
            variant="secondary" 
            className="flex items-center gap-1 bg-primary/10 text-primary border-0"
          >
            <Users className="h-3 w-3" />
            {loading ? '...' : supplierCount}
          </Badge>
        </div>

        {isAdmin ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                className="w-full justify-between hover:bg-accent"
                disabled={loading}
              >
                <span>Manage Suppliers</span>
                <ChevronDown className="h-4 w-4 ml-2 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64 max-h-80 overflow-y-auto" align="start">
              {connectedSuppliers.length === 0 ? (
                <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                  No connected suppliers available.
                  <br />
                  <span className="text-xs">Connect with suppliers first in Discovery.</span>
                </div>
              ) : (
                <>
                  <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                    Toggle to assign/unassign suppliers
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {connectedSuppliers.map((supplier) => {
                    const isAssigned = assignedSupplierIds.has(supplier.id);
                    return (
                      <DropdownMenuCheckboxItem
                        key={supplier.id}
                        checked={isAssigned}
                        onCheckedChange={() => handleToggleSupplier(supplier.id, isAssigned)}
                        className="cursor-pointer"
                      >
                        <span className="truncate">{supplier.company_name}</span>
                      </DropdownMenuCheckboxItem>
                    );
                  })}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="text-sm text-muted-foreground text-center py-2">
            {supplierCount === 0 ? 'No suppliers assigned' : `${supplierCount} supplier${supplierCount !== 1 ? 's' : ''} assigned`}
          </div>
        )}

        {/* Assigned suppliers preview */}
        {supplierCount > 0 && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <div className="flex flex-wrap gap-1">
              {connections.slice(0, 3).map((conn) => (
                <Badge 
                  key={conn.id} 
                  variant="outline" 
                  className="text-xs font-normal"
                >
                  {conn.supplier?.company_name}
                </Badge>
              ))}
              {supplierCount > 3 && (
                <Badge variant="outline" className="text-xs font-normal">
                  +{supplierCount - 3} more
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export const BranchSupplierDashboard: React.FC<BranchSupplierDashboardProps> = ({
  buyerId,
  currentUserRole,
  onBack
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const { branches, loading } = useCompanyBranches(buyerId, 'buyer');
  const { role: companyUserRole } = useCompanyUserRole(buyerId, 'buyer');
  const { connections: buyerSupplierConnections } = useBuyerSupplierConnections(buyerId);

  const isAdmin = companyUserRole === 'company_admin' || currentUserRole === 'admin';

  // Get all connected suppliers
  const connectedSuppliers = useMemo(() => 
    buyerSupplierConnections
      .filter(conn => conn.supplier)
      .map(conn => ({
        id: conn.supplier!.id,
        company_name: conn.supplier!.company_name
      })),
    [buyerSupplierConnections]
  );

  // Filter branches by search
  const filteredBranches = useMemo(() => {
    if (!searchQuery.trim()) return branches;
    const query = searchQuery.toLowerCase();
    return branches.filter(branch => 
      branch.branch_name.toLowerCase().includes(query) ||
      branch.location?.toLowerCase().includes(query) ||
      branch.address?.toLowerCase().includes(query)
    );
  }, [branches, searchQuery]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-8 w-8 bg-muted rounded animate-pulse" />
          <div className="h-6 bg-muted rounded w-48 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-40 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Minimal Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button 
              variant="ghost" 
              size="icon"
              onClick={onBack}
              className="h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <h1 className="text-xl font-semibold text-foreground">Branch Suppliers</h1>
            <p className="text-sm text-muted-foreground">
              Assign suppliers to specific branches
            </p>
          </div>
        </div>
        <Badge variant="outline" className="hidden sm:flex">
          {branches.length} branch{branches.length !== 1 ? 'es' : ''}
        </Badge>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search branches by name or location..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Branch Cards Grid */}
      {filteredBranches.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            {searchQuery ? (
              <>
                <h3 className="font-medium text-foreground mb-1">No branches found</h3>
                <p className="text-sm text-muted-foreground">
                  Try adjusting your search terms
                </p>
              </>
            ) : (
              <>
                <h3 className="font-medium text-foreground mb-1">No branches set up</h3>
                <p className="text-sm text-muted-foreground">
                  Add branches in Company Settings to manage supplier assignments
                </p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBranches.map((branch) => (
            <BranchCard
              key={branch.id}
              branch={branch}
              buyerId={buyerId}
              isAdmin={isAdmin}
              connectedSuppliers={connectedSuppliers}
            />
          ))}
        </div>
      )}
    </div>
  );
};
