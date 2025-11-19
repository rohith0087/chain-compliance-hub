import { useState, useMemo } from 'react';
import { APIProvider, Map, AdvancedMarker, InfoWindow } from '@vis.gl/react-google-maps';
import { Building2, Warehouse, MapPin, Phone, Filter, Search, Store, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { demoSuppliers, demoFacilities, demoBuyerBranches } from '@/data/demoSuppliers';

interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  title: string;
  type: 'supplier' | 'facility' | 'buyer-branch';
  industry?: string;
  facilityType?: string;
  address?: string;
  email?: string;
  phone?: string;
  connectionStatus?: string;
}

const INDUSTRY_COLORS: Record<string, string> = {
  'Food Service': '#3b82f6',
  'Food & Beverage': '#3b82f6',
  'Seafood': '#06b6d4',
  'Manufacturing': '#8b5cf6',
  'Technology': '#10b981',
  'Healthcare': '#ef4444',
  'Retail': '#f59e0b',
  'Automotive': '#6366f1',
  'default': '#64748b',
};

const FACILITY_COLORS: Record<string, string> = {
  'headquarters': '#1e40af',
  'distribution': '#ea580c',
  'store': '#16a34a',
  'default': '#6366f1',
};

const BUYER_BRANCH_COLORS: Record<string, string> = {
  'headquarters': '#10b981',
  'branch': '#059669',
  'default': '#10b981',
};

function getIndustryColor(industry?: string): string {
  if (!industry) return INDUSTRY_COLORS.default;
  return INDUSTRY_COLORS[industry] || INDUSTRY_COLORS.default;
}

function getFacilityColor(facilityType?: string): string {
  if (!facilityType) return FACILITY_COLORS.default;
  return FACILITY_COLORS[facilityType as keyof typeof FACILITY_COLORS] || FACILITY_COLORS.default;
}

function getBuyerBranchColor(locationType?: string): string {
  if (!locationType) return BUYER_BRANCH_COLORS.default;
  return BUYER_BRANCH_COLORS[locationType as keyof typeof BUYER_BRANCH_COLORS] || BUYER_BRANCH_COLORS.default;
}

// Hardcoded coordinates for demo locations (approximate)
const DEMO_COORDINATES: Record<string, { lat: number; lng: number }> = {
  // HishōSushi
  'demo-hisho-sushi': { lat: 35.1167, lng: -80.9278 }, // Charlotte, NC
  'demo-hisho-hq': { lat: 35.1167, lng: -80.9278 },
  'demo-hisho-troy-mein': { lat: 31.8089, lng: -85.9633 }, // Troy, AL
  'demo-hisho-troy-sushi': { lat: 31.8089, lng: -85.9633 },
  'demo-hisho-sprouts': { lat: 33.3968, lng: -84.5957 }, // Peachtree City, GA
  
  // Blue Ocean Seafood
  'demo-blue-ocean': { lat: 47.6062, lng: -122.3321 }, // Seattle, WA
  'demo-blue-hq': { lat: 47.6062, lng: -122.3321 },
  'demo-blue-portland': { lat: 45.5152, lng: -122.6784 }, // Portland, OR
  'demo-blue-pike': { lat: 47.6097, lng: -122.3421 }, // Pike Place
  'demo-blue-wharf': { lat: 37.8087, lng: -122.4098 }, // SF Fisherman's Wharf
  
  // Atlantic Fresh
  'demo-atlantic-fresh': { lat: 42.3601, lng: -71.0589 }, // Boston, MA
  'demo-atlantic-hq': { lat: 42.3601, lng: -71.0589 },
  'demo-atlantic-newark': { lat: 40.7357, lng: -74.1724 }, // Newark, NJ
  'demo-atlantic-quincy': { lat: 42.3601, lng: -71.0545 }, // Quincy Market
  'demo-atlantic-chelsea': { lat: 40.7425, lng: -74.0064 }, // Chelsea Market, NYC
  
  // Buyer Branches
  'demo-buyer-elizabeth': { lat: 40.6640, lng: -74.2107 }, // Elizabeth, NJ (HQ)
  'demo-buyer-monticello': { lat: 41.6556, lng: -74.6893 }, // Monticello, NY
  'demo-buyer-newhampton': { lat: 43.0594, lng: -92.3168 }, // New Hampton, IA
  'demo-buyer-sherburne': { lat: 42.6784, lng: -75.4988 }, // Sherburne, NY
};

