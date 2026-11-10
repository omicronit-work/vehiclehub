import { useEffect, useState } from 'react';
import { AppState, Linking, PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { timezoneCountry } from './timezoneCountry';

// The country the user is in. Drives the local fuel names and the automatic
// currency.
//   1. GPS (same approach as Daily Salah), re-checked on every app resume and
//      whenever the fuel form opens, so moving country is picked up at once.
//   2. Until GPS answers, or if location is off/denied: the phone's time zone
//      (Asia/Dhaka -> Bangladesh). No permission needed and works offline.

// Loaded lazily and guarded: if the native module isn't in this build (e.g. an
// old APK), callers just fall back to the time zone instead of crashing.
// LocationManager provider, not Play Services: the Play Services provider in
// geolocation 3.4.0 crashes on overlapping requests and ignores `timeout`.
// The LocationManager provider gives each request its own listener.
// We ask for permission ourselves, so the library must not.
let geo; // undefined = not tried yet, null = unavailable
const getGeolocation = () => {
  if (geo !== undefined) return geo;
  try {
    geo = require('@react-native-community/geolocation').default;
    geo.setRNConfiguration({
      skipPermissionRequests: true,
      locationProvider: 'android',
      enableBackgroundLocationUpdates: false,
    });
  } catch (e) {
    console.warn('Geolocation unavailable:', e?.message || e);
    geo = null;
  }
  return geo;
};

const CACHE_KEY = 'userCountry';      // { code, name, lat, lon, at } from the last GPS lookup
const MIN_CHECK_MS = 60 * 1000;       // don't re-run GPS more than once a minute
const SAME_PLACE_KM = 25;             // moved less than this: same country, skip the lookup

// ─── State ──────────────────────────────────────────────────────

let country = null;     // ISO code, e.g. 'BD'
let countryName = '';   // e.g. 'Bangladesh'
let source = null;      // 'gps' | 'timezone'
let locating = false;   // a GPS check is running
let lastCheck = 0;
let lastFix = null;     // { lat, lon } of the last successful lookup
let loaded = null;      // promise: cache + time zone applied
let inFlight = null;
const listeners = new Set();
const statusListeners = new Set();

export const getCountry = () => country;

// Resolves once the saved/time-zone country has been applied.
export const whenCountryKnown = () => ensureLoaded();

// fn(code) runs whenever the country changes.
export const subscribeCountry = fn => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

const publish = (code, name, from) => {
  if (!code) return;
  if (name) countryName = name;
  source = from;
  if (code === country) return;
  country = code;
  listeners.forEach(fn => fn(code));
};

const setLocating = value => {
  if (locating === value) return;
  locating = value;
  statusListeners.forEach(fn => fn(value));
};

// Last GPS country, else the time zone's country — available immediately.
const ensureLoaded = () => {
  if (!loaded) {
    loaded = (async () => {
      try {
        const cached = JSON.parse((await AsyncStorage.getItem(CACHE_KEY)) || 'null');
        if (cached?.code) {
          if (cached.lat != null) lastFix = { lat: cached.lat, lon: cached.lon };
          publish(cached.code, cached.name, 'gps');
          return;
        }
      } catch {}
      const tz = timezoneCountry();
      if (tz) publish(tz.code, tz.name, 'timezone');
    })();
  }
  return loaded;
};

// ─── Helpers ────────────────────────────────────────────────────

const withTimeout = (promise, ms, what) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${what} timed out`)), ms)),
  ]);

const getPosition = options =>
  withTimeout(
    new Promise((resolve, reject) => getGeolocation().getCurrentPosition(resolve, reject, options)),
    options.timeout + 2000,
    'Location',
  );

const distanceKm = (a, b) => {
  const rad = d => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

// Only the country is needed, so zoom=3 is plenty.
const countryAt = async (lat, lon) => {
  const res = await withTimeout(
    fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=3&addressdetails=1&accept-language=en`,
      { headers: { 'User-Agent': 'VehicleHubApp/1.0' } },
    ),
    10000,
    'Country lookup',
  );
  const data = await res.json();
  const code = data?.address?.country_code?.toUpperCase();
  return code ? { code, name: data.address.country || '' } : null;
};

// 'TH' -> '🇹🇭' (regional indicator letters).
export const countryFlag = code =>
  /^[A-Z]{2}$/.test(code || '')
    ? String.fromCodePoint(...[...code].map(c => 0x1f1e6 + c.charCodeAt(0) - 65))
    : '';

// Display name for a country code.
export const countryNameOf = code => {
  if (!code) return '';
  if (code === country && countryName) return countryName;
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) || code;
  } catch {
    return code;
  }
};

// ─── Permission ─────────────────────────────────────────────────
// Both are requested, like Daily Salah: Android then lets the user choose
// "Precise" or "Approximate". Approximate works where a network location
// provider exists; GPS-only devices need precise.
const { ACCESS_FINE_LOCATION: FINE, ACCESS_COARSE_LOCATION: COARSE } = PermissionsAndroid.PERMISSIONS;
const BLOCKED_KEY = 'locationBlocked'; // Android won't show its dialog again

