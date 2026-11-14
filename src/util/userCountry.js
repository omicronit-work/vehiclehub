import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { timezoneCountry } from './timezoneCountry';

// The country the user is in. Drives the local fuel names and the automatic
// currency. Taken from the phone's time zone (Asia/Dhaka -> Bangladesh): no
// permission, works offline. Location/GPS is not used.

let country = null; // ISO code, e.g. 'BD'
let loaded = null;
const listeners = new Set();

// Older builds cached a GPS result and permission state; nothing reads them now.
const LEGACY_KEYS = ['userCountry', 'locationBlocked', 'locationPromptShown'];

const ensureLoaded = () => {
  if (!loaded) {
    loaded = (async () => {
      AsyncStorage.multiRemove(LEGACY_KEYS).catch(() => {});
      const tz = timezoneCountry();
      if (tz?.code && tz.code !== country) {
        country = tz.code;
        listeners.forEach(fn => fn(country));
      }
    })();
  }
  return loaded;
};

export const getCountry = () => country;

// Resolves once the time-zone country has been applied.
export const whenCountryKnown = () => ensureLoaded();

// fn(code) runs whenever the country changes.
export const subscribeCountry = fn => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

// The current country (or null).
export const useCountry = () => {
  const [code, setCode] = useState(country);
  useEffect(() => {
    ensureLoaded().then(() => setCode(country));
    return subscribeCountry(setCode);
  }, []);
  return code;
};
