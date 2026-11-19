import { getFirestore, collection, doc, getDoc, getDocsFromCache } from '@react-native-firebase/firestore';
import { markSupersededDocuments, markSupersededServices } from '../util/dateStatus.js';
import { readDoc, readDocs } from '../util/fastRead';

// Reads go through util/fastRead: the phone's copy at once, the server in
// the background (screens refresh when it brings changes).

// The phone's copy of the profile can be partial: a setting saved with a
// merge (language / country / currency) before the profile was ever loaded
// leaves just `{ language: 'bn' }` in the cache. A full profile always has
// `email` (saveUserToFirestore), so without it the server is asked.
export const fetchUserByEmail = async (email) => {
  const ref = doc(getFirestore(), 'users', email);
  const snap = await readDoc(ref);
  const data = snap.exists() ? snap.data() : null;
  if (data?.email) return data;
  try {
    const fresh = await getDoc(ref);
    return fresh.exists() ? fresh.data() : data;
  } catch {
    return data; // offline: what the phone has
  }
};

// Redux state must be serializable, so Firestore Timestamps / Dates become
// epoch millis (toMillis() in util/dateStatus reads them back).
export const toPlain = (value) => {
  if (value == null || typeof value !== 'object') return value;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (Array.isArray(value)) return value.map(toPlain);
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toPlain(v)]));
};

// The vehicles as last synced to this phone (Firestore's offline cache), with
// no network wait — for showing the garage at once. null when nothing is
// cached yet (first launch) or the cache can't be read.
export const fetchCachedVehiclesByEmail = async (email) => {
  try {
    const snapshot = await getDocsFromCache(collection(getFirestore(), 'users', email, 'vehicles'));
    if (snapshot.empty) return null;
    return snapshot.docs.map(d => ({ id: d.id, ...toPlain(d.data()) }));
  } catch {
    return null;
  }
};

export const fetchVehicleByEmail = async (email) => {
  const snapshot = await readDocs(collection(getFirestore(), 'users', email, 'vehicles'));
  return snapshot.docs.map(d => ({ id: d.id, ...toPlain(d.data()) }));
};

const records = async (email, id, name) => {
  const snapshot = await readDocs(collection(getFirestore(), 'users', email, 'vehicles', id, name));
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const fetchServicesByid = async (email, id) => markSupersededServices(await records(email, id, 'services'));

export const fetchDocumentssByid = async (email, id) => markSupersededDocuments(await records(email, id, 'documents'));

export const fetchFuelLogsById = (email, id) => records(email, id, 'fuelLogs');

export const fetchServicesFromFirestore = async () => {
  try {
    const snap = await getDoc(doc(getFirestore(), 'service', 'service_list'));
    if (!snap.exists()) {
      console.log('No service data found');
      return [];
    }
    const services = snap.data()?.services || [];
    return services.map(item => ({
      id: item.id,
      name: item.name,
      extraFields: item.extraFields || [],
    }));
  } catch (error) {
    console.error('Error fetching services:', error);
    return [];
  }
};
