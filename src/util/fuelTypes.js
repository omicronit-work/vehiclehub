import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCountry } from './userCountry';
import { isManualCurrency, onCurrencyChange } from './methods/useCurrency';
import { currencyForCountry } from './currencies';
import { getLanguage, t } from '../i18n';

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

// The country of a currency picked by hand.
const CURRENCY_TO_COUNTRY = {
  BDT: 'BD', INR: 'IN', PKR: 'PK', NPR: 'NP', LKR: 'LK', THB: 'TH', MYR: 'MY', IDR: 'ID',
  PHP: 'PH', VND: 'VN', SGD: 'SG', JPY: 'JP', CNY: 'CN', HKD: 'HK', KRW: 'KR', AED: 'AE',
  QAR: 'QA', KWD: 'KW', OMR: 'OM', BHD: 'BH', SAR: 'SA', TRY: 'TR', USD: 'US', CAD: 'CA',
  BRL: 'BR', GBP: 'GB', EUR: 'DE', CHF: 'CH', SEK: 'SE', PLN: 'PL', RUB: 'RU', EGP: 'EG',
  NGN: 'NG', ZAR: 'ZA', AUD: 'AU', NZD: 'NZ',
};

const regionOf = country => REGIONS[country] ? country : COUNTRY_TO_REGION[country] || 'DEFAULT';

// ─── Names in the app language ──────────────────────────────────
// English shows the pump names above. Another language shows the fuel's
// generic name in that language (fuel.* in i18n/locales), keeping the grade
// number from the pump name so grades stay apart: Thailand in Bengali shows
// "পেট্রোল 91" / "অকটেন 95". In a country's own language its real pump names
// are shown (NATIVE_LABELS, or the table above where it is already local).
// Brand-only grades with no generic meaning (Pertalite, Gasohol E20…) keep
// their pump name in every language.

// Fuel key -> generic name key in the locale files.
const GENERIC = {
  Petrol: 'Petrol', Octane: 'Octane', Diesel: 'Diesel', LPG: 'LPG', CNG: 'CNG',
  'EV Charge': 'EV', 'Premium Diesel': 'PremiumDiesel', 'Super Diesel': 'PremiumDiesel',
  'Mid-grade': 'MidGrade', Ethanol: 'Ethanol',
};
// Keys named as a generic fuel plus a fixed grade.
const DERIVED = {
  'Premium 97': ['Octane', '97'], 'Premium 98': ['Octane', '98'], 'Premium 100': ['Octane', '100'],
  E10: ['Petrol', 'E10'], E15: ['Petrol', 'E15'], 'Super E5': ['Petrol', 'E5'], E85: ['Ethanol', 'E85'],
};

// Languages whose home region's table (above) already uses local pump names.
const HOME_REGION = {
  fr: 'FR', it: 'IT', es: 'ES', de: 'DE', nl: 'NL', pt: 'BR', tr: 'TR', id: 'ID', ms: 'MY',
};

// Pump names in the local language, where the table above is in English.
const NATIVE_LABELS = {
  th: {
    TH: {
      Petrol: 'แก๊สโซฮอล์ 91', Octane: 'แก๊สโซฮอล์ 95', 'Premium Gasohol 95': 'แก๊สโซฮอล์ 95 พรีเมียม',
      'Gasohol E20': 'แก๊สโซฮอล์ E20', 'Gasohol E85': 'แก๊สโซฮอล์ E85', 'Benzine 95': 'เบนซิน 95',
      Diesel: 'ดีเซล B7', 'Premium Diesel': 'ดีเซลพรีเมียม', LPG: 'แอลพีจี', CNG: 'เอ็นจีวี',
      'EV Charge': 'ชาร์จไฟฟ้า',
    },
  },
  ja: { JP: { Petrol: 'レギュラー', Octane: 'ハイオク', Diesel: '軽油', 'EV Charge': 'EV充電' } },
  ko: { KR: { Petrol: '보통 휘발유', Octane: '고급 휘발유', Diesel: '경유', LPG: 'LPG', 'EV Charge': '전기차 충전' } },
  zh: {
    CN: {
      Petrol: '92#汽油', Octane: '95#汽油', 'Premium 98': '98#汽油', Diesel: '0#柴油',
      CNG: '天然气 (CNG)', 'EV Charge': '电动车充电',
    },
  },
  ru: {
    RU: {
      Petrol: 'АИ-92', Octane: 'АИ-95', 'Premium 100': 'АИ-98/100', Diesel: 'ДТ (дизель)',
      LPG: 'Пропан (СУГ)', CNG: 'Метан (КПГ)', 'EV Charge': 'Электрозарядка',
    },
  },
  vi: {
    VN: {
      Petrol: 'Xăng E5 RON 92', Octane: 'Xăng RON 95-III', 'RON 95-V': 'Xăng RON 95-V',
      Diesel: 'Dầu DO 0,05S', 'Premium Diesel': 'Dầu DO 0,001S-V', 'EV Charge': 'Sạc xe điện',
    },
  },
};