// Static demo marker data - generated from demo suppliers and facilities
const generateDemoMarkers = (): MapMarker[] => {
  const markers: MapMarker[] = [];
  
  // Add supplier HQ markers
  demoSuppliers.forEach(supplier => {
    markers.push({
      id: supplier.id,
      lat: DEMO_COORDINATES[supplier.id]?.lat || 0,
      lng: DEMO_COORDINATES[supplier.id]?.lng || 0,
      title: supplier.company_name,
      type: 'supplier',
      industry: supplier.industry,
      address: supplier.address,
      email: supplier.contact_email,
      phone: supplier.phone,
      connectionStatus: 'none'
    });
  });
  
  // Add buyer branch markers
  demoBuyerBranches.forEach(branch => {
    markers.push({
      id: branch.id,
      lat: DEMO_COORDINATES[branch.id]?.lat || 0,
      lng: DEMO_COORDINATES[branch.id]?.lng || 0,
      title: branch.branch_name,
      type: 'buyer-branch',
      facilityType: branch.location,
      address: branch.address,
      email: branch.email,
      phone: branch.phone
    });
  });
  
  // Add facility markers
  demoFacilities.forEach(facility => {
    const supplier = demoSuppliers.find(s => s.id === facility.supplier_id);
    markers.push({
      id: facility.id,
      lat: DEMO_COORDINATES[facility.id]?.lat || 0,
      lng: DEMO_COORDINATES[facility.id]?.lng || 0,
      title: facility.branch_name,
      type: 'facility',
      facilityType: facility.location,
      industry: supplier?.industry,
      address: facility.address,
      email: facility.email,
      phone: facility.phone,
      connectionStatus: 'none'
    });
  });
  
  return markers;
};

