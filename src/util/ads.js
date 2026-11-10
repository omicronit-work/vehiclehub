import { useEffect, useState, useSyncExternalStore } from 'react';
import mobileAds, { AdsConsent, MaxAdContentRating, TestIds } from 'react-native-google-mobile-ads';

// Debug builds always load Google's test unit — clicking or loading real ads
// from a dev device can get the AdMob account flagged.
export const BANNER_AD_UNIT_ID = __DEV__
  ? TestIds.BANNER
  : 'ca-app-pub-5825964885430731/4754058174';

// Native ad unit: Google sends the text, icon and button, and the app draws
// them in its own theme, so dark mode never gets a bright white strip (a
// banner is a finished picture that may not be recoloured or covered).
// Release builds need a "Native advanced" unit from the AdMob console here;
// until one is set they fall back to the banner above in light mode, and show
// no ad in dark mode (see AdBanner).
const NATIVE_RELEASE_UNIT_ID = null; // e.g. 'ca-app-pub-5825964885430731/XXXXXXXXXX'
export const NATIVE_AD_UNIT_ID = __DEV__ ? TestIds.NATIVE : NATIVE_RELEASE_UNIT_ID;

// Consent (UMP / GDPR) must be gathered before the SDK starts or any ad is
// requested. Runs once per launch; every caller shares the same promise.
let initPromise = null;

export const initAds = () => {
  if (!initPromise) {
    initPromise = (async () => {
      try {
        await AdsConsent.gatherConsent();
      } catch (err) {
        // Form failed to load (offline etc.) — fall back to whatever consent
        // state was stored on a previous launch.
        console.log('Ad consent error:', err);
      }
      const { canRequestAds } = await AdsConsent.getConsentInfo();
      if (!canRequestAds) return false;
      // Family-safe ads only (rating G). Blocking the "account creation" /
      // sensitive categories is done in the AdMob console (Blocking controls),
      // it can't be set from the app.
      await mobileAds().setRequestConfiguration({
        maxAdContentRating: MaxAdContentRating.G,
      });
      await mobileAds().initialize();
      return true;
    })().catch(err => {
      console.log('Ads init failed:', err);
      return false;
    });
  }
  return initPromise;
};

// null while consent / SDK start is still running, then true or false.
let adsState = null;

export const useAdsState = () => {
  const [state, setState] = useState(adsState);
  useEffect(() => {
    let mounted = true;
    initAds().then(ok => {
      adsState = ok;
      if (mounted) setState(ok);
    });
    return () => { mounted = false; };
  }, []);
  return state;
};

export const useAdsReady = () => useAdsState() === true;

// Ads stay on list screens only: while any sheet or dialog is open, the
// tab-bar banner collapses so nothing sits next to a form or a confirm button.
let openSheets = 0;
const sheetListeners = new Set();
const notifySheets = () => sheetListeners.forEach(l => l());

export const useHideAdsWhile = (visible) => {
  useEffect(() => {
    if (!visible) return undefined;
    openSheets += 1;
    notifySheets();
    return () => {
      openSheets -= 1;
      notifySheets();
    };
  }, [visible]);
};

const subscribeSheets = (listener) => {
  sheetListeners.add(listener);
  return () => sheetListeners.delete(listener);
};

export const useSheetOpen = () =>
  useSyncExternalStore(subscribeSheets, () => openSheets > 0);
