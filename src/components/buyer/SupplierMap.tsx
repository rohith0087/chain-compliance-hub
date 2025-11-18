import { useState, useMemo } from 'react';
import { APIProvider, Map, AdvancedMarker, InfoWindow } from '@vis.gl/react-google-maps';
import { Building2, Warehouse, MapPin, Phone, Filter, Search } from 'lucide-react';
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
  'Food & Beverage': '#3b82f6',
  'Manufacturing': '#8b5cf6',
  'Technology': '#10b981',
  'Healthcare': '#ef4444',
  'Retail': '#f59e0b',
  'Automotive': '#6366f1',
  'default': '#64748b',
};

function getIndustryColor(industry?: string): string {
  if (!industry) return INDUSTRY_COLORS.default;
  return INDUSTRY_COLORS[industry] || INDUSTRY_COLORS.default;
}

export function SupplierMap() {
  const { markers, loading, error } = useSupplierMapData();
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [showSuppliers, setShowSuppliers] = useState(true);
  const [showFacilities, setShowFacilities] = useState(true);
  const [connectionFilter, setConnectionFilter] = useState<string[]>(['connected', 'pending', 'none']);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  // Get unique industries
  const industries = useMemo(() => {
    const set = new Set(
      markers
        .filter((m) => m.type === 'supplier' && m.industry)
        .map((m) => m.industry!)
    );
    return Array.from(set).sort();
  }, [markers]);

  // Filter markers
  const filteredMarkers = useMemo(() => {
    return markers.filter((marker) => {
      // Type filter
      if (marker.type === 'supplier' && !showSuppliers) return false;
      if (marker.type === 'facility' && !showFacilities) return false;

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = marker.name.toLowerCase().includes(query);
        const matchesAddress = marker.address.toLowerCase().includes(query);
        if (!matchesName && !matchesAddress) return false;
      }

      // Industry filter (only for suppliers)
      if (marker.type === 'supplier' && selectedIndustries.length > 0) {
        if (!marker.industry || !selectedIndustries.includes(marker.industry)) {
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
  }, [markers, searchQuery, selectedIndustries, showSuppliers, showFacilities, connectionFilter]);

  const toggleIndustry = (industry: string) => {
    setSelectedIndustries((prev) =>
      prev.includes(industry)
        ? prev.filter((i) => i !== industry)
        : [...prev, industry]
    );
  };

  const toggleConnectionFilter = (status: string) => {
    setConnectionFilter((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
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
          <p className="text-destructive">Error loading map data: {error}</p>
        </CardContent>
      </Card>
    );
  }

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

          {/* Industries */}
          {industries.length > 0 && (
            <div className="space-y-2">
              <Label>Industries</Label>
              {industries.map((industry) => (
                <div key={industry} className="flex items-center space-x-2">
                  <Checkbox
                    id={`industry-${industry}`}
                    checked={selectedIndustries.includes(industry)}
                    onCheckedChange={() => toggleIndustry(industry)}
                  />
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: getIndustryColor(industry) }}
                    />
                    <label htmlFor={`industry-${industry}`} className="text-sm cursor-pointer">
                      {industry}
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Clear All */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearchQuery('');
              setSelectedIndustries([]);
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
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-md border-2 border-white">
                    <Warehouse className="w-5 h-5 text-primary-foreground" />
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
                    ) : (
                      <Warehouse className="w-5 h-5" />
                    )}
                    {selectedMarker.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {selectedMarker.industry && (
                    <Badge style={{ backgroundColor: getIndustryColor(selectedMarker.industry) }}>
                      {selectedMarker.industry}
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
            <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center border-2 border-white shadow">
              <Warehouse className="w-4 h-4 text-primary-foreground" />
            </div>
            <span>Facility</span>
          </div>
          {industries.slice(0, 3).map((industry) => (
            <div key={industry} className="flex items-center gap-2 text-sm">
              <div
                className="w-3 h-3 rounded-full border border-white"
                style={{ backgroundColor: getIndustryColor(industry) }}
              />
              <span>{industry}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
