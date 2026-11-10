import { getFirestore, collection, doc, getDoc, getDocs, getDocsFromCache } from '@react-native-firebase/firestore';
import { markSupersededServices } from '../util/dateStatus.js';

export const fetchUserByEmail = async (email) => {
  const snap = await getDoc(doc(getFirestore(), 'users', email));

  if (snap.exists()) {
    return snap.data();
  } else {
    return null;
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
  const snapshot = await getDocs(collection(getFirestore(), 'users', email, 'vehicles'));

  if (!snapshot.empty) {
    return snapshot.docs.map(d => ({
      id: d.id,
      ...toPlain(d.data()),
    }));
  } else {
    return [];
  }
};

export const fetchServicesByid = async (email, id) => {
  const snapshot = await getDocs(collection(getFirestore(), 'users', email, 'vehicles', id, 'services'));

  if (!snapshot.empty) {
    return markSupersededServices(snapshot.docs.map(d => ({
      id: d.id,
      ...d.data(),
    })));
  } else {
    return [];
  }
};


export const fetchDocumentssByid = async (email, id) => {
  const snapshot = await getDocs(collection(getFirestore(), 'users', email, 'vehicles', id, 'documents'));

  if (!snapshot.empty) {
    return snapshot.docs.map(d => ({
      id: d.id,
      ...d.data(),
    }));
  } else {
    return [];
  }
};


export const fetchFuelLogsById = async (email, id) => {
  const snapshot = await getDocs(collection(getFirestore(), 'users', email, 'vehicles', id, 'fuelLogs'));

  if (!snapshot.empty) {
    return snapshot.docs.map(d => ({
      id: d.id,
      ...d.data(),
    }));
  } else {
    return [];
  }
};


export const fetchServicesFromFirestore = async () => {
  try {
    const snap = await getDoc(doc(getFirestore(), 'service', 'service_list'));

    if (!snap.exists()) {
      console.log('No service data found');
      return [];
    }

    const data = snap.data();

    // Ensure safe fallback
    const services = data?.services || [];

    // Optional: normalize structure
    const formattedServices = services.map(item => ({
      id: item.id,
      name: item.name,
      extraFields: item.extraFields || [],
    }));

    return formattedServices;
  } catch (error) {
    console.error('Error fetching services:', error);
    return [];
  }
};