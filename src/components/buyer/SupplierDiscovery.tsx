import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Building2, Search, ArrowLeft, Mail, Phone, MapPin, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { toast } from 'sonner';
import { useBuyerSetup } from '@/hooks/useBuyerSetup';
import { VALID_INDUSTRIES } from '@/config/industries';
import { SafeSelect, SafeSelectItem } from '@/components/ui/SafeSelect';
import { createSafeSelectValue } from '@/utils/selectValidation';
import IndustryBasedSupplierSetup from './IndustryBasedSupplierSetup';
import BuyerConnectionRequests from './BuyerConnectionRequests';
import { SupplierDetailModal } from './SupplierDetailModal';
import { BranchSupplierDashboard } from './BranchSupplierDashboard';
import { SupplierOnboarding } from './SupplierOnboarding';
import { useBranchContext } from '@/contexts/BranchContext';
import { CompactBuyerHeader } from './CompactBuyerHeader';
import { InviteSupplierModal } from './InviteSupplierModal';

const SupplierDiscovery = () => {
  const { currentBranch, allBranchesView } = useBranchContext();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState<any[]>([]);
  const [selectedIndustry, setSelectedIndustry] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItemCategory, setSelectedItemCategory] = useState('all');
  const [buyerProfile, setBuyerProfile] = useState<any>(null);
  const [connections, setConnections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showIndustrySetup, setShowIndustrySetup] = useState(false);
  const [showConnectionRequests, setShowConnectionRequests] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [showSupplierDetail, setShowSupplierDetail] = useState(false);
  const [currentView, setCurrentView] = useState<'suppliers' | 'branches' | 'onboarding'>('suppliers');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [pendingConnectionsCount, setPendingConnectionsCount] = useState(0);
  const { user } = useAuth();
  const { getBuyerProfile } = useBuyerSetup();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, currentBranch, allBranchesView]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const buyer = await getBuyerProfile();
      setBuyerProfile(buyer);

      if (buyer) {
        let connectionsQuery = supabase
          .from('branch_supplier_connections')
          .select(`
            *,
            suppliers (
              id,
              company_name,
              contact_email,
              industry,
              phone,
              address,
              description,
              supplier_items (
                id,
                item_name,
                item_category
              )
            )
          `)
          .eq('buyer_id', buyer.id)
          .eq('status', 'active');

        if (!allBranchesView && currentBranch) {
          connectionsQuery = connectionsQuery.eq('branch_id', currentBranch.id);
        }

        const { data: connectionsData, error: connectionsError } = await connectionsQuery;

        if (connectionsError) {
          console.error('Error fetching connections:', connectionsError);
        }

        if (connectionsData) {
          setConnections(connectionsData);
          
          const suppliers = connectionsData
            .map(c => c.suppliers)
            .filter(s => s !== null);
          
          setSuppliers(suppliers);
        }

        // Fetch pending connection requests count
        const { count } = await supabase
          .from('buyer_supplier_connections')
          .select('*', { count: 'exact', head: true })
          .eq('buyer_id', buyer.id)
          .eq('status', 'pending');
        
        setPendingConnectionsCount(count || 0);
      }
    } catch (error: any) {
      console.error('Error in fetchData:', error);
      toast({
        title: "Error loading data",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let filtered = suppliers;

    if (selectedIndustry !== 'all') {
      filtered = filtered.filter(s => s.industry === selectedIndustry);
    }

    if (selectedItemCategory !== 'all') {
      filtered = filtered.filter(s => 
        s.supplier_items?.some((item: any) => item.item_category === selectedItemCategory)
      );
    }

    if (searchTerm) {
      filtered = filtered.filter(s =>
        s.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.industry?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredSuppliers(filtered);
  }, [selectedIndustry, selectedItemCategory, searchTerm, suppliers]);

  const handleIndustrySetupComplete = () => {
    setShowIndustrySetup(false);
    fetchData();
  };

  const handleIndustryChange = (value: string) => {
    const safeValue = createSafeSelectValue(value, 'all');
    setSelectedIndustry(safeValue);
  };

  const handleViewSupplier = (supplier: any) => {
    setSelectedSupplier(supplier);
    setShowSupplierDetail(true);
  };

  const getConnectionStatus = (supplierId: string) => {
    const connection = connections.find(c => c.supplier_id === supplierId);
    return connection?.status === 'active' ? 'approved' : connection?.status || null;
  };

  const getConnectionDate = (supplierId: string) => {
    const connection = connections.find(c => c.supplier_id === supplierId);
    return connection?.assigned_at || null;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading suppliers...</p>
        </CardContent>
      </Card>
    );
  }

  if (!buyerProfile) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Complete Your Buyer Profile</h3>
          <p className="text-muted-foreground">Please set up your buyer profile to discover and connect with suppliers.</p>
        </CardContent>
      </Card>
    );
  }

  if (showIndustrySetup) {
    return (
      <div className="space-y-6">
        <IndustryBasedSupplierSetup 
          buyerProfile={buyerProfile}
          onComplete={handleIndustrySetupComplete}
        />
        <div className="text-center">
          <Button 
            variant="outline" 
            onClick={() => setShowIndustrySetup(false)}
          >
            Browse All Suppliers Instead
          </Button>
        </div>
      </div>
    );
  }

  if (currentView === 'branches') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => setCurrentView('suppliers')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Suppliers
            </Button>
            <div>
              <h2 className="text-2xl font-semibold">Branch Supplier Management</h2>
              <p className="text-muted-foreground">Manage supplier assignments across your company branches</p>
            </div>
          </div>
        </div>

        {buyerProfile && (
          <BranchSupplierDashboard buyerId={buyerProfile.id} />
        )}
      </div>
    );
  }

  if (currentView === 'onboarding') {
    return buyerProfile && (
      <SupplierOnboarding 
        buyerId={buyerProfile.id} 
        onBack={() => setCurrentView('suppliers')}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Compact Header with Buyer ID and Actions */}
      <CompactBuyerHeader
        buyerId={buyerProfile.id}
        pendingConnectionsCount={pendingConnectionsCount}
        onInviteClick={() => setShowInviteModal(true)}
        onConnectionsClick={() => setShowConnectionRequests(true)}
        onBranchesClick={() => setCurrentView('branches')}
        onQuickOnboardingClick={() => setCurrentView('onboarding')}
      />

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by company name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <SafeSelect 
              value={selectedIndustry} 
              onValueChange={handleIndustryChange}
              placeholder="All Industries"
            >
              <SafeSelectItem value="all">All Industries</SafeSelectItem>
              {VALID_INDUSTRIES.map((industry) => (
                <SafeSelectItem key={industry} value={industry}>
                  {industry}
                </SafeSelectItem>
              ))}
            </SafeSelect>
            <SafeSelect
              value={selectedItemCategory}
              onValueChange={(value) => setSelectedItemCategory(createSafeSelectValue(value, 'all'))}
              placeholder="All Items"
            >
              <SafeSelectItem value="all">All Items</SafeSelectItem>
              {[...new Set(suppliers.flatMap(s => s.supplier_items?.map((item: any) => item.item_category) || []))].map((category) => (
                <SafeSelectItem key={category} value={category}>
                  {category}
                </SafeSelectItem>
              ))}
            </SafeSelect>
          </div>
        </CardContent>
      </Card>

      {/* Connected Suppliers */}
      <SupplierSection
        title="Connected Suppliers"
        subtitle="Suppliers actively connected to your organization"
        suppliers={filteredSuppliers}
        status="approved"
        onViewSupplier={handleViewSupplier}
      />

      {/* Modals */}
      {showConnectionRequests && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 overflow-y-auto max-h-[80vh]">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Connection Requests</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowConnectionRequests(false)}
                >
                  ✕
                </Button>
              </div>
              <BuyerConnectionRequests />
            </div>
          </div>
        </div>
      )}

