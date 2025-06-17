import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Building2, Search, Send, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useBuyerSetup } from '@/hooks/useBuyerSetup';
import { VALID_INDUSTRIES } from '@/config/industries';
import { SafeSelect, SafeSelectItem } from '@/components/ui/SafeSelect';
import { createSafeSelectValue } from '@/utils/selectValidation';
import IndustryBasedSupplierSetup from './IndustryBasedSupplierSetup';

const SupplierDiscovery = () => {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState<any[]>([]);
  const [selectedIndustry, setSelectedIndustry] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [buyerProfile, setBuyerProfile] = useState<any>(null);
  const [connections, setConnections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showIndustrySetup, setShowIndustrySetup] = useState(false);
  const { user } = useAuth();
  const { getBuyerProfile } = useBuyerSetup();
  const { toast } = useToast();

  console.log('Valid industries:', VALID_INDUSTRIES);
  console.log('Selected industry:', selectedIndustry);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

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
        const { data: connectionsData, error: connectionsError } = await supabase
          .from('buyer_supplier_connections')
          .select('*')
          .eq('buyer_id', buyer.id);

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

  return (
    <div className="space-y-6">
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

      {connections.length === 0 && (
        <Card>
          <CardContent className="p-4 text-center">
            <Plus className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <p className="text-gray-600 mb-2">
              You don't have any supplier connections yet! 
            </p>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowIndustrySetup(true)}
            >
              Add Your First Suppliers
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSuppliers.map((supplier) => {
          const connectionStatus = getConnectionStatus(supplier.id);
          
          return (
            <Card key={supplier.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{supplier.company_name}</CardTitle>
                    <p className="text-sm text-gray-600">{supplier.industry}</p>
                  </div>
                  {connectionStatus && (
                    <Badge variant={connectionStatus === 'approved' ? 'default' : 'secondary'}>
                      {connectionStatus}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <p><strong>Contact:</strong> {supplier.contact_email}</p>
                  {supplier.phone && <p><strong>Phone:</strong> {supplier.phone}</p>}
                  {supplier.address && <p><strong>Address:</strong> {supplier.address}</p>}
                  {supplier.description && <p><strong>Description:</strong> {supplier.description}</p>}
                </div>
                
                {!connectionStatus && (
                  <Button
                    onClick={() => sendConnectionRequest(supplier.id)}
                    className="w-full mt-4"
                    size="sm"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Send Request
                  </Button>
                )}
                
                {connectionStatus === 'pending' && (
                  <Badge variant="outline" className="w-full mt-4 justify-center">
                    Request Pending
                  </Badge>
                )}
                
                {connectionStatus === 'approved' && (
                  <Badge variant="default" className="w-full mt-4 justify-center">
                    Connected
                  </Badge>
                )}
                
                {connectionStatus === 'rejected' && (
                  <Badge variant="destructive" className="w-full mt-4 justify-center">
                    Request Rejected
                  </Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredSuppliers.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center">
            <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Suppliers Found</h3>
            <p className="text-gray-600">Try adjusting your search criteria or check back later for new suppliers.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SupplierDiscovery;
