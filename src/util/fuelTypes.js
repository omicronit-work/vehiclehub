import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCountry } from './userCountry';
import { isManualCurrency } from './methods/useCurrency';

// ─── Fuel types per country ─────────────────────────────────────
//
// A fuel log stores two things:
//   fuelType — a stable key used for maths (units, economy chains, price
//              history). The original keys are kept so old records still work:
//              'Petrol' = regular grade, 'Octane' = premium grade.
//   fuelName — the name the pump used where it was bought ("Gasohol 95").
//              Old records have no fuelName; they show fuelType.
//
// Each region lists the keys to offer (in order) and how to label them.
// Keys not in BASE are region-only grades; their unit comes from fuelUnit()
// in fuelEfficiency.js (liquid -> L), so they need no extra wiring.

const BASE = ['Petrol', 'Octane', 'Diesel', 'LPG', 'CNG', 'EV Charge'];

// Shared keys (labels differ per country):
//   Petrol = regular grade      Octane = main premium grade (95 or so)
//   Premium 98 / Premium 100 = top grades      Mid-grade = between the two
//   Premium Diesel = the better diesel grade   E10/E15/E20/E85 = ethanol blends
// A few older country-only keys (Gasohol E20, Pertamax Turbo, ...) are kept
// as-is because saved records use them.
const REGIONS = {
  // ── South Asia ──
  BD: {
    keys: ['Petrol', 'Octane', 'Diesel', 'LPG', 'CNG', 'EV Charge'],
    labels: { LPG: 'Autogas (LPG)' },
  },
  // Normal petrol is E20-blended nationwide; premium 95 is sold as XP95 /
  // Power 95 / Speed, 100-octane as XP100 / Power 100. Premium diesel is
  // XtraGreen / Turbojet / Speed Diesel. Names are generic across companies.
  IN: {
    keys: ['Petrol', 'Octane', 'Premium 100', 'Diesel', 'Premium Diesel', 'CNG', 'LPG', 'EV Charge'],
    labels: { Petrol: 'Normal Petrol (E20)', Octane: 'Premium 95', LPG: 'Auto LPG' },
  },
  PK: {
    keys: ['Petrol', 'Octane', 'Diesel', 'Premium Diesel', 'CNG', 'LPG', 'EV Charge'],
    labels: {
      Petrol: 'Super Petrol (RON 92)', Octane: 'Hi-Octane (HOBC 97)',
      Diesel: 'Diesel (HSD)', 'Premium Diesel': 'Euro 5 Diesel',
    },
  },
  NP: { keys: ['Petrol', 'Diesel', 'EV Charge'], labels: {} },
  LK: {
    keys: ['Petrol', 'Octane', 'Diesel', 'Super Diesel', 'EV Charge'],
    labels: { Petrol: 'Petrol 92', Octane: 'Petrol 95', Diesel: 'Auto Diesel' },
  },

  // ── South-East & East Asia ──
  TH: {
    keys: ['Petrol', 'Octane', 'Premium Gasohol 95', 'Gasohol E20', 'Gasohol E85', 'Benzine 95',
      'Diesel', 'Premium Diesel', 'LPG', 'CNG', 'EV Charge'],
    labels: { Petrol: 'Gasohol 91', Octane: 'Gasohol 95', Diesel: 'Diesel B7', CNG: 'NGV' },
  },
  MY: {
    keys: ['Petrol', 'Octane', 'Premium 100', 'Diesel', 'Premium Diesel', 'EV Charge'],
    labels: {
      Petrol: 'RON95', Octane: 'RON97', 'Premium 100': 'RON100',
      Diesel: 'Diesel Euro 5 B10', 'Premium Diesel': 'Diesel Euro 5 B7',
    },
  },
  ID: {
    keys: ['Petrol', 'Octane', 'Pertamax Green 95', 'Pertamax Turbo', 'Diesel', 'Dexlite',
      'Premium Diesel', 'EV Charge'],
    labels: { Petrol: 'Pertalite', Octane: 'Pertamax', Diesel: 'Solar', 'Premium Diesel': 'Pertamina Dex' },
  },
  PH: {
    keys: ['Petrol', 'Octane', 'Premium 97', 'Premium 100', 'Diesel', 'Premium Diesel', 'LPG', 'EV Charge'],
    labels: { Petrol: 'Unleaded 91', Octane: 'Premium 95', 'Premium 100': 'Super Premium 100', LPG: 'Autogas (LPG)' },
  },
  VN: {
    keys: ['Petrol', 'Octane', 'RON 95-V', 'Diesel', 'Premium Diesel', 'EV Charge'],
    labels: {
      Petrol: 'E5 RON 92', Octane: 'RON 95-III',
      Diesel: 'Diesel 0.05S', 'Premium Diesel': 'Diesel 0.001S-V',
    },
  },
  SG: {
    keys: ['Petrol', 'Octane', 'Premium 98', 'Diesel', 'Premium Diesel', 'EV Charge'],
    labels: { Petrol: '92', Octane: '95', 'Premium 98': '98', 'Premium Diesel': 'Premium Diesel' },
  },
  CN: {
    keys: ['Petrol', 'Octane', 'Premium 98', 'Diesel', 'CNG', 'EV Charge'],
    labels: { Petrol: '92#', Octane: '95#', 'Premium 98': '98#', Diesel: '0# Diesel' },
  },
  HK: {
    keys: ['Octane', 'Diesel', 'LPG', 'EV Charge'],
    labels: { Octane: 'Premium Petrol (98)', Diesel: 'Ultra Low Sulphur Diesel', LPG: 'Autogas (LPG)' },
  },
  KR: {
    keys: ['Petrol', 'Octane', 'Diesel', 'LPG', 'EV Charge'],
    labels: { Petrol: 'Regular Gasoline', Octane: 'Premium Gasoline', LPG: 'LPG (Butane)' },
  },
  JP: {
    keys: ['Petrol', 'Octane', 'Diesel', 'EV Charge'],
    labels: { Petrol: 'Regular', Octane: 'High-octane', Diesel: 'Diesel (Keiyu)' },
  },

  // ── Middle East ──
  AE: {
    keys: ['E-Plus 91', 'Petrol', 'Octane', 'Diesel', 'EV Charge'],
    labels: { Petrol: 'Special 95', Octane: 'Super 98' },
  },
  SA: {
    keys: ['Petrol', 'Octane', 'Premium 98', 'Diesel', 'EV Charge'],
    labels: { Petrol: 'Gasoline 91', Octane: 'Gasoline 95', 'Premium 98': 'Gasoline 98' },
  },
  QA: {
    keys: ['Petrol', 'Octane', 'Diesel', 'EV Charge'],
    labels: { Petrol: 'Premium 91', Octane: 'Super 95' },
  },
  KW: {
    keys: ['Petrol', 'Octane', 'Premium 98', 'Diesel', 'EV Charge'],
    labels: { Petrol: 'Premium 91 (Mumtaz)', Octane: 'Super 95 (Khusoosi)', 'Premium 98': 'Ultra 98' },
  },
  OM: {
    keys: ['Petrol', 'Octane', 'Premium 98', 'Diesel', 'EV Charge'],
    labels: { Petrol: 'M91', Octane: 'M95', 'Premium 98': 'M98' },
  },
  BH: {
    keys: ['Petrol', 'Octane', 'Premium 98', 'Diesel', 'EV Charge'],
    labels: { Petrol: 'Jayyid 91', Octane: 'Mumtaz 95', 'Premium 98': 'Super 98' },
  },
  TR: {
    keys: ['Octane', 'Diesel', 'Premium Diesel', 'LPG', 'EV Charge'],
    labels: {
      Octane: 'Kurşunsuz Benzin 95', Diesel: 'Motorin',
      'Premium Diesel': 'Premium Motorin', LPG: 'Otogaz (LPG)',
    },
  },

  // ── Europe ──
  UK: {
    keys: ['Petrol', 'Octane', 'Diesel', 'Premium Diesel', 'LPG', 'EV Charge'],
    labels: {
      Petrol: 'Unleaded (E10)', Octane: 'Super Unleaded (E5)',
      'Premium Diesel': 'Premium Diesel', LPG: 'Autogas (LPG)',
    },
  },
  DE: {
    keys: ['Petrol', 'Super E5', 'Octane', 'Diesel', 'Premium Diesel', 'HVO100', 'LPG', 'CNG', 'EV Charge'],
    labels: { Petrol: 'Super E10', Octane: 'Super Plus 98', LPG: 'Autogas (LPG)', CNG: 'Erdgas (CNG)' },
  },
  FR: {
    keys: ['Petrol', 'Super E5', 'Octane', 'E85', 'Diesel', 'Premium Diesel', 'HVO100', 'LPG', 'EV Charge'],
    labels: {
      Petrol: 'SP95-E10', 'Super E5': 'SP95', Octane: 'SP98', E85: 'Superéthanol E85',
      Diesel: 'Gazole (B7)', 'Premium Diesel': 'Gazole Premium', HVO100: 'HVO100 (XTL)', LPG: 'GPL-c',
    },
  },
  IT: {
    keys: ['Petrol', 'Octane', 'Diesel', 'Premium Diesel', 'HVO100', 'LPG', 'CNG', 'EV Charge'],
    labels: {
      Petrol: 'Benzina', Octane: 'Benzina Premium (98+)', Diesel: 'Gasolio',
      'Premium Diesel': 'Gasolio Premium', LPG: 'GPL', CNG: 'Metano',
    },
  },
  ES: {
    keys: ['Petrol', 'Octane', 'Diesel', 'Premium Diesel', 'LPG', 'EV Charge'],
    labels: {
      Petrol: 'Gasolina 95', Octane: 'Gasolina 98', Diesel: 'Gasóleo A',
      'Premium Diesel': 'Gasóleo Premium', LPG: 'Autogas (GLP)',
    },
  },
  NL: {
    keys: ['Petrol', 'Octane', 'Diesel', 'Premium Diesel', 'HVO100', 'LPG', 'CNG', 'EV Charge'],
    labels: { Petrol: 'Euro 95 (E10)', Octane: 'Super Plus 98', LPG: 'LPG (Autogas)' },
  },
  // Other EU / EEA countries.
  EU: {
    keys: ['Petrol', 'Super E5', 'Octane', 'Diesel', 'Premium Diesel', 'HVO100', 'LPG', 'CNG', 'E85', 'EV Charge'],
    labels: { Petrol: 'Petrol 95 (E10)', 'Super E5': 'Petrol 95 (E5)', Octane: 'Petrol 98', LPG: 'Autogas (LPG)' },
  },
  RU: {
    keys: ['Petrol', 'Octane', 'Premium 100', 'Diesel', 'LPG', 'CNG', 'EV Charge'],
    labels: {
      Petrol: 'AI-92', Octane: 'AI-95', 'Premium 100': 'AI-98/100',
      Diesel: 'Diesel (DT)', LPG: 'Propane (LPG)', CNG: 'Methane (CNG)',
    },
  },

  // ── Americas ──
  US: {
    keys: ['Petrol', 'Mid-grade', 'Octane', 'E15', 'E85', 'Diesel', 'EV Charge'],
    labels: { Petrol: 'Regular (87)', 'Mid-grade': 'Mid-grade (89)', Octane: 'Premium (91–93)', E15: 'Unleaded 88 (E15)' },
  },
  CA: {
    keys: ['Petrol', 'Mid-grade', 'Octane', 'Diesel', 'LPG', 'EV Charge'],
    labels: { Petrol: 'Regular (87)', 'Mid-grade': 'Mid-grade (89)', Octane: 'Premium (91+)', LPG: 'Propane (Autogas)' },
  },
  BR: {
    keys: ['Petrol', 'Gasolina Aditivada', 'Octane', 'Ethanol', 'Diesel', 'Premium Diesel', 'CNG', 'EV Charge'],
    labels: {
      Petrol: 'Gasolina Comum', Octane: 'Gasolina Premium', Ethanol: 'Etanol',
      Diesel: 'Diesel S500', 'Premium Diesel': 'Diesel S10', CNG: 'GNV',
    },
  },

  // ── Africa ──
  EG: {
    keys: ['Benzine 80', 'Petrol', 'Octane', 'Diesel', 'CNG', 'EV Charge'],
    labels: { Petrol: 'Benzine 92', Octane: 'Benzine 95', Diesel: 'Solar (Diesel)', CNG: 'Natural Gas (CNG)' },
  },
  NG: {
    keys: ['Petrol', 'Diesel', 'CNG', 'LPG', 'EV Charge'],
    labels: { Petrol: 'Petrol (PMS)', Diesel: 'Diesel (AGO)', LPG: 'Autogas (LPG)' },
  },
  ZA: {
    keys: ['Petrol', 'Octane', 'Diesel', 'Premium Diesel', 'EV Charge'],
    labels: {
      Petrol: 'Unleaded 93', Octane: 'Unleaded 95',
      Diesel: 'Diesel 500ppm', 'Premium Diesel': 'Diesel 50ppm',
    },
  },

  // ── Oceania ──
  AU: {
    keys: ['E10', 'Petrol', 'Octane', 'Premium 98', 'Diesel', 'Premium Diesel', 'LPG', 'EV Charge'],
    labels: {
      E10: 'E10 (94)', Petrol: 'Unleaded 91', Octane: 'Premium 95', 'Premium 98': 'Premium 98',
      LPG: 'Autogas (LPG)',
    },
  },
  NZ: {
    keys: ['Petrol', 'Octane', 'Premium 98', 'Diesel', 'EV Charge'],
    labels: { Petrol: 'Regular 91', Octane: 'Premium 95', 'Premium 98': 'Premium 98/100' },
  },

  DEFAULT: { keys: BASE, labels: { Petrol: 'Regular', Octane: 'Premium' } },
};

