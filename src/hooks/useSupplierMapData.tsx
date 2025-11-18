import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { geocodeAddress } from '@/utils/googleGeocoding';
import { useAuth } from './useAuth';

export interface MapMarker {
  id: string;
  type: 'supplier' | 'facility';
  name: string;
  lat: number;
  lng: number;
  address: string;
  industry?: string;
  phone?: string;
  connectionStatus?: 'connected' | 'pending' | 'none';
  supplierId: string;
  facilityCount?: number;
  branchId?: string;
}

export function useSupplierMapData() {
  const { user } = useAuth();
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    
    loadMapData();
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
          buyer_supplier_connections!buyer_supplier_connections_supplier_id_fkey(
            id,
            status,
            buyer_id
          )
        `);

      if (suppliersError) throw suppliersError;

      // Get all facilities
      const { data: facilities, error: facilitiesError } = await supabase
        .from('company_branches')
        .select(`
          id,
          branch_name,
          address,
          phone,
          company_id,
          company_type
        `)
        .eq('company_type', 'supplier');

      if (facilitiesError) throw facilitiesError;

      const newMarkers: MapMarker[] = [];

      // Process suppliers
      if (suppliers) {
        for (const supplier of suppliers) {
          if (!supplier.address) continue;

          const geocoded = await geocodeAddress(supplier.address);
          if (!geocoded) continue;

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
            lat: geocoded.lat,
            lng: geocoded.lng,
            address: geocoded.formatted_address,
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

      // Process facilities
      if (facilities) {
        for (const facility of facilities) {
          if (!facility.address) continue;

          const geocoded = await geocodeAddress(facility.address);
          if (!geocoded) continue;

          newMarkers.push({
            id: facility.id,
            type: 'facility',
            name: facility.branch_name,
            lat: geocoded.lat,
            lng: geocoded.lng,
            address: geocoded.formatted_address,
            phone: facility.phone || undefined,
            supplierId: facility.company_id,
            branchId: facility.id,
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
