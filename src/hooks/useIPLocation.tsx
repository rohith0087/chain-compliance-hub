import { useState, useEffect } from 'react';

interface IPLocationData {
  country: string;
  countryCode: string;
  city?: string;
  loading: boolean;
  error: string | null;
}

const COUNTRY_TO_LANGUAGE_MAP: Record<string, string> = {
  // South America - Spanish
  'AR': 'es', // Argentina
  'BO': 'es', // Bolivia
  'BR': 'es', // Brazil (treating as Spanish for your use case)
  'CL': 'es', // Chile
  'CO': 'es', // Colombia
  'EC': 'es', // Ecuador
  'GY': 'es', // Guyana
  'PY': 'es', // Paraguay
  'PE': 'es', // Peru
  'SR': 'es', // Suriname
  'UY': 'es', // Uruguay
  'VE': 'es', // Venezuela
  
  // Europe - German
  'DE': 'de', // Germany
  'AT': 'de', // Austria
  'CH': 'de', // Switzerland
  
  // Europe - Spanish
  'ES': 'es', // Spain
  
  // Default to English for all other countries
};

const COUNTRY_TO_REGION_MAP: Record<string, string> = {
  // North America
  'US': 'north-america',
  'CA': 'north-america',
  'MX': 'latin-america',
  
  // South America
  'AR': 'latin-america',
  'BO': 'latin-america',
  'BR': 'latin-america',
  'CL': 'latin-america',
  'CO': 'latin-america',
  'EC': 'latin-america',
  'GY': 'latin-america',
  'PY': 'latin-america',
  'PE': 'latin-america',
  'SR': 'latin-america',
  'UY': 'latin-america',
  'VE': 'latin-america',
  
  // Europe
  'DE': 'europe',
  'AT': 'europe',
  'CH': 'europe',
  'ES': 'europe',
  'FR': 'europe',
  'IT': 'europe',
  'GB': 'europe',
  'NL': 'europe',
  'BE': 'europe',
  'PT': 'europe',
  
  // Asia
  'CN': 'asia',
  'JP': 'asia',
  'KR': 'asia',
  'IN': 'asia',
  'SG': 'asia',
  'TH': 'asia',
  'VN': 'asia',
  'PH': 'asia',
  'MY': 'asia',
  'ID': 'asia',
};

export const useIPLocation = () => {
  const [locationData, setLocationData] = useState<IPLocationData>({
    country: '',
    countryCode: '',
    loading: true,
    error: null
  });

  useEffect(() => {
    const fetchLocation = async () => {
      try {
        // Using BigDataCloud's free IP geolocation API (no key required)
        const response = await fetch('https://api.bigdatacloud.net/data/ip-geolocation?localityLanguage=en', {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch location data');
        }

        const data = await response.json();
        
        setLocationData({
          country: data.country?.name || '',
          countryCode: data.country?.isoAlpha2 || '',
          city: data.city?.name || '',
          loading: false,
          error: null
        });
      } catch (error) {
        console.warn('IP location detection failed:', error);
        setLocationData(prev => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }));
      }
    };

    fetchLocation();
  }, []);

  const getLanguageFromCountry = (countryCode: string): string => {
    return COUNTRY_TO_LANGUAGE_MAP[countryCode] || 'en';
  };

  const getRegionFromCountry = (countryCode: string): string => {
    return COUNTRY_TO_REGION_MAP[countryCode] || 'north-america';
  };

  return {
    ...locationData,
    getLanguageFromCountry,
    getRegionFromCountry,
    detectedLanguage: locationData.countryCode ? getLanguageFromCountry(locationData.countryCode) : 'en',
    detectedRegion: locationData.countryCode ? getRegionFromCountry(locationData.countryCode) : 'north-america'
  };
};