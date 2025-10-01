import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Building2, Search, Send, Plus, Eye, Users, ArrowLeft, UserPlus } from 'lucide-react';
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

const SupplierDiscovery = () => {
  const { currentBranch, allBranchesView } = useBranchContext();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState<any[]>([]);
  const [selectedIndustry, setSelectedIndustry] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [buyerProfile, setBuyerProfile] = useState<any>(null);
  const [connections, setConnections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showIndustrySetup, setShowIndustrySetup] = useState(false);
  const [showConnectionRequests, setShowConnectionRequests] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [showSupplierDetail, setShowSupplierDetail] = useState(false);
  const [currentView, setCurrentView] = useState<'suppliers' | 'branches' | 'onboarding'>('suppliers');
  const { user } = useAuth();
  const { getBuyerProfile } = useBuyerSetup();
  const { toast } = useToast();

  console.log('Valid industries:', VALID_INDUSTRIES);
  console.log('Selected industry:', selectedIndustry);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, currentBranch, allBranchesView]);

  const fetchData = async () => {
    console.log('Fetching supplier discovery data...');
    setLoading(true);
    try {
      // Get buyer profile
      const buyer = await getBuyerProfile();
      console.log('Buyer profile:', buyer);
      setBuyerProfile(buyer);

      // Fetch existing connections if buyer profile exists
      if (buyer) {
        let connectionsQuery = supabase
          .from('buyer_supplier_connections')
          .select('*')
          .eq('buyer_id', buyer.id);

        // Filter by branch if not viewing all branches
        if (!allBranchesView && currentBranch) {
          connectionsQuery = connectionsQuery.eq('branch_id', currentBranch.id);
        }

        const { data: connectionsData, error: connectionsError } = await connectionsQuery;

        if (connectionsError) {
          console.error('Error fetching connections:', connectionsError);
        }

        if (connectionsData) {
          console.log('Connections found:', connectionsData);
          setConnections(connectionsData);
          
          // If no connections exist, show industry setup
          if (connectionsData.length === 0) {
            console.log('No connections found, showing industry setup');
            setShowIndustrySetup(true);
          }
        } else {
          console.log('No connections data, showing industry setup');
          setShowIndustrySetup(true);
        }
      }

      // Fetch all suppliers
      const { data: suppliersData, error: suppliersError } = await supabase
        .from('suppliers')
        .select('*')
        .order('company_name');

      if (suppliersError) {
        console.error('Error fetching suppliers:', suppliersError);
      }

      if (suppliersData) {
        console.log('Suppliers found:', suppliersData.length);
        setSuppliers(suppliersData);
        setFilteredSuppliers(suppliersData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let filtered = suppliers;

    if (selectedIndustry && selectedIndustry !== 'all') {
      filtered = filtered.filter(supplier => supplier.industry === selectedIndustry);
    }

    if (searchTerm) {
      filtered = filtered.filter(supplier =>
        supplier.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        supplier.industry?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredSuppliers(filtered);
  }, [suppliers, selectedIndustry, searchTerm]);

  const sendConnectionRequest = async (supplierId: string) => {
    if (!buyerProfile) {
      toast({
        title: "Setup Required",
        description: "Please complete your buyer profile first.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('buyer_supplier_connections')
        .insert({
          buyer_id: buyerProfile.id,
          supplier_id: supplierId,
          status: 'pending'
        });

      if (error) throw error;

      // Create notification for supplier
      const supplier = suppliers.find(s => s.id === supplierId);
      if (supplier) {
        await supabase.rpc('create_notification', {
          p_user_id: supplier.profile_id,
          p_title: 'New Connection Request',
          p_message: `${buyerProfile.company_name} wants to connect with you as a buyer.`,
          p_type: 'connection_request',
          p_reference_id: supplierId
        });
      }

      toast({
        title: "Request Sent",
        description: "Connection request sent to supplier.",
      });

      fetchData(); // Refresh data
    } catch (error: any) {
      console.error('Error sending connection request:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getConnectionStatus = (supplierId: string) => {
    const connection = connections.find(c => c.supplier_id === supplierId);
    return connection?.status || null;
  };

  const getConnectionDate = (supplierId: string) => {
    const connection = connections.find(c => c.supplier_id === supplierId);
    return connection?.requested_at || null;
  };

  const handleIndustrySetupComplete = () => {
    console.log('Industry setup completed, refreshing data...');
    setShowIndustrySetup(false);
    fetchData(); // Refresh data to show new connections
  };

  const handleIndustryChange = (value: string) => {
    const safeValue = createSafeSelectValue(value, 'all');
    console.log('Industry filter changed to:', safeValue);
    setSelectedIndustry(safeValue);
  };

  const handleViewSupplier = (supplier: any) => {
    setSelectedSupplier(supplier);
    setShowSupplierDetail(true);
  };

  const categorizeSuppliers = () => {
    const connected = filteredSuppliers.filter(s => getConnectionStatus(s.id) === 'approved');
    const sent = filteredSuppliers.filter(s => getConnectionStatus(s.id) === 'pending');
    const rejected = filteredSuppliers.filter(s => getConnectionStatus(s.id) === 'rejected');
    const notConnected = filteredSuppliers.filter(s => !getConnectionStatus(s.id));

    return { connected, sent, rejected, notConnected };
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading suppliers...</p>
        </CardContent>
      </Card>
    );
  }

  if (!buyerProfile) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Complete Your Buyer Profile</h3>
          <p className="text-gray-600">Please set up your buyer profile to discover and connect with suppliers.</p>
        </CardContent>
      </Card>
    );
  }

  // Show industry-based setup if no connections exist
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

  const { connected, sent, rejected, notConnected } = categorizeSuppliers();

  // Handle view switching
  if (currentView === 'branches') {
    return (
      <div className="space-y-6">
        {/* Header with Back Button */}
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

        {/* Branch Supplier Dashboard */}
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
      {/* Header with Action Buttons */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground">Manage your supplier connections and discover new suppliers</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setShowConnectionRequests(true)}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Users className="w-4 h-4" />
            Connection Requests
          </Button>
          <Button
            variant="outline"
            className="flex items-center gap-2"
            onClick={() => setCurrentView('onboarding')}
          >
            <UserPlus className="w-4 h-4" />
            Quick Onboarding
          </Button>
          <Button
            variant="outline"
            className="flex items-center gap-2"
            onClick={() => setCurrentView('branches')}
          >
            <Building2 className="w-4 h-4" />
            Branch Suppliers
          </Button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <Label htmlFor="search">Search Suppliers</Label>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              id="search"
              placeholder="Search by company name or industry..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="industry">Filter by Industry</Label>
          <SafeSelect 
            value={selectedIndustry} 
            onValueChange={handleIndustryChange}
            placeholder="All Industries"
            className="w-48"
          >
            <SafeSelectItem value="all">All Industries</SafeSelectItem>
            {VALID_INDUSTRIES.map((industry) => (
              <SafeSelectItem key={industry} value={industry}>
                {industry}
              </SafeSelectItem>
            ))}
          </SafeSelect>
        </div>
      </div>

      {/* Supplier Categories */}
      <div className="space-y-8">
        {/* Connected Suppliers */}
        {connected.length > 0 && (
          <SupplierSection
            title="Connected Suppliers"
            subtitle={`${connected.length} active connections`}
            suppliers={connected}
            status="approved"
            onViewSupplier={handleViewSupplier}
            onSendRequest={sendConnectionRequest}
            getConnectionStatus={getConnectionStatus}
          />
        )}

        {/* Sent Requests */}
        {sent.length > 0 && (
          <SupplierSection
            title="Sent Requests"
            subtitle={`${sent.length} pending requests`}
            suppliers={sent}
            status="pending"
            onViewSupplier={handleViewSupplier}
            onSendRequest={sendConnectionRequest}
            getConnectionStatus={getConnectionStatus}
          />
        )}

        {/* Rejected Requests */}
        {rejected.length > 0 && (
          <SupplierSection
            title="Rejected Requests"
            subtitle={`${rejected.length} rejected connections`}
            suppliers={rejected}
            status="rejected"
            onViewSupplier={handleViewSupplier}
            onSendRequest={sendConnectionRequest}
            getConnectionStatus={getConnectionStatus}
          />
        )}

        {/* Not Connected */}
        {notConnected.length > 0 && (
          <SupplierSection
            title="Available Suppliers"
            subtitle={`${notConnected.length} suppliers available to connect`}
            suppliers={notConnected}
            status={null}
            onViewSupplier={handleViewSupplier}
            onSendRequest={sendConnectionRequest}
            getConnectionStatus={getConnectionStatus}
          />
        )}

        {/* Empty State */}
        {filteredSuppliers.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Suppliers Found</h3>
              <p className="text-muted-foreground mb-4">
                Try adjusting your search criteria or check back later for new suppliers.
              </p>
              <Button 
                variant="outline" 
                onClick={() => setShowIndustrySetup(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add First Suppliers
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modals */}
      {showConnectionRequests && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Connection Requests</h3>
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
  onSendRequest: (supplierId: string) => void;
  getConnectionStatus: (supplierId: string) => string | null;
}

const SupplierSection: React.FC<SupplierSectionProps> = ({
  title,
  subtitle,
  suppliers,
  status,
          onViewSupplier,
          onSendRequest,
          getConnectionStatus
        }) => {
  const handleQuickInvite = async (supplier: any) => {
    try {
      // Create onboarding request with defaults for this supplier
      const { useOnboardingRequests } = await import('@/hooks/useOnboardingRequests');
      // This would be implemented properly with context or state management
      toast.success(`Quick invite sent to ${supplier.company_name}!`);
    } catch (error) {
      console.error('Error sending quick invite:', error);
    }
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'approved':
        return 'border-l-green-500 bg-green-50/30';
      case 'pending':
        return 'border-l-yellow-500 bg-yellow-50/30';
      case 'rejected':
        return 'border-l-red-500 bg-red-50/30';
      default:
        return 'border-l-blue-500 bg-blue-50/30';
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Connected</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Sent</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Rejected</Badge>;
      default:
        return <Badge variant="outline">Not Connected</Badge>;
    }
  };

  return (
    <Card className={`border-l-4 ${getStatusColor(status)}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">{title}</CardTitle>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          {getStatusBadge(status)}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {suppliers.map((supplier) => (
            <div
              key={supplier.id}
              className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{supplier.company_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {supplier.industry} • {supplier.contact_email}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onViewSupplier(supplier)}
                >
                  <Eye className="w-4 h-4 mr-1" />
                  View
                </Button>
                {!getConnectionStatus(supplier.id) && (
                  <Button
                    size="sm"
                    onClick={() => onSendRequest(supplier.id)}
                  >
                    <Send className="w-4 h-4 mr-1" />
                    Connect
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default SupplierDiscovery;
