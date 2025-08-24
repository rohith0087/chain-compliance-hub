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
      const CACHE_KEY = 'ipLocationCache';
      const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

      // 1) Try cache first
      try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) {
          const cached = JSON.parse(raw) as { data: any; ts: number };
          if (Date.now() - cached.ts < TTL_MS && cached.data?.countryCode) {
            setLocationData({
              country: cached.data.country,
              countryCode: cached.data.countryCode,
              city: cached.data.city,
              loading: false,
              error: null
            });
            return;
          }
        }
      } catch (_) {
        // ignore cache errors
      }

      // 2) Provider fallbacks
      type Parsed = { country: string; countryCode: string; city?: string };
      const providers: {
        name: string;
        url: string;
        parse: (d: any) => Parsed;
      }[] = [
        {
          name: 'ipwhois',
          url: 'https://ipwho.is/',
          parse: (d: any) => ({
            country: d?.country || '',
            countryCode: d?.country_code || '',
            city: d?.city || ''
          })
        },
        {
          name: 'ipapi',
          url: 'https://ipapi.co/json/',
          parse: (d: any) => ({
            country: d?.country_name || d?.country || '',
            countryCode: d?.country_code || d?.country_code_iso2 || '',
            city: d?.city || ''
          })
        },
        {
          name: 'bigdatacloud',
          url: 'https://api.bigdatacloud.net/data/ip-geolocation?localityLanguage=en',
          parse: (d: any) => ({
            country: d?.country?.name || '',
            countryCode: d?.country?.isoAlpha2 || '',
            city: d?.city?.name || ''
          })
        }
      ];

      const fetchWithTimeout = async (input: RequestInfo, init?: RequestInit, timeoutMs = 5000) => {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const resp = await fetch(input, { ...init, signal: controller.signal, headers: { Accept: 'application/json', ...(init?.headers || {}) } });
          clearTimeout(t);
          return resp;
        } catch (e) {
          clearTimeout(t);
          throw e;
        }
      };

      let lastError: any = null;
      for (const p of providers) {
        try {
          const resp = await fetchWithTimeout(p.url, { method: 'GET' }, 6000);
          if (!resp.ok) throw new Error(`Provider ${p.name} returned ${resp.status}`);
          const json = await resp.json();
          const parsed = p.parse(json);
          if (parsed.countryCode) {
            setLocationData({
              country: parsed.country,
              countryCode: parsed.countryCode,
              city: parsed.city || '',
              loading: false,
              error: null
            });
            try {
              localStorage.setItem(CACHE_KEY, JSON.stringify({ data: parsed, ts: Date.now() }));
            } catch (_) {}
            return;
          }
        } catch (e) {
          lastError = e;
          // continue to next provider
        }
      }

      // 3) Final fallback to navigator language
      const navLang = (typeof navigator !== 'undefined' && navigator.language) ? navigator.language : '';
      const code = navLang.startsWith('es') ? 'ES' : navLang.startsWith('de') ? 'DE' : 'US';
      const countryName = code === 'ES' ? 'Spain' : code === 'DE' ? 'Germany' : 'United States';
      console.warn('IP location detection failed, using navigator.language fallback:', lastError);
      setLocationData(prev => ({
        ...prev,
        country: countryName,
        countryCode: code,
        city: '',
        loading: false,
        error: lastError instanceof Error ? lastError.message : 'Location lookup failed'
      }));
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