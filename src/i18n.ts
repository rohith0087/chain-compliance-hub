
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import enCommon from './locales/en/common.json';
import enHome from './locales/en/home.json';
import enDashboard from './locales/en/dashboard.json';
import enSupplier from './locales/en/supplier.json';
import enAdmin from './locales/en/admin.json';
import esCommon from './locales/es/common.json';
import esHome from './locales/es/home.json';
import esDashboard from './locales/es/dashboard.json';
import esSupplier from './locales/es/supplier.json';
import esAdmin from './locales/es/admin.json';
import deCommon from './locales/de/common.json';
import deHome from './locales/de/home.json';
import deDashboard from './locales/de/dashboard.json';
import deSupplier from './locales/de/supplier.json';
import deAdmin from './locales/de/admin.json';

// Region to language mapping
export const REGION_LANGUAGE_MAP = {
  'north-america': 'en',
  'europe': 'es',
  'asia': 'en',
  'latin-america': 'es'
};

export const REGIONS = [
  { code: 'north-america', name: 'North America', flag: '🇺🇸', languages: ['en'] },
  { code: 'europe', name: 'Europe', flag: '🇪🇺', languages: ['de', 'es', 'en'] },
  { code: 'asia', name: 'Asia', flag: '🌏', languages: ['en'] },
  { code: 'latin-america', name: 'Latin America', flag: '🌎', languages: ['es'] }
];

const resources = {
  en: {
    common: enCommon,
    home: enHome,
    dashboard: enDashboard,
    supplier: enSupplier,
    admin: enAdmin
  },
  es: {
    common: esCommon,
    home: esHome,
    dashboard: esDashboard,
    supplier: esSupplier,
    admin: esAdmin
  },
  de: {
    common: deCommon,
    home: deHome,
    dashboard: deDashboard,
    supplier: deSupplier,
    admin: deAdmin
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    debug: false,
    interpolation: {
      escapeValue: false
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage']
    }
  });

export default i18n;