const genericName = key => {
  if (GENERIC[key]) return t(`fuel.${GENERIC[key]}`);
  if (DERIVED[key]) return `${t(`fuel.${DERIVED[key][0]}`)} ${DERIVED[key][1]}`;
  return null;
};

// The grade in a pump name: "Gasohol 91" -> "91", "Super Petrol (RON 92)" ->
// "RON 92", "Unleaded (E10)" -> "E10", "92#" -> "92#".
export const gradeOf = label =>
  (String(label || '').match(/RON\s?\d{2,3}|\bE\d{1,2}\b|\b\d{2,3}(?:#|\b)/) || [])[0] || null;

export const fuelLabel = (key, country, lang = getLanguage()) => {
  const region = regionOf(country);
  const local = REGIONS[region].labels[key];
  if (lang === 'en') return local || key;
  const native = NATIVE_LABELS[lang]?.[region]?.[key];
  if (native) return native;
  if (HOME_REGION[lang] === region && local) return local;
  const generic = genericName(key);
  if (!generic) return local || key;
  const grade = local && !/\d/.test(generic) ? gradeOf(local) : null;
  return grade ? `${generic} ${grade}` : generic;
};

// The chips to show: [{ key, label }]. `include` keeps a record's own fuel
// selectable when editing a log bought in another country.
export const fuelTypesFor = (country, include) => {
  const keys = [...REGIONS[regionOf(country)].keys];
  if (include && !keys.includes(include)) keys.push(include);
  return keys.map(key => ({ key, label: fuelLabel(key, country) }));
};

// What a list or dialog calls a saved fuel log, in the app language. The log
// keeps the pump name it was saved with (fuelName) plus a stable key
// (fuelType): a name from one of the tables above is re-labelled for that
// country in the current language ("Gasohol 95" -> "แก๊สโซฮอล์ 95" / "অকটেন
// 95"); a name saved in another language becomes this language's generic
// name, keeping its grade. Reports/exports use fuelName as stored.
export const fuelDisplayName = log => {
  const key = log?.fuelType;
  const name = log?.fuelName || key;
  if (!key) return name || t('cat.fuel');
  const lang = getLanguage();
  const region = Object.keys(REGIONS).find(r => (REGIONS[r].labels[key] || key) === name);
  if (region) return fuelLabel(key, region, lang);
  const generic = lang === 'en' ? null : genericName(key);
  if (!generic) return name;
  const grade = /\d/.test(generic) ? null : gradeOf(name);
  return grade ? `${generic} ${grade}` : generic;
};

// ─── Which country's names to show ──────────────────────────────

// The country of the currency the user picked by hand (null in Automatic
// mode or for a currency with no country). Taka -> Bangladesh, US Dollar ->
// USA, Thai Baht -> Thailand. When the phone's own country uses that same
// currency (euro in France) that country is kept instead.
const currencyCountry = async detected => {
  try {
    if (!(await isManualCurrency())) return null;
    const cur = JSON.parse((await AsyncStorage.getItem('selectedCurrency')) || 'null');
    if (!cur?.code) return null;
    if (detected && currencyForCountry(detected).code === cur.code) return detected;
    return CURRENCY_TO_COUNTRY[cur.code] || null;
  } catch {
    return null;
  }
};

// No currency picked and no time-zone country: the phone's region, else US.
const localeCountry = () => {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale || '';
  const tail = locale.split('-').pop()?.toUpperCase();
  return tail && tail.length === 2 ? tail : 'US';
};

// The country whose fuel names to show: the selected currency's country,
// else the phone's time-zone country. Pass `active` (the modal's `visible`)
// to re-read it each time the form opens; it also follows currency changes.
export const useFuelCountry = active => {
  const detected = useCountry();
  const [picked, setPicked] = useState(null);
  const [changes, setChanges] = useState(0);
  useEffect(() => onCurrencyChange(() => setChanges(n => n + 1)), []);
  useEffect(() => {
    let cancelled = false;
    currencyCountry(detected).then(c => { if (!cancelled) setPicked(c); });
    return () => { cancelled = true; };
  }, [detected, active, changes]);
  return picked || detected || localeCountry();
};
