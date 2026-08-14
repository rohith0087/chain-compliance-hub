import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { geocodeAddress } from '@/utils/googleGeocoding';
import { useAuth } from './useAuth';

export interface MapMarker {
  id: string;
  type: 'supplier' | 'facility' | 'buyer-branch';
  name: string;
  lat: number;
  lng: number;
  address: string;
  industry?: string;
  phone?: string;
  email?: string;
  connectionStatus?: 'connected' | 'pending' | 'none';
  supplierId: string;
  facilityCount?: number;
  branchId?: string;
  facilityType?: 'headquarters' | 'distribution' | 'store' | 'branch';
}

/** Row shape shared by suppliers/buyers, which carry both the legacy single
 *  `address` string and the newer structured columns. */
interface AddressBearingRow {
  address?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
}

/**
 * Best available address string for a row. The profile forms write the
 * structured columns while the legacy `address` text field often stays null,
 * so reading `address` alone silently drops every company that filled in the
 * structured form -- they'd never appear on the map.
 */
function bestAddress(row: AddressBearingRow): string {
  if (row.address?.trim()) return row.address.trim();
  return [row.address_line1, row.address_line2, row.city, row.state, row.postal_code, row.country]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(', ');
}

// Coordinates are read straight off the row when the address was captured via
// Google Places (PlaceAutocompleteInput) -- accurate, no network call. Only
// rows saved before that existed (address present, latitude/longitude still
// null) fall back to the client-side Geocoding API, so old data still plots
// without requiring everyone to re-save their address.
async function resolveCoords(
  address: string | null | undefined,
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): Promise<{ lat: number; lng: number; formatted_address: string } | null> {
  if (latitude != null && longitude != null) {
    return { lat: latitude, lng: longitude, formatted_address: address || '' };
  }
  if (!address) return null;
  const geocoded = await geocodeAddress(address);
  if (!geocoded) return null;
  return { lat: geocoded.lat, lng: geocoded.lng, formatted_address: geocoded.formatted_address };
}

export function useSupplierMapData() {
  const { user } = useAuth();
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    loadMapData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadMapData() {
    try {
      setLoading(true);
      setError(null);

      // Get buyer profile
      const { data: buyerData } = await supabase
        .from('buyers')
        .select('id')
        .eq('profile_id', user!.id)
        .single();

      if (!buyerData) {
        setError('Buyer profile not found');
        return;
      }

      // Get all suppliers
      const { data: suppliers, error: suppliersError } = await supabase
        .from('suppliers')
        .select(`
          id,
          company_name,
          industry,
          phone,
          address,
          address_line1,
          address_line2,
          city,
          state,
          postal_code,
          country,
          latitude,
          longitude,
          buyer_supplier_connections!buyer_supplier_connections_supplier_id_fkey(
            id,
            status,
            buyer_id
          )
        `);

      if (suppliersError) throw suppliersError;

      // Get all supplier facilities
      const { data: facilities, error: facilitiesError } = await supabase
        .from('company_branches')
        .select(`
          id,
          branch_name,
          address,
          latitude,
          longitude,
          phone,
          company_id,
          company_type,
          location
        `)
        .eq('company_type', 'supplier')
        .eq('status', 'active');

      if (facilitiesError) throw facilitiesError;

      // Get the buyer's own branches -- plotted as a distinct marker type so
      // a buyer can see their own locations alongside their suppliers'.
      const { data: buyerBranches, error: buyerBranchesError } = await supabase
        .from('company_branches')
        .select(`
          id,
          branch_name,
          address,
          latitude,
          longitude,
          phone,
          email,
          location
        `)
        .eq('company_id', buyerData.id)
        .eq('company_type', 'buyer')
        .eq('status', 'active');

      if (buyerBranchesError) throw buyerBranchesError;

      const newMarkers: MapMarker[] = [];

      // Process suppliers
      if (suppliers) {
        for (const supplier of suppliers) {
          const supplierAddress = bestAddress(supplier);
          const coords = await resolveCoords(supplierAddress, supplier.latitude, supplier.longitude);
          if (!coords) continue;

          const connection = supplier.buyer_supplier_connections?.find(
            (c: any) => c.buyer_id === buyerData.id
          );

          const facilityCount = facilities?.filter(
            (f) => f.company_id === supplier.id
          ).length || 0;

          newMarkers.push({
            id: supplier.id,
            type: 'supplier',
            name: supplier.company_name,
            lat: coords.lat,
            lng: coords.lng,
            address: coords.formatted_address || supplierAddress,
            industry: supplier.industry || undefined,
            phone: supplier.phone || undefined,
            connectionStatus: connection
              ? (connection.status as any)
              : 'none',
            supplierId: supplier.id,
            facilityCount,
          });
        }
      }

      // Process supplier facilities
      if (facilities) {
        for (const facility of facilities) {
          const coords = await resolveCoords(facility.address, facility.latitude, facility.longitude);
          if (!coords) continue;

          newMarkers.push({
            id: facility.id,
            type: 'facility',
            name: facility.branch_name,
            lat: coords.lat,
            lng: coords.lng,
            address: coords.formatted_address || facility.address || '',
            phone: facility.phone || undefined,
            supplierId: facility.company_id,
            branchId: facility.id,
            facilityType: (facility.location as 'headquarters' | 'distribution' | 'store') || undefined,
          });
        }
      }

      // Process the buyer's own branches
      if (buyerBranches) {
        for (const branch of buyerBranches) {
          const coords = await resolveCoords(branch.address, branch.latitude, branch.longitude);
          if (!coords) continue;

          newMarkers.push({
            id: branch.id,
            type: 'buyer-branch',
            name: branch.branch_name,
            lat: coords.lat,
            lng: coords.lng,
            address: coords.formatted_address || branch.address || '',
            phone: branch.phone || undefined,
            email: branch.email || undefined,
            supplierId: buyerData.id,
            branchId: branch.id,
            facilityType: branch.branch_name === 'Main Office'
              ? 'headquarters'
              : ((branch.location as 'headquarters' | 'branch') || 'branch'),
          });
        }
      }

      setMarkers(newMarkers);
    } catch (err: any) {
      console.error('Error loading map data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return {
    markers,
    loading,
    error,
    reload: loadMapData,
  };
}
