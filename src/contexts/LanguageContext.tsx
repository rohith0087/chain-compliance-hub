
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { REGION_LANGUAGE_MAP, REGIONS } from '../i18n';
import { useIPLocation } from '../hooks/useIPLocation';

interface LanguageContextType {
  currentLanguage: string;
  currentRegion: string;
  setLanguage: (language: string) => void;
  setRegion: (region: string) => void;
  availableLanguages: string[];
  regions: typeof REGIONS;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { i18n } = useTranslation();
  const [currentRegion, setCurrentRegion] = useState<string>(() => {
    return localStorage.getItem('selectedRegion') || 'north-america';
  });
  const [hasDetectedLocation, setHasDetectedLocation] = useState(false);
  const { detectedLanguage, detectedRegion, loading: locationLoading, countryCode } = useIPLocation();

  const setLanguage = (language: string) => {
    i18n.changeLanguage(language);
    localStorage.setItem('selectedLanguage', language);
  };

  const setRegion = (region: string) => {
    setCurrentRegion(region);
    localStorage.setItem('selectedRegion', region);
    
    // Auto-set language based on region
    const defaultLanguage = REGION_LANGUAGE_MAP[region as keyof typeof REGION_LANGUAGE_MAP];
    if (defaultLanguage) {
      setLanguage(defaultLanguage);
    }
  };

  useEffect(() => {
    const savedLanguage = localStorage.getItem('selectedLanguage');
    const savedRegion = localStorage.getItem('selectedRegion');
    const hasUserOverride = savedLanguage || savedRegion;
    
    // If user has previously made a selection, respect it
    if (hasUserOverride) {
      if (savedLanguage) {
        i18n.changeLanguage(savedLanguage);
      }
      if (savedRegion) {
        setCurrentRegion(savedRegion);
      }
      return;
    }

    // If location is detected and no user override exists, auto-set
    if (!locationLoading && detectedLanguage && detectedRegion && !hasDetectedLocation) {
      console.log(`Auto-detecting location: ${countryCode} -> Language: ${detectedLanguage}, Region: ${detectedRegion}`);
      setLanguage(detectedLanguage);
      setCurrentRegion(detectedRegion);
      localStorage.setItem('autoDetectedRegion', detectedRegion);
      localStorage.setItem('autoDetectedLanguage', detectedLanguage);
      setHasDetectedLocation(true);
    }
  }, [i18n, detectedLanguage, detectedRegion, locationLoading, hasDetectedLocation, countryCode]);

  const value: LanguageContextType = {
    currentLanguage: i18n.language,
    currentRegion,
    setLanguage,
    setRegion,
    availableLanguages: ['en', 'es', 'de'],
    regions: REGIONS
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
