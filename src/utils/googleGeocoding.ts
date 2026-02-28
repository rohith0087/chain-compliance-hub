import logger from '@/utils/logger';

interface GeocodeResult {
  lat: number;
  lng: number;
  formatted_address: string;
  place_id?: string;
}

interface GeocodeCache {
  [address: string]: {
    result: GeocodeResult;
    timestamp: number;
  };
}

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_KEY = 'google_geocode_cache';

function getCache(): GeocodeCache {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    return cached ? JSON.parse(cached) : {};
  } catch {
    return {};
  }
}

function setCache(cache: GeocodeCache): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error('Failed to cache geocode results:', error);
  }
}

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  if (!address?.trim()) return null;

  // Check cache first
  const cache = getCache();
  const cached = cache[address];
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    logger.debug('Using cached geocode for:', address);
    return cached.result;
  }

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error('Google Maps API key not found');
    return null;
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      address
    )}&key=${apiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results?.[0]) {
      const result = data.results[0];
      const geocodeResult: GeocodeResult = {
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
        formatted_address: result.formatted_address,
        place_id: result.place_id,
      };

      // Cache the result
      cache[address] = {
        result: geocodeResult,
        timestamp: Date.now(),
      };
      setCache(cache);

      logger.debug('Geocoded:', address, '→', geocodeResult);
      return geocodeResult;
    } else {
      console.warn('Geocoding failed for:', address, data.status);
      return null;
    }
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

export async function batchGeocode(
  addresses: string[]
): Promise<Map<string, GeocodeResult>> {
  const results = new Map<string, GeocodeResult>();
  
  // Process in batches to avoid rate limits
  const batchSize = 5;
  for (let i = 0; i < addresses.length; i += batchSize) {
    const batch = addresses.slice(i, i + batchSize);
    const promises = batch.map(async (address) => {
      const result = await geocodeAddress(address);
      if (result) {
        results.set(address, result);
      }
    });
    
    await Promise.all(promises);
    
    // Small delay between batches
    if (i + batchSize < addresses.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  return results;
}