// ISO country code -> region, for countries that share a table.
const COUNTRY_TO_REGION = {
  GB: 'UK', IE: 'UK',
  BE: 'NL', LU: 'NL',
  ...Object.fromEntries(
    ['PT', 'AT', 'CH', 'LI', 'DK', 'SE', 'NO', 'FI', 'IS', 'PL', 'CZ', 'SK', 'HU', 'RO', 'BG',
      'GR', 'HR', 'SI', 'EE', 'LV', 'LT', 'MT', 'CY'].map(c => [c, 'EU']),
  ),
};

// For a currency picked by hand, before GPS has found the country.
const CURRENCY_TO_COUNTRY = {
  BDT: 'BD', INR: 'IN', PKR: 'PK', NPR: 'NP', LKR: 'LK', THB: 'TH', MYR: 'MY', IDR: 'ID',
  PHP: 'PH', VND: 'VN', SGD: 'SG', JPY: 'JP', CNY: 'CN', HKD: 'HK', KRW: 'KR', AED: 'AE',
  QAR: 'QA', KWD: 'KW', OMR: 'OM', BHD: 'BH', SAR: 'SA', TRY: 'TR', USD: 'US', CAD: 'CA',
  BRL: 'BR', GBP: 'GB', EUR: 'DE', CHF: 'CH', SEK: 'SE', PLN: 'PL', RUB: 'RU', EGP: 'EG',
  NGN: 'NG', ZAR: 'ZA', AUD: 'AU', NZD: 'NZ',
};