export function SupplierMap() {
  // Generate static demo markers
  const allMarkers = useMemo(() => generateDemoMarkers(), []);

  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [showSuppliers, setShowSuppliers] = useState(true);
  const [showFacilities, setShowFacilities] = useState(true);
  const [showBuyerBranches, setShowBuyerBranches] = useState(true);
  const [facilityTypeFilter, setFacilityTypeFilter] = useState<string[]>(['headquarters', 'distribution', 'store']);
  const [connectionFilter, setConnectionFilter] = useState<string[]>(['connected', 'pending', 'none']);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  // Filter markers based on user selections
  const filteredMarkers = useMemo(() => {
    return allMarkers.filter((marker) => {
      // Type filter
      if (marker.type === 'supplier' && !showSuppliers) return false;
      if (marker.type === 'facility' && !showFacilities) return false;
      if (marker.type === 'buyer-branch' && !showBuyerBranches) return false;

      // Facility type filter (only for facilities)
      if (marker.type === 'facility' && marker.facilityType) {
        if (!facilityTypeFilter.includes(marker.facilityType)) {
          return false;
        }
      }

      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = marker.title?.toLowerCase().includes(query);
        const matchesIndustry = marker.industry?.toLowerCase().includes(query);
        const matchesAddress = marker.address?.toLowerCase().includes(query);
        
        if (!matchesTitle && !matchesIndustry && !matchesAddress) {
          return false;
        }
      }

      // Connection filter (only for suppliers)
      if (marker.type === 'supplier' && connectionFilter.length > 0) {
        if (!marker.connectionStatus || !connectionFilter.includes(marker.connectionStatus)) {
          return false;
        }
      }

      return true;
    });
  }, [allMarkers, searchQuery, showSuppliers, showFacilities, showBuyerBranches, facilityTypeFilter, connectionFilter]);

  const toggleConnectionFilter = (status: string) => {
    setConnectionFilter((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
    );
  };

  const toggleFacilityType = (type: string) => {
    setFacilityTypeFilter((prev) =>
      prev.includes(type)
        ? prev.filter((t) => t !== type)
        : [...prev, type]
    );
  };

  if (!apiKey) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-destructive">Google Maps API key not configured</p>
        </CardContent>
      </Card>
    );
  }

  const FilterControls = () => (
    <>
      {/* Search */}
      <div>
        <Label>Search</Label>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search suppliers or locations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Marker Types */}
      <div>
        <Label className="mb-2 block">Show on Map</Label>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="show-suppliers"
              checked={showSuppliers}
              onCheckedChange={(checked) => setShowSuppliers(checked === true)}
            />
            <label htmlFor="show-suppliers" className="text-sm cursor-pointer">
              Suppliers (HQ)
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="show-facilities"
              checked={showFacilities}
              onCheckedChange={(checked) => setShowFacilities(checked === true)}
            />
            <label htmlFor="show-facilities" className="text-sm cursor-pointer">
              Facilities
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="show-buyer-branches"
              checked={showBuyerBranches}
              onCheckedChange={(checked) => setShowBuyerBranches(checked === true)}
            />
            <label htmlFor="show-buyer-branches" className="text-sm cursor-pointer">
              My Branches
            </label>
          </div>
        </div>
      </div>

      {/* Facility Types */}
      {showFacilities && (
        <div>
          <Label className="mb-2 block">Facility Types</Label>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="facility-hq"
                checked={facilityTypeFilter.includes('headquarters')}
                onCheckedChange={() => toggleFacilityType('headquarters')}
              />
              <Building2 className="w-4 h-4 text-blue-700" />
              <label htmlFor="facility-hq" className="text-sm cursor-pointer flex-1">
                Headquarters
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="facility-dist"
                checked={facilityTypeFilter.includes('distribution')}
                onCheckedChange={() => toggleFacilityType('distribution')}
              />
              <Truck className="w-4 h-4 text-orange-600" />
              <label htmlFor="facility-dist" className="text-sm cursor-pointer flex-1">
                Distribution Centers
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="facility-store"
                checked={facilityTypeFilter.includes('store')}
                onCheckedChange={() => toggleFacilityType('store')}
              />
              <Store className="w-4 h-4 text-green-600" />
              <label htmlFor="facility-store" className="text-sm cursor-pointer flex-1">
                Stores
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Connection Status */}
      {showSuppliers && (
        <div>
          <Label className="mb-2 block">Connection Status</Label>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="status-connected"
                checked={connectionFilter.includes('connected')}
                onCheckedChange={() => toggleConnectionFilter('connected')}
              />
              <label htmlFor="status-connected" className="text-sm cursor-pointer">
                Connected
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="status-pending"
                checked={connectionFilter.includes('pending')}
                onCheckedChange={() => toggleConnectionFilter('pending')}
              />
              <label htmlFor="status-pending" className="text-sm cursor-pointer">
                Pending
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="status-none"
                checked={connectionFilter.includes('none')}
                onCheckedChange={() => toggleConnectionFilter('none')}
              />
              <label htmlFor="status-none" className="text-sm cursor-pointer">
                Not Connected
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Clear Filters */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setSearchQuery('');
          setShowSuppliers(true);
          setShowFacilities(true);
          setFacilityTypeFilter(['headquarters', 'distribution', 'store']);
          setConnectionFilter(['connected', 'pending', 'none']);
        }}
        className="w-full"
      >
        Clear All Filters
      </Button>
    </>
  );

  return (
    <div className="relative h-[calc(100vh-120px)]">
      {/* Filter Panel - Desktop */}
      <Card className="absolute top-4 left-4 z-10 w-80 max-h-[calc(100vh-160px)] overflow-y-auto hidden lg:block">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FilterControls />
        </CardContent>
      </Card>

      {/* Filter Panel - Mobile */}
      <Sheet>
        <SheetTrigger asChild>
          <Button className="absolute top-4 left-4 z-10 lg:hidden" size="icon">
            <Filter className="w-4 h-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-80 overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            <FilterControls />
          </div>
        </SheetContent>
      </Sheet>

      {/* Results Count */}
      <Card className="absolute top-4 right-4 z-10">
        <CardContent className="p-3">
          <p className="text-sm font-medium">
            Showing {filteredMarkers.length} of {allMarkers.length} locations
          </p>
        </CardContent>
      </Card>

      {/* Map */}
      <APIProvider apiKey={apiKey}>
        <Map
          defaultCenter={{ lat: 39.8283, lng: -98.5795 }}
          defaultZoom={4}
          mapId="supplier-map"
          style={{ width: '100%', height: '100%' }}
        >
          {/* Render markers */}
          {filteredMarkers.map((marker) => (
            <AdvancedMarker
              key={marker.id}
              position={{ lat: marker.lat, lng: marker.lng }}
              onClick={() => setSelectedMarker(marker)}
            >
              <div className="relative">
                {marker.type === 'supplier' ? (
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg cursor-pointer"
                    style={{ backgroundColor: getIndustryColor(marker.industry) }}
                  >
                    <Building2 className="w-6 h-6 text-white" />
                  </div>
                ) : marker.type === 'buyer-branch' ? (
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg cursor-pointer ring-2 ring-white"
                    style={{ backgroundColor: getBuyerBranchColor(marker.facilityType) }}
                  >
                    {marker.facilityType === 'headquarters' ? (
                      <Building2 className="w-6 h-6 text-white" />
                    ) : (
                      <MapPin className="w-6 h-6 text-white" />
                    )}
                  </div>
                ) : (
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shadow-lg cursor-pointer"
                    style={{ backgroundColor: getFacilityColor(marker.facilityType) }}
                  >
                    {marker.facilityType === 'headquarters' && <Building2 className="w-4 h-4 text-white" />}
                    {marker.facilityType === 'distribution' && <Truck className="w-4 h-4 text-white" />}
                    {marker.facilityType === 'store' && <Store className="w-4 h-4 text-white" />}
                    {!marker.facilityType && <Warehouse className="w-4 h-4 text-white" />}
                  </div>
                )}
              </div>
            </AdvancedMarker>
          ))}

          {/* Info Window */}
          {selectedMarker && (
            <InfoWindow
              position={{ lat: selectedMarker.lat, lng: selectedMarker.lng }}
              onCloseClick={() => setSelectedMarker(null)}
            >
              <div className="p-2 max-w-xs">
                <h3 className="font-semibold text-base mb-2">{selectedMarker.title}</h3>
                
                {selectedMarker.industry && (
                  <Badge variant="secondary" className="mb-2">
                    {selectedMarker.industry}
                  </Badge>
                )}
                
                {selectedMarker.type === 'buyer-branch' && (
                  <Badge className="mb-2 bg-emerald-600 hover:bg-emerald-700">
                    Your Branch
                  </Badge>
                )}
                
                {selectedMarker.facilityType && (
                  <Badge variant="outline" className="mb-2 ml-2">
                    {selectedMarker.facilityType === 'headquarters' && 'HQ'}
                    {selectedMarker.facilityType === 'distribution' && 'Distribution'}
                    {selectedMarker.facilityType === 'store' && 'Store'}
                    {selectedMarker.facilityType === 'branch' && 'Branch'}
                  </Badge>
                )}

                <div className="space-y-1 text-sm">
                  {selectedMarker.address && (
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <span>{selectedMarker.address}</span>
                    </div>
                  )}
                  {selectedMarker.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span>{selectedMarker.phone}</span>
                    </div>
                  )}
                </div>
              </div>
            </InfoWindow>
          )}
        </Map>
      </APIProvider>

      {/* Legend */}
      <Card className="absolute bottom-4 left-4 z-10">
        <CardContent className="p-3">
          <div className="text-xs font-semibold mb-2">Map Legend</div>
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-blue-700"></div>
              <span>Supplier HQ</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-orange-600"></div>
              <span>Distribution</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-green-600"></div>
              <span>Store</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-emerald-500"></div>
              <span>Your HQ</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-emerald-600"></div>
              <span>Your Branch</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
