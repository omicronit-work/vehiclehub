import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  setDoc,
  serverTimestamp,
} from '@react-native-firebase/firestore';

// Vehicle brand list for the Add/Edit vehicle autocomplete: the shared
// `brands` collection plus brands this user added on this phone.
// Firestore accepts either one doc per brand (`name` field, or the doc id) or
// docs holding an array of names.
// Only a non-empty remote result is cached for the session: an empty or failed
// read (offline, not signed in yet, rules not deployed) is retried the next
// time a vehicle modal opens instead of sticking until the app restarts.
const CUSTOM_BRANDS_KEY = 'customBrands';

let remoteBrands = null;
let customBrands = null;
let inflight = null;
const listeners = new Set();

const merge = () => {
  const seen = new Set();
  return [...(remoteBrands || []), ...(customBrands || [])]
    .filter(name => {
      const k = name.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => a.localeCompare(b));
};

const notify = () => {
  const list = merge();
  listeners.forEach(fn => fn(list));
};

const namesFromDoc = doc => {
  const data = doc.data() || {};
  const list = Object.values(data).find(Array.isArray);
  if (list) return list;
  return [data.name ?? doc.id];
};

const loadCustomBrands = async () => {
  if (customBrands) return;
  try {
    const raw = await AsyncStorage.getItem(CUSTOM_BRANDS_KEY);
    customBrands = raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.log('Error reading custom brands:', err);
    customBrands = [];
  }
};

const loadRemoteBrands = () => {
  if (remoteBrands) return Promise.resolve();
  if (!inflight) {
    inflight = getDocs(collection(getFirestore(), 'brands'))
      .then(snapshot => {
        const names = snapshot.docs
          .flatMap(namesFromDoc)
          .map(n => String(n ?? '').trim())
          .filter(Boolean);
        if (names.length) remoteBrands = names;
      })
      .catch(err => console.log('Error fetching brands:', err))
      .finally(() => { inflight = null; });
  }
  return inflight;
};

const loadBrands = async () => {
  await Promise.all([loadCustomBrands(), loadRemoteBrands()]);
  return merge();
};

// "Lynk & Co" → "lynk & co". Firestore ids can't contain "/". Used for
// `log` and `models` doc ids; mirrored in firestore.rules (match /log/{docId}).
export const catalogId = name => name.toLowerCase().replace(/\//g, '-');

// A brand missing from the list: kept on this phone so it shows up in future
// suggestions, and logged to Firestore `log` so it can be reviewed and added
// to the shared list. Logged once per phone per brand.
export const addCustomBrand = async (name) => {
  const brand = String(name ?? '').trim().replace(/\s+/g, ' ');
  if (!brand) return;
  await loadCustomBrands();
  if (merge().some(b => b.toLowerCase() === brand.toLowerCase())) return;

  customBrands = [...customBrands, brand];
  notify();

  try {
    await AsyncStorage.setItem(CUSTOM_BRANDS_KEY, JSON.stringify(customBrands));
  } catch (err) {
    console.log('Error saving custom brand:', err);
  }

  // One doc per brand across all users: the id is the normalised name and the
  // rules only allow create, so a brand someone already logged is rejected
  // (permission-denied) instead of inserting a duplicate.
  setDoc(doc(getFirestore(), 'log', catalogId(brand)), {
    type: 'custom_brand',
    brand,
    platform: Platform.OS,
    createdAt: serverTimestamp(),
  }).catch(err => {
    if (err?.code === 'firestore/permission-denied') return; // already logged
    console.log('Error logging custom brand:', err);
  });
};

// `active`: pass the modal's visibility so the list (re)loads when it opens.
export const useBrands = (active = true) => {
  const [brands, setBrands] = useState(merge);

  useEffect(() => {
    listeners.add(setBrands);
    return () => { listeners.delete(setBrands); };
  }, []);

  useEffect(() => {
    if (!active) return undefined;
    let mounted = true;
    loadBrands().then(list => mounted && setBrands(list));
    return () => { mounted = false; };
  }, [active]);

  return brands;
};