const regionOf = country => REGIONS[country] ? country : COUNTRY_TO_REGION[country] || 'DEFAULT';

export const fuelLabel = (key, country) => REGIONS[regionOf(country)].labels[key] || key;

// The chips to show: [{ key, label }]. `include` keeps a record's own fuel
// selectable when editing a log bought in another country.
export const fuelTypesFor = (country, include) => {
  const keys = [...REGIONS[regionOf(country)].keys];
  if (include && !keys.includes(include)) keys.push(include);
  return keys.map(key => ({ key, label: fuelLabel(key, country) }));
};

// What a list, dialog or report should call a saved fuel log.
export const fuelDisplayName = log => log?.fuelName || log?.fuelType || 'Fuel';

// ─── Which country's names to show ──────────────────────────────

// Before GPS has ever found the country (or if location is off): the country
// of a currency the user picked by hand, else the phone's region, else US.
const fallbackCountry = async () => {
  try {
    if (await isManualCurrency()) {
      const cur = JSON.parse((await AsyncStorage.getItem('selectedCurrency')) || 'null');
      if (CURRENCY_TO_COUNTRY[cur?.code]) return CURRENCY_TO_COUNTRY[cur.code];
    }
  } catch {}
  const locale = Intl.DateTimeFormat().resolvedOptions().locale || '';
  const tail = locale.split('-').pop()?.toUpperCase();
  return tail && tail.length === 2 ? tail : 'US';
};

// The country whose fuel names to show. Pass `active` (the modal's
// `visible`) to re-check the location each time the form opens.
export const useFuelCountry = active => {
  const gps = useCountry(active);
  const [fallback, setFallback] = useState('US');
  useEffect(() => {
    if (!gps && active) fallbackCountry().then(setFallback);
  }, [gps, active]);
  return gps || fallback;
};
