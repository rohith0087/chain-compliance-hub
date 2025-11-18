import { useState, useMemo, useEffect } from 'react';
import { APIProvider, Map, AdvancedMarker, InfoWindow } from '@vis.gl/react-google-maps';
import { Building2, Warehouse, MapPin, Phone, Filter, Search, Store, Truck, Plus } from 'lucide-react';
import { addHishōSushiData, addSeafoodSuppliers, cleanupSampleData } from '@/utils/addHishōSushiData';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useSupplierMapData, MapMarker } from '@/hooks/useSupplierMapData';
import { Skeleton } from '@/components/ui/skeleton';

const INDUSTRY_COLORS: Record<string, string> = {
  'Food Service': '#3b82f6',
  'Food & Beverage': '#3b82f6',
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

function getIndustryColor(industry?: string): string {
  if (!industry) return INDUSTRY_COLORS.default;
  return INDUSTRY_COLORS[industry] || INDUSTRY_COLORS.default;
}

function getFacilityColor(facilityType?: string): string {
  if (!facilityType) return FACILITY_COLORS.default;
  return FACILITY_COLORS[facilityType as keyof typeof FACILITY_COLORS] || FACILITY_COLORS.default;
}

export function SupplierMap() {
  const { markers, loading, error, reload } = useSupplierMapData();
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [showSuppliers, setShowSuppliers] = useState(true);
  const [showFacilities, setShowFacilities] = useState(true);
  const [facilityTypeFilter, setFacilityTypeFilter] = useState<string[]>(['headquarters', 'distribution', 'store']);
  const [connectionFilter, setConnectionFilter] = useState<string[]>(['connected', 'pending', 'none']);
  const [isAddingData, setIsAddingData] = useState(false);

  const handleAddSampleData = async () => {
    try {
      setIsAddingData(true);
      
      // Step 1: Clean up existing data
      toast.info('Cleaning old sample data...');
      await cleanupSampleData();
      
      // Step 2: Add HishōSushi data
      toast.info('Adding HishōSushi demo data...');
      const hishoResults = await addHishōSushiData();
      
      const hishoSuccessCount = hishoResults.filter(r => r.success).length;
      
      // Step 3: Add seafood suppliers
      toast.info('Adding seafood suppliers...');
      const seafoodResults = await addSeafoodSuppliers();
      
      const seafoodSuccessCount = seafoodResults.filter(r => r.success).length;
      
      const totalSuccess = hishoSuccessCount + seafoodSuccessCount;
      const totalFailed = (hishoResults.length - hishoSuccessCount) + (seafoodResults.length - seafoodSuccessCount);
      
      if (totalSuccess > 0) {
        const totalSuppliers = 3; // HishōSushi + Blue Ocean + Atlantic Fresh
        const totalFacilities = totalSuccess - totalSuppliers;
        toast.success(`Added ${totalSuppliers} suppliers with ${totalFacilities} facilities!`);
        // Reload the map data
        await reload();
      }
      
      if (totalFailed > 0) {
        toast.error(`Failed to add ${totalFailed} items`);
      }
    } catch (error) {
      console.error('Error adding sample data:', error);
      toast.error('Failed to add demo data');
    } finally {
      setIsAddingData(false);
    }
  };

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;


  // Filter markers
  const filteredMarkers = useMemo(() => {
    return markers.filter((marker) => {
      // Type filter
      if (marker.type === 'supplier' && !showSuppliers) return false;
      if (marker.type === 'facility' && !showFacilities) return false;

      // Facility type filter (only for facilities)
      if (marker.type === 'facility' && facilityTypeFilter.length > 0) {
        if (!marker.facilityType || !facilityTypeFilter.includes(marker.facilityType)) {
          return false;
        }
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = marker.name.toLowerCase().includes(query);
        const matchesAddress = marker.address.toLowerCase().includes(query);
        if (!matchesName && !matchesAddress) return false;
      }


      // Connection filter (only for suppliers)
      if (marker.type === 'supplier' && connectionFilter.length > 0) {
        if (!marker.connectionStatus || !connectionFilter.includes(marker.connectionStatus)) {
          return false;
        }
      }

      return true;
    });
  }, [markers, searchQuery, showSuppliers, showFacilities, facilityTypeFilter, connectionFilter]);


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

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-destructive mb-4">Error loading map data: {error}</p>
          <Button onClick={handleAddSampleData} disabled={isAddingData}>
            <Plus className="w-4 h-4 mr-2" />
            {isAddingData ? 'Loading...' : 'Load HishōSushi Demo Data'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const showAddDataButton = markers.length === 0;

  return (
    <div className="relative h-[calc(100vh-120px)]">
      {showAddDataButton && (
        <Card className="absolute top-4 right-4 z-20">
          <CardContent className="p-4">
          <p className="text-sm text-muted-foreground mb-2">No supplier data available</p>
            <Button onClick={handleAddSampleData} disabled={isAddingData} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              {isAddingData ? 'Loading...' : 'Load HishōSushi Demo Data'}
            </Button>
          </CardContent>
        </Card>
      )}
      {/* Filter Panel - Desktop */}
      <Card className="absolute top-4 left-4 z-10 w-80 max-h-[calc(100vh-160px)] overflow-y-auto hidden lg:block">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
          <div className="space-y-2">
            <Label>Show on Map</Label>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-suppliers"
                checked={showSuppliers}
                onCheckedChange={(checked) => setShowSuppliers(checked === true)}
              />
              <label htmlFor="show-suppliers" className="text-sm cursor-pointer">
                Supplier HQs ({markers.filter((m) => m.type === 'supplier').length})
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-facilities"
                checked={showFacilities}
                onCheckedChange={(checked) => setShowFacilities(checked === true)}
              />
              <label htmlFor="show-facilities" className="text-sm cursor-pointer">
                Facilities ({markers.filter((m) => m.type === 'facility').length})
              </label>
            </div>
          </div>

          {/* Facility Types */}
          {showFacilities && (
            <div className="space-y-2">
              <Label>Facility Type</Label>
              {[
                { value: 'headquarters', label: 'Corporate HQ', icon: Building2 },
                { value: 'distribution', label: 'Distribution Center', icon: Truck },
                { value: 'store', label: 'Stores', icon: Store }
              ].map(({ value, label, icon: Icon }) => (
                <div key={value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`facility-${value}`}
                    checked={facilityTypeFilter.includes(value)}
                    onCheckedChange={() => toggleFacilityType(value)}
                  />
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow-sm"
                      style={{ backgroundColor: getFacilityColor(value) }}
                    >
                      <Icon className="w-3 h-3 text-white" />
                    </div>
                    <label htmlFor={`facility-${value}`} className="text-sm cursor-pointer">
                      {label}
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Connection Status */}
          <div className="space-y-2">
            <Label>Connection Status</Label>
            {['connected', 'pending', 'none'].map((status) => (
              <div key={status} className="flex items-center space-x-2">
                <Checkbox
                  id={`status-${status}`}
                  checked={connectionFilter.includes(status)}
                  onCheckedChange={() => toggleConnectionFilter(status)}
                />
                <label htmlFor={`status-${status}`} className="text-sm cursor-pointer capitalize">
                  {status === 'none' ? 'Not Connected' : status}
                </label>
              </div>
            ))}
          </div>


          {/* Clear All */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearchQuery('');
              setFacilityTypeFilter(['headquarters', 'distribution', 'store']);
              setConnectionFilter(['connected', 'pending', 'none']);
            }}
            className="w-full"
          >
            Clear All Filters
          </Button>
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
          {/* Same filter content as desktop */}
        </SheetContent>
      </Sheet>

      {/* Results Count */}
      <Card className="absolute top-4 right-4 z-10">
        <CardContent className="p-3">
          <p className="text-sm font-medium">
            Showing {filteredMarkers.length} of {markers.length} locations
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
          gestureHandling="greedy"
        >
          {filteredMarkers.map((marker) => (
            <AdvancedMarker
              key={marker.id}
              position={{ lat: marker.lat, lng: marker.lng }}
              onClick={() => setSelectedMarker(marker)}
            >
              <div className="relative cursor-pointer hover:scale-110 transition-transform">
                {marker.type === 'supplier' ? (
                  <>
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg border-2 border-white"
                      style={{ backgroundColor: getIndustryColor(marker.industry) }}
                    >
                      <Building2 className="w-6 h-6 text-white" />
                    </div>
                    {marker.facilityCount && marker.facilityCount > 0 && (
                      <Badge className="absolute -top-2 -right-2 w-5 h-5 p-0 flex items-center justify-center text-xs">
                        {marker.facilityCount}
                      </Badge>
                    )}
                  </>
                ) : (
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center shadow-md border-2 border-white"
                    style={{ backgroundColor: getFacilityColor(marker.facilityType) }}
                  >
                    {marker.facilityType === 'headquarters' && <Building2 className="w-5 h-5 text-white" />}
                    {marker.facilityType === 'distribution' && <Truck className="w-5 h-5 text-white" />}
                    {marker.facilityType === 'store' && <Store className="w-5 h-5 text-white" />}
                    {!marker.facilityType && <Warehouse className="w-5 h-5 text-white" />}
                  </div>
                )}
              </div>
            </AdvancedMarker>
          ))}

          {selectedMarker && (
            <InfoWindow
              position={{ lat: selectedMarker.lat, lng: selectedMarker.lng }}
              onCloseClick={() => setSelectedMarker(null)}
            >
              <Card className="w-80 border-0 shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    {selectedMarker.type === 'supplier' ? (
                      <Building2 className="w-5 h-5" />
                    ) : selectedMarker.facilityType === 'headquarters' ? (
                      <Building2 className="w-5 h-5" />
                    ) : selectedMarker.facilityType === 'distribution' ? (
                      <Truck className="w-5 h-5" />
                    ) : selectedMarker.facilityType === 'store' ? (
                      <Store className="w-5 h-5" />
                    ) : (
                      <Warehouse className="w-5 h-5" />
                    )}
                    {selectedMarker.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {selectedMarker.industry && (
                      <Badge style={{ backgroundColor: getIndustryColor(selectedMarker.industry) }}>
                        {selectedMarker.industry}
                      </Badge>
                    )}
                    {selectedMarker.facilityType && (
                      <Badge style={{ backgroundColor: getFacilityColor(selectedMarker.facilityType) }}>
                        {selectedMarker.facilityType === 'headquarters' && 'Corporate HQ'}
                        {selectedMarker.facilityType === 'distribution' && 'Distribution Center'}
                        {selectedMarker.facilityType === 'store' && 'Store'}
                      </Badge>
                    )}
                    {selectedMarker.connectionStatus && (
                      <Badge variant={
                        selectedMarker.connectionStatus === 'connected' ? 'default' :
                        selectedMarker.connectionStatus === 'pending' ? 'secondary' : 'outline'
                      }>
                        {selectedMarker.connectionStatus === 'none' ? 'Not Connected' : selectedMarker.connectionStatus}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-muted-foreground">{selectedMarker.address}</span>
                  </div>
                  {selectedMarker.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{selectedMarker.phone}</span>
                    </div>
                  )}
                  {selectedMarker.facilityCount !== undefined && selectedMarker.facilityCount > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {selectedMarker.facilityCount} {selectedMarker.facilityCount === 1 ? 'facility' : 'facilities'}
                    </p>
                  )}
                </CardContent>
              </Card>
            </InfoWindow>
          )}
        </Map>
      </APIProvider>

      {/* Legend */}
      <Card className="absolute bottom-4 right-4 z-10">
        <CardContent className="p-3 space-y-2">
          <h3 className="font-semibold text-sm mb-2">Legend</h3>
          <div className="flex items-center gap-2 text-sm">
            <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center border-2 border-white shadow">
              <Building2 className="w-4 h-4 text-primary-foreground" />
            </div>
            <span>Supplier HQ</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div 
              className="w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow"
              style={{ backgroundColor: FACILITY_COLORS.headquarters }}
            >
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <span>Corporate HQ</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div 
              className="w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow"
              style={{ backgroundColor: FACILITY_COLORS.distribution }}
            >
              <Truck className="w-4 h-4 text-white" />
            </div>
            <span>Distribution</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div 
              className="w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow"
              style={{ backgroundColor: FACILITY_COLORS.store }}
            >
              <Store className="w-4 h-4 text-white" />
            </div>
            <span>Store</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
