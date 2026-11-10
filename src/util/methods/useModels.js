import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  addDoc,
  serverTimestamp,
} from '@react-native-firebase/firestore';
import { catalogId } from './useBrands';

// Model list for the Add/Edit vehicle autocomplete, per brand: the shared
// `models/{brandId}` doc (`models` array) plus models this user added on this
// phone. Same caching rules as useBrands — only a non-empty remote result is
// kept for the session, so a failed read retries on the next modal open.
const CUSTOM_MODELS_KEY = 'customModels';

const remoteModels = {}; // brandId → string[]
const inflight = {};
let customModels = null; // brandId → string[]
const listeners = new Set();

const merge = brandId => {
  const seen = new Set();
  return [...(remoteModels[brandId] || []), ...(customModels?.[brandId] || [])]
    .filter(name => {
      const k = name.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
};

const loadCustomModels = async () => {
  if (customModels) return;
  try {
    const raw = await AsyncStorage.getItem(CUSTOM_MODELS_KEY);
    customModels = raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.log('Error reading custom models:', err);
    customModels = {};
  }
};

const loadRemoteModels = brandId => {
  if (remoteModels[brandId]) return Promise.resolve();
  if (!inflight[brandId]) {
    inflight[brandId] = getDoc(doc(getFirestore(), 'models', brandId))
      .then(snap => {
        const names = (snap.data()?.models || [])
          .map(n => String(n ?? '').trim())
          .filter(Boolean);
        if (names.length) remoteModels[brandId] = names;
      })
      .catch(err => console.log('Error fetching models:', err))
      .finally(() => { delete inflight[brandId]; });
  }
  return inflight[brandId];
};

// A model missing from the brand's list: kept on this phone so it shows up in
// future suggestions, and recorded in Firestore `modelLog` (auto id — the same
// model reported by several users is kept as separate entries).
export const addCustomModel = async (brandName, modelName) => {
  const brand = String(brandName ?? '').trim().replace(/\s+/g, ' ');
  const model = String(modelName ?? '').trim().replace(/\s+/g, ' ');
  if (!brand || !model) return;
  const brandId = catalogId(brand);
  await loadCustomModels();
  if (merge(brandId).some(m => m.toLowerCase() === model.toLowerCase())) return;

  customModels = { ...customModels, [brandId]: [...(customModels[brandId] || []), model] };
  listeners.forEach(fn => fn(brandId));

  try {
    await AsyncStorage.setItem(CUSTOM_MODELS_KEY, JSON.stringify(customModels));
  } catch (err) {
    console.log('Error saving custom model:', err);
  }

  addDoc(collection(getFirestore(), 'modelLog'), {
    brand,
    model,
    platform: Platform.OS,
    createdAt: serverTimestamp(),
  }).catch(err => console.log('Error logging custom model:', err));
};

// Models for `brand`; `active` is the modal's visibility so the list
// (re)loads when it opens. Empty until a brand is entered.
export const useModels = (brand, active = true) => {
  const brandId = catalogId(String(brand ?? '').trim().replace(/\s+/g, ' '));
  const [models, setModels] = useState(() => (brandId ? merge(brandId) : []));

  useEffect(() => {
    const onChange = changed => changed === brandId && setModels(merge(brandId));
    listeners.add(onChange);
    return () => { listeners.delete(onChange); };
  }, [brandId]);

  useEffect(() => {
    if (!brandId) {
      setModels([]);
      return undefined;
    }
    setModels(merge(brandId));
    if (!active) return undefined;
    let mounted = true;
    Promise.all([loadCustomModels(), loadRemoteModels(brandId)])
      .then(() => mounted && setModels(merge(brandId)));
    return () => { mounted = false; };
  }, [brandId, active]);

  return models;
};