const isGranted = async () =>
  Platform.OS === 'android' &&
  ((await PermissionsAndroid.check(FINE)) || (await PermissionsAndroid.check(COARSE)));

// One system dialog at a time, however many callers ask.
let requesting = null;
const requestPermission = () => {
  if (!requesting) {
    requesting = (async () => {
      try {
        const result = await PermissionsAndroid.requestMultiple([FINE, COARSE]);
        const values = [result[FINE], result[COARSE]];
        if (values.includes(PermissionsAndroid.RESULTS.GRANTED)) {
          await AsyncStorage.removeItem(BLOCKED_KEY);
          return true;
        }
        if (values.includes(PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN)) {
          await AsyncStorage.setItem(BLOCKED_KEY, '1');
        }
        return false;
      } finally {
        requesting = null;
      }
    })();
  }
  return requesting;
};

// For an explicit user action (Settings > Currency > Automatic): ask if
// Android still allows it, otherwise open the app's settings page.
export const askForLocation = async () => {
  if (Platform.OS !== 'android' || !getGeolocation()) return false;
  if (await isGranted()) return true;
  if (await AsyncStorage.getItem(BLOCKED_KEY)) {
    Linking.openSettings();
    return false;
  }
  return requestPermission();
};

// ─── First launch ───────────────────────────────────────────────
// Android's own location dialog is shown once per install, on first launch,
// with no extra popup of ours before it. Nothing else asks on its own.
// Other first-launch prompts (notifications) wait for it so dialogs never stack.
const PROMPT_KEY = 'locationPromptShown';
let settle;
const settled = new Promise(resolve => { settle = resolve; });
export const waitForLocationPrompt = () => settled;

const askOnFirstLaunch = async () => {
  try {
    if (Platform.OS !== 'android' || !getGeolocation()) return;
    if (await AsyncStorage.getItem(PROMPT_KEY)) return;
    await AsyncStorage.setItem(PROMPT_KEY, '1'); // before asking: never twice
    if (!(await isGranted())) await requestPermission();
  } catch (e) {
    console.warn('Location permission request failed', e?.message || e);
  } finally {
    settle();
  }
};

// ─── Detection ──────────────────────────────────────────────────

const checkGps = async () => {
  if (!getGeolocation() || !(await isGranted())) return;
  setLocating(true);
  try {
    let pos;
    try {
      // Network fix: fast, works indoors. Fresh fixes only (max 10 s old):
      // an older cached fix would hide a move or a changed test location.
      pos = await getPosition({ enableHighAccuracy: false, timeout: 8000, maximumAge: 10000 });
    } catch {
      // No network provider (or no fix): satellite GPS.
      pos = await getPosition({ enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 });
    }
    const here = { lat: pos.coords.latitude, lon: pos.coords.longitude };
    if (source === 'gps' && lastFix && distanceKm(lastFix, here) < SAME_PLACE_KM) return;

    const found = await countryAt(here.lat, here.lon);
    if (!found) return;
    lastFix = here;
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ ...found, ...here, at: Date.now() }));
    publish(found.code, found.name, 'gps');
  } finally {
    setLocating(false);
  }
};

// Publishes the best known country at once, then re-checks GPS.
// `force` skips the once-a-minute limit (e.g. right after permission is granted).
export const refreshCountry = ({ force = false } = {}) => {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      await ensureLoaded();
      if (!force && Date.now() - lastCheck < MIN_CHECK_MS) return;
      lastCheck = Date.now();
      await checkGps();
    } catch (e) {
      console.warn('Country lookup failed, keeping', country, e?.message || e);
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
};

// The current country (or null). Pass `active` to re-check whenever it
// turns true, e.g. a modal's `visible`.
export const useCountry = active => {
  const [code, setCode] = useState(country);
  useEffect(() => {
    ensureLoaded().then(() => setCode(country));
    return subscribeCountry(setCode);
  }, []);
  useEffect(() => {
    if (active) refreshCountry();
  }, [active]);
  return code;
};

// True while a GPS check is running.
export const useLocating = () => {
  const [value, setValue] = useState(locating);
  useEffect(() => {
    statusListeners.add(setValue);
    setValue(locating);
    return () => statusListeners.delete(setValue);
  }, []);
  return value;
};

// Mounted once in App.jsx. `ready` turns true when the splash is gone: asks
// for location the first time, detects the country, and re-checks whenever
// the app returns to the foreground (travel, or a changed test location).
export const useCountryDetection = ready => {
  useEffect(() => {
    if (!ready) return undefined;
    askOnFirstLaunch().then(() => refreshCountry({ force: true }));
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') refreshCountry({ force: true });
    });
    return () => sub.remove();
  }, [ready]);
};