{showInviteModal && buyerProfile && user && (
        <InviteSupplierModal
          buyerId={buyerProfile.id}
          buyerProfile={buyerProfile}
          userProfile={{ full_name: user.user_metadata?.full_name || user.email || '' }}
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
        />
      )}

      <SupplierDetailModal
        supplier={selectedSupplier}
        isOpen={showSupplierDetail}
        onClose={() => setShowSupplierDetail(false)}
        connectionStatus={selectedSupplier ? getConnectionStatus(selectedSupplier.id) : undefined}
        connectionDate={selectedSupplier ? getConnectionDate(selectedSupplier.id) : undefined}
      />
    </div>
  );
};

// Supplier Section Component
interface SupplierSectionProps {
  title: string;
  subtitle: string;
  suppliers: any[];
  status: string | null;
  onViewSupplier: (supplier: any) => void;
}

const SupplierSection = ({ title, subtitle, suppliers, onViewSupplier }: SupplierSectionProps) => {
  if (suppliers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No suppliers found in this category
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
          </div>
          <Badge variant="secondary">{suppliers.length}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          {suppliers.map((supplier) => (
            <Card key={supplier.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{supplier.company_name}</h3>
                      {supplier.industry && (
                        <Badge variant="outline" className="mt-1">
                          {supplier.industry}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {supplier.contact_email && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      <span>{supplier.contact_email}</span>
                    </div>
                  )}

                  {supplier.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      <span>{supplier.phone}</span>
                    </div>
                  )}

                  {supplier.address && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span className="line-clamp-1">{supplier.address}</span>
                    </div>
                  )}

                  {supplier.supplier_items && supplier.supplier_items.length > 0 && (
                    <div className="flex items-start gap-2 text-sm">
                      <Package className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div className="flex flex-wrap gap-1">
                        {supplier.supplier_items.slice(0, 3).map((item: any) => (
                          <Badge key={item.id} variant="secondary" className="text-xs">
                            {item.item_name}
                          </Badge>
                        ))}
                        {supplier.supplier_items.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{supplier.supplier_items.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onViewSupplier(supplier)}
                      className="flex-1"
                    >
                      View Details
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default SupplierDiscovery;
