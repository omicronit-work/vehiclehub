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

// Suggestion lists for service detail fields (tire brands, tire sizes, oil
// grades…): the shared `serviceOptions/{list}` doc (`options` array) plus
// values this user added on this phone. Each field names its list via
// `suggest` in util/serviceFields.js. Same caching rules as useBrands — only
// a non-empty remote result is kept for the session.
const CUSTOM_OPTIONS_KEY = 'customServiceOptions';

const remoteOptions = {}; // list → string[]
const inflight = {};
let customOptions = null; // list → string[]
const listeners = new Set();

const merge = list => {
  const seen = new Set();
  return [...(remoteOptions[list] || []), ...(customOptions?.[list] || [])]
    .filter(name => {
      const k = name.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
};

const loadCustomOptions = async () => {
  if (customOptions) return;
  try {
    const raw = await AsyncStorage.getItem(CUSTOM_OPTIONS_KEY);
    customOptions = raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.log('Error reading custom service options:', err);
    customOptions = {};
  }
};

const loadRemoteOptions = list => {
  if (remoteOptions[list]) return Promise.resolve();
  if (!inflight[list]) {
    inflight[list] = getDoc(doc(getFirestore(), 'serviceOptions', list))
      .then(snap => {
        const names = (snap.data()?.options || [])
          .map(n => String(n ?? '').trim())
          .filter(Boolean);
        if (names.length) remoteOptions[list] = names;
      })
      .catch(err => console.log('Error fetching service options:', err))
      .finally(() => { delete inflight[list]; });
  }
  return inflight[list];
};

// A value missing from the list: kept on this phone so it shows up in future
// suggestions, and recorded in Firestore `serviceOptionLog` (auto id — the
// same value reported by several users is kept as separate entries).
// meta: { service, field, parent (e.g. the tire brand for a tire model) }
export const addCustomServiceOption = async (list, valueText, meta = {}) => {
  const value = String(valueText ?? '').trim().replace(/\s+/g, ' ');
  if (!list || !value) return;
  await loadCustomOptions();
  if (merge(list).some(v => v.toLowerCase() === value.toLowerCase())) return;

  customOptions = { ...customOptions, [list]: [...(customOptions[list] || []), value] };
  listeners.forEach(fn => fn(list));

  try {
    await AsyncStorage.setItem(CUSTOM_OPTIONS_KEY, JSON.stringify(customOptions));
  } catch (err) {
    console.log('Error saving custom service option:', err);
  }

  addDoc(collection(getFirestore(), 'serviceOptionLog'), {
    list,
    value,
    service: meta.service || null,
    field: meta.field || null,
    parent: meta.parent || null,
    platform: Platform.OS,
    createdAt: serverTimestamp(),
  }).catch(err => console.log('Error logging custom service option:', err));
};

// Options for `list`; `active` (the field is focused) triggers the load, so
// a list is only fetched once someone actually uses that field.
export const useServiceOptions = (list, active = true) => {
  const [options, setOptions] = useState(() => (list ? merge(list) : []));

  useEffect(() => {
    const onChange = changed => changed === list && setOptions(merge(list));
    listeners.add(onChange);
    return () => { listeners.delete(onChange); };
  }, [list]);

  useEffect(() => {
    if (!list || !active) return undefined;
    let mounted = true;
    Promise.all([loadCustomOptions(), loadRemoteOptions(list)])
      .then(() => mounted && setOptions(merge(list)));
    return () => { mounted = false; };
  }, [list, active]);

  return options;
};
