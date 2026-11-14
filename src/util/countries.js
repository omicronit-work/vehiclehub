import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── The user's country ─────────────────────────────────────────
// Picked once in a pop-up after sign-in (FirstCountryPrompt), changeable in
// Settings. Saved on the account (users/{email}.country) and on this phone
// (AsyncStorage `selectedCountry`). It decides which fuel types
// (util/fuelTypes.js) and document types (util/documentFields.js) are
// offered. No location API is used: the list below is all there is.

// `currency` is the code suggested in the currency prompt that follows.
export const COUNTRIES = [
  { code: 'BD', name: 'Bangladesh', flag: '🇧🇩', currency: 'BDT' },
  { code: 'IN', name: 'India', flag: '🇮🇳', currency: 'INR' },
  { code: 'PK', name: 'Pakistan', flag: '🇵🇰', currency: 'PKR' },
  { code: 'NP', name: 'Nepal', flag: '🇳🇵', currency: 'NPR' },
  { code: 'LK', name: 'Sri Lanka', flag: '🇱🇰', currency: 'LKR' },
  { code: 'TH', name: 'Thailand', flag: '🇹🇭', currency: 'THB' },
  { code: 'MY', name: 'Malaysia', flag: '🇲🇾', currency: 'MYR' },
  { code: 'ID', name: 'Indonesia', flag: '🇮🇩', currency: 'IDR' },
  { code: 'PH', name: 'Philippines', flag: '🇵🇭', currency: 'PHP' },
  { code: 'VN', name: 'Vietnam', flag: '🇻🇳', currency: 'VND' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬', currency: 'SGD' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵', currency: 'JPY' },
  { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪', currency: 'AED' },
  { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦', currency: 'SAR' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', currency: 'GBP' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪', currency: 'EUR' },
  { code: 'FR', name: 'France', flag: '🇫🇷', currency: 'EUR' },
  { code: 'US', name: 'United States', flag: '🇺🇸', currency: 'USD' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', currency: 'CAD' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺', currency: 'AUD' },
];

export const findCountry = code => COUNTRIES.find(c => c.code === code) || null;

const STORAGE_KEY = 'selectedCountry';

let selected = null; // ISO code, e.g. 'BD'
let loaded = null;
const listeners = new Set();

const emit = () => listeners.forEach(fn => fn(selected));

const ensureLoaded = () => {
  if (!loaded) {
    loaded = AsyncStorage.getItem(STORAGE_KEY)
      .then(code => {
        if (findCountry(code) && code !== selected) {
          selected = code;
          emit();
        }
      })
      .catch(() => {});
  }
  return loaded;
};

/** The picked country code, or null when none has been picked on this phone. */
export const getSelectedCountry = async () => {
  await ensureLoaded();
  return selected;
};

/** Stores the country on this phone; returns false for a code not in the list. */
export const setSelectedCountry = async code => {
  if (!findCountry(code)) return false;
  await ensureLoaded();
  selected = code;
  await AsyncStorage.setItem(STORAGE_KEY, code);
  emit();
  return true;
};

/** fn(code) runs whenever the picked country changes. */
export const onCountryChange = fn => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** The picked country code (or null), kept up to date. */
export const useSelectedCountry = () => {
  const [code, setCode] = useState(selected);
  useEffect(() => {
    ensureLoaded().then(() => setCode(selected));
    return onCountryChange(setCode);
  }, []);
  return code;
};
