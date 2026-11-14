import { createSlice } from '@reduxjs/toolkit';
import { SERVICE_DETAIL_KEYS, getServiceCategory, resolveServiceType, serviceLabel } from '../util/serviceFields';
import { DOCUMENT_DETAIL_KEYS, resolveDocumentType } from '../util/documentFields';
import { EVENTS, track } from '../util/analytics';

// Only the app's own type names are sent to analytics; anything the user typed
// themselves is reported as "Custom".
const serviceTypeName = name => resolveServiceType(name)?.name || 'Custom';
const documentTypeName = name => resolveDocumentType(name)?.name || 'Custom';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocFromCache,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  deleteField,
} from '@react-native-firebase/firestore';
import { markSupersededServices, toMillis } from '../util/dateStatus.js';
import { computeFuelEfficiency, efficiencyUnit } from '../util/fuelEfficiency.js';
import { cancelReminder, reminderId, scheduleReminder, DEFAULT_REMINDER_DAYS } from '../util/notifications.js';
import { deleteImage } from '../util/imageStorage.js';
import { commit } from '../util/firestoreWrite.js';
import { syncVehicleSchedules, cancelRuleNotifications } from '../util/schedule/scheduleReminders.js';
import { BASE_CURRENCY } from '../util/fx.js';
import { t as tr } from '../i18n';
const initialState = {
  name: '',
  email: '',
  photo: '',
  termCondition:'',
  reload:false,

  userEmail:'',
  selectedCar:'',
  Trigger:false,
  profileVersion:0,
  // Bumped after any service / fuel cost is saved or deleted, so the
  // Dashboard refreshes its totals in the background.
  recordsVersion:0,

};

/* ──────────────────────────────────────────────────────────────────────────
   EXPENSE DASHBOARD AGGREGATION
   Categories are derived from the fixed service-type list (service.name).
   Anything not in the map falls into "Others" so nothing is silently dropped.
────────────────────────────────────────────────────────────────────────── */

// Each service type's category lives in util/serviceFields.js

// Order defines slice order + which color each gets in the dashboard
export const EXPENSE_CATEGORIES = ['Oil & fluids', 'Tyres & parts', 'Brakes', 'Servicing', 'Fuel', 'Others'];

const FUEL_CATEGORY_INDEX = EXPENSE_CATEGORIES.indexOf('Fuel');

const categorizeService = s => {
  const cat = getServiceCategory(s.name);
  return EXPENSE_CATEGORIES.indexOf(cat);
};

// Name a service is listed under inside its category: the built-in type's
// label ("oil change" → Engine oil refill), else what the user typed.
const serviceTypeLabel = name => {
  const typed = (name || '').trim();
  const type = resolveServiceType(typed);
  return (type ? serviceLabel(type.name) : typed) || tr('Unnamed service');
};

const vehiclesRef = email => collection(getFirestore(), 'users', email, 'vehicles');
// A vehicle's services / documents / fuelLogs subcollection, or one record in it.
// (RNFB's collection() needs a Firestore or DocumentReference parent, unlike
// the web SDK, so the path is built from the root.)
const recordsRef = (email, vehicleId, name) =>
  collection(getFirestore(), 'users', email, 'vehicles', vehicleId, name);
const recordRef = (email, vehicleId, name, recordId) =>
  doc(recordsRef(email, vehicleId, name), recordId);

const resolveVehicleIds = async (email, vehicleId) => {
  if (vehicleId) return [vehicleId];
  const vSnap = await getDocs(vehiclesRef(email));
  return vSnap.docs.map(d => d.id);
};

// Month (0-11) a record falls in when it belongs to `year`, else -1.
const monthInYear = (dateValue, year) => {
  const ms = toMillis(dateValue);
  if (ms === null) return -1;
  const d = new Date(ms);
  return d.getFullYear() === year ? d.getMonth() : -1;
};

// Adds one vehicle's monthly fuel economy for `year` into `economyByUnit`.
// Per-log efficiency comes from computeFuelEfficiency, kept per unit (km/L,
// km/kg, km/kWh) since they can't be averaged together. Only measured
// full-to-full stretches count; each is booked in the month it ended.
const accumulateFuelEconomy = (fuelLogs, year, economyByUnit) => {
  for (const log of computeFuelEfficiency(fuelLogs)) {
    if (log.efficiency == null) continue;
    const m = monthInYear(log.date || log.createdAt, year);
    if (m < 0) continue;
    const unit = efficiencyUnit(log.fuelType);
    if (!economyByUnit[unit]) {
      economyByUnit[unit] = { distance: Array(12).fill(0), qty: Array(12).fill(0), count: 0 };
    }
    economyByUnit[unit].distance[m] += log.tripDistance;
    economyByUnit[unit].qty[m] += log.tripQty;
    economyByUnit[unit].count += 1;
  }
};

// One vehicle's raw fuel logs and services, for the running-cost figures
// (util/runningCost.js does the maths). Amounts are in the app currency.
export const getVehicleCostRecords = async (email, vehicleId, { currency = BASE_CURRENCY } = {}) => {
  if (!email || !vehicleId) throw new Error('email and vehicleId are required');
  const [fSnap, sSnap] = await Promise.all([
    getDocs(recordsRef(email, vehicleId, 'fuelLogs')),
    getDocs(recordsRef(email, vehicleId, 'services')),
  ]);
  const fuel = { records: fSnap.docs.map(d => d.data()) };
  const svc = { records: sSnap.docs.map(d => d.data()) };
  return {
    fuelLogs: fuel.records,
    services: svc.records,
    currency,
  };
};

// Every vehicle's raw fuel logs and services (Dashboard "All vehicles"),
// one entry per vehicle, same currency handling as getVehicleCostRecords.
export const getAllVehiclesCostRecords = async (email, { currency = BASE_CURRENCY } = {}) => {
  if (!email) throw new Error('email is missing or empty');
  const ids = await resolveVehicleIds(email);
  const each = await Promise.all(ids.map(id => getVehicleCostRecords(email, id, { currency })));
  return {
    vehicles: each.map((r, i) => ({ id: ids[i], fuelLogs: r.fuelLogs, services: r.services })),
    currency,
  };
};

// Aggregate service + fuel costs by month and category for a single year,
// plus monthly fuel economy.
// vehicleId → that car only; omit → every vehicle the user owns.
// Every record counts; amounts are in the app currency (never converted).
export const getExpenseSummary = async (email, { vehicleId, year, currency = BASE_CURRENCY } = {}) => {
  if (!email) throw new Error('email is missing or empty');
  const targetYear = year ?? new Date().getFullYear();

  const vehicleIds = await resolveVehicleIds(email, vehicleId);

  const monthlyTotals = Array(12).fill(0);                                // line chart
  const categoryMonthly = EXPENSE_CATEGORIES.map(() => Array(12).fill(0)); // donut
  const economyByUnit = {};                                               // economy trend
  const typeRows = new Map(); // `${category}|${label}` → per-type monthly costs

  const addTypeCost = (ci, label, m, cost) => {
    const key = `${ci}|${label.toLowerCase()}`;
    if (!typeRows.has(key)) typeRows.set(key, { category: ci, label, monthly: Array(12).fill(0) });
    typeRows.get(key).monthly[m] += cost;
  };

  // Every vehicle's subcollections are fetched in parallel, not one car at a time.
  const snapshots = await Promise.all(vehicleIds.map(vId => Promise.all([
    getDocs(recordsRef(email, vId, 'services')),
    getDocs(recordsRef(email, vId, 'fuelLogs')),
  ])));

  for (const [sSnap, fSnap] of snapshots) {
    const svc = { records: sSnap.docs.map(d => d.data()) };
    const fuel = { records: fSnap.docs.map(d => d.data()) };

    svc.records.forEach(s => {
      const cost = Number(s.totalCost) || 0;
      if (!cost) return;

      // serviceDate is stored via new Date() → Firestore Timestamp
      const when = s.serviceDate?.toDate?.() || s.createdAt?.toDate?.() || null;
      if (!when || when.getFullYear() !== targetYear) return;

      const m = when.getMonth();
      monthlyTotals[m] += cost;
      const ci = categorizeService(s);
      categoryMonthly[ci][m] += cost;
      addTypeCost(ci, serviceTypeLabel(s.name), m, cost);
    });

    fuel.records.forEach(f => {
      const cost = Number(f.totalCost) || 0;
      if (!cost) return;

      const when = f.date?.toDate?.() || f.createdAt?.toDate?.() || null;
      if (!when || when.getFullYear() !== targetYear) return;

      const m = when.getMonth();
      monthlyTotals[m] += cost;
      categoryMonthly[FUEL_CATEGORY_INDEX][m] += cost;
      addTypeCost(FUEL_CATEGORY_INDEX, f.fuelName || f.fuelType || tr('Fuel'), m, cost);
    });

    accumulateFuelEconomy(
      fSnap.docs.map(d => d.data()),
      targetYear,
      economyByUnit,
    );
  }

  // With mixed fuel types (e.g. "All vehicles" with a petrol car and an EV)
  // the trend follows the unit with the most logs; the rest are left out.
  const units = Object.keys(economyByUnit).sort(
    (a, b) => economyByUnit[b].count - economyByUnit[a].count,
  );
  const economy = economyByUnit[units[0]];
  const economyMonthly = economy
    ? economy.distance.map((d, i) => (economy.qty[i] > 0 ? d / economy.qty[i] : null))
    : Array(12).fill(null);
  const economyQty = economy ? economy.qty.reduce((a, b) => a + b, 0) : 0;
  const economyAverage = economyQty > 0
    ? economy.distance.reduce((a, b) => a + b, 0) / economyQty
    : null;

  return {
    year: targetYear,
    currency,
    monthlyTotals,
    categoryMonthly,
    // Each category's individual service / fuel types, for the legend drill-down.
    typeMonthly: [...typeRows.values()],
    categories: EXPENSE_CATEGORIES,
    economyMonthly,
    economyAverage,
    economyUnit: units[0] || null,
    economyMixedUnits: units.length > 1,
  };
};

/* ──────────────────────────────────────────────────────────────────────────
   UPCOMING REMINDERS
   Pulls services (by nextServiceDate) and documents (by expiryDate) that are
   overdue or due within `withinDays`, across one vehicle or all of them.
────────────────────────────────────────────────────────────────────────── */
export const getUpcomingReminders = async (email, { vehicleId, withinDays = 30 } = {}) => {
  if (!email) throw new Error('email is missing or empty');

  const vehicleIds = await resolveVehicleIds(email, vehicleId);

  const horizon = new Date(Date.now() + withinDays * 24 * 60 * 60 * 1000);
  const items = [];

  const snapshots = await Promise.all(vehicleIds.map(vId => Promise.all([
    getDocs(recordsRef(email, vId, 'services')),
    getDocs(recordsRef(email, vId, 'documents')),
  ])));

  snapshots.forEach(([sSnap, dSnap], i) => {
    const vId = vehicleIds[i];

    const services = markSupersededServices(sSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    services.forEach(s => {
      if (s.superseded) return;
      const due = s.nextServiceDate?.toDate?.();
      if (!due || due > horizon) return;
      items.push({ id: s.id, vehicleId: vId, kind: 'service', title: serviceLabel(s.name) || tr('Service'), dueDate: due });
    });

    dSnap.forEach(doc => {
      const d = doc.data();
      const due = d.expiryDate?.toDate?.();
      if (!due || due > horizon) return;
      items.push({ id: doc.id, vehicleId: vId, kind: 'document', title: d.documentName || tr('Document'), dueDate: due });
    });
  });

  items.sort((a, b) => a.dueDate - b.dueDate);
  return items;
};


// Every service/document the user asked to be reminded about whose due date
// is still ahead — the input for rebuilding device reminders after sign-in.
export const getReminderRecords = async (email) => {
  if (!email) throw new Error('email is missing or empty');

  const vehicleIds = await resolveVehicleIds(email);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const records = [];

  const snapshots = await Promise.all(vehicleIds.map(vId => Promise.all([
    getDocs(recordsRef(email, vId, 'services')),
    getDocs(recordsRef(email, vId, 'documents')),
  ])));

  snapshots.forEach(([sSnap, dSnap]) => {
    const services = markSupersededServices(sSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    services.forEach(s => {
      if (s.superseded || !s.remindMe) return;
      const due = s.nextServiceDate?.toDate?.();
      if (!due || due < startOfToday) return;
      records.push({
        id: s.id,
        kind: 'service',
        subject: s.name || tr('Service'),
        body: s.workshopName ? tr('At {0}', { 0: s.workshopName }) : tr('Next service reminder.'),
        dueDate: due,
      });
    });

    dSnap.forEach(doc => {
      const d = doc.data();
      if (!d.remindMe) return;
      const due = d.expiryDate?.toDate?.();
      if (!due || due < startOfToday) return;
      records.push({
        id: doc.id,
        kind: 'document',
        subject: d.documentName || tr('Document'),
        body: tr('Renew it before it expires.'),
        dueDate: due,
        daysBefore: d.reminderDays,
      });
    });
  });

  return records;
};

// SAVE USER
// Passwords are never stored here — Firebase Auth owns them. Every write also
// strips the `pass` field older app versions saved in plaintext.
export const saveUserToFirestore = async (user) => {
  const { email, name, photo, termCondition } = user;

  await setDoc(
    doc(getFirestore(), 'users', email),
    {
      name: name || '',
      email,
      photo: photo || '',
      termCondition: !!termCondition,
      pass: deleteField(),
    },
    { merge: true },
  );
};

// ─── App currency on the account ─────────────────────────────────
// Saved on the profile (users/{email}.currency, a code like "INR") so it
// follows the account to every phone and sign-in method.

// The account's saved currency code, or null when it has never picked one.
// Throws when the profile can't be read (offline with nothing cached).
export const getUserCurrency = async (email) => {
  if (!email) return null;
  const snap = await getDoc(doc(getFirestore(), 'users', email));
  const code = snap.exists() ? snap.data()?.currency : null;
  return typeof code === 'string' && code ? code : null;
};

export const saveUserCurrency = async (email, code) => {
  if (!email || !code) return;
  await setDoc(doc(getFirestore(), 'users', email), { currency: code }, { merge: true });
};

// Called on every Google sign-in: creates the profile the first time, but
// never overwrites a name/photo/terms choice the user has since changed.
export const ensureUserDocument = async (user) => {
  const ref = doc(getFirestore(), 'users', user.email);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    if (snap.data()?.pass !== undefined) {
      await updateDoc(ref, { pass: deleteField() });
    }
    return snap.data();
  }
  await saveUserToFirestore(user);
  return user;
};




export const saveServicesToFirestore = async (servicesArray) => {
  try {
    await setDoc(doc(getFirestore(), 'service', 'service_list'), {
      services: servicesArray,
    });

    return { success: true };
  } catch (error) {
    console.error('Error saving services:', error);
    return { success: false, error };
  }
};


const normalize = v => String(v ?? '').trim().toLowerCase();

// Same brand + model + year (case/whitespace-insensitive) counts as a
// duplicate; two cars of the same model from different years do not.
const findDuplicateVehicle = async (email, vehicle, excludeId) => {
  const snap = await getDocs(vehiclesRef(email));
  return snap.docs.find(d => {
    if (d.id === excludeId) return false;
    const v = d.data();
    return normalize(v.brand) === normalize(vehicle.brand)
      && normalize(v.model) === normalize(vehicle.model)
      && normalize(v.year) === normalize(vehicle.year);
  });
};

// ADD USER VEHICLE (with duplicate check)
export const addUserVehicle = async (email, vehicle) => {
  try {
    if (await findDuplicateVehicle(email, vehicle)) {
      return { success: false, message: tr('This vehicle already exists.') };
    }

    // Add new vehicle if no duplicate found
    const docRef = doc(vehiclesRef(email));
    commit(setDoc(docRef, {
    brand: vehicle.brand,
    model: vehicle.model,
    year: vehicle.year,
    currentOdometer: Number(vehicle.currentOdometer) || 0,
    // Starting point for service schedules (util/schedule): the reading the
    // vehicle was added with, which currentOdometer later moves away from.
    initialOdometer: Number(vehicle.currentOdometer) || 0,
    imageUrl: vehicle.imageUrl || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }), 'Add vehicle');

    track(EVENTS.VEHICLE_ADDED, { brand: vehicle.brand, has_photo: !!vehicle.imageUrl });
    return { success: true, id: docRef.id, message: tr('Vehicle added successfully!') };

  } catch (error) {
    console.error('Error adding vehicle to Firestore:', error);
    throw error;
  }
};


// Raises the vehicle's stored odometer reading, never lowers it — a service
// or fuel log entered with an older/lower mileage (e.g. backfilling history)
// shouldn't roll back what "due in X km" alerts compare against.
export const bumpVehicleOdometer = async (email, vehicleId, mileage) => {
  const reading = Number(mileage);
  if (!email || !vehicleId || !Number.isFinite(reading) || reading <= 0) return;

  try {
    const ref = doc(vehiclesRef(email), vehicleId);

    const snap = await getDoc(ref);
    const current = Number(snap.data()?.currentOdometer) || 0;
    if (reading > current) {
      commit(updateDoc(ref, { currentOdometer: reading, updatedAt: serverTimestamp() }), 'Update odometer');
    }
    // A saved reading is when distance-based schedule alerts are checked
    // (spec 5): fire "due soon" / "overdue" once per status change.
    syncVehicleSchedules(email, vehicleId).catch(e => console.log('Schedule check failed:', e));
  } catch (error) {
    console.error('Error updating vehicle odometer:', error);
  }
};

// ADD SERVICE (subcollection)
export const addUserService = async (email, service, id) => {
  try {
    if (!id) {
      throw new Error('vehicleId (id) is missing or empty');
    }

    const data = {
      name: service.name,
      imageUrl: service.imageUrl || '',
      description: service.description,
      currentMileage: Number(service.currentMileage) || 0,
      totalCost: Number(service.totalCost) || 0,
      // The currency totalCost was typed in; the amount is never converted.
      currency: service.currency || BASE_CURRENCY,
      workshopName: service.workshopName,
      serviceDate: service.serviceDate ? new Date(service.serviceDate) : null,
      nextServiceDate: service.nextServiceDate ? new Date(service.nextServiceDate) : null,
      nextServiceMileage: Number(service.nextServiceMileage) || null,
      remindMe: !!service.remindMe,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      // Per-type detail fields (util/serviceFields.js) - only include if they have values
      ...Object.fromEntries(
        SERVICE_DETAIL_KEYS.filter(k => service[k]).map(k => [k, String(service[k])]),
      ),
    };

    const docRef = doc(recordsRef(email, id, 'services'));
    commit(setDoc(docRef, data), 'Add services');

    track(EVENTS.SERVICE_ADDED, {
      service_type: serviceTypeName(service.name),
      currency: data.currency,
      has_photo: !!data.imageUrl,
      reminder_on: data.remindMe,
    });
    return docRef.id;
  } catch (error) {
    console.error('Error adding service:', error);
    throw error;
  }
};

// ADD DOCUMENT (second subcollection)
// ADD DOCUMENT (subcollection inside vehicle)
export const addUserDocument = async (email, document, id) => {
  try {
    if (!id) {
      throw new Error('vehicleId (id) is missing or empty');
    }

    const data = {
      documentName: document.documentName,
      description: document.description || '',
      issueDate: document.issueDate
        ? new Date(document.issueDate)
        : null,
      expiryDate: document.expiryDate
        ? new Date(document.expiryDate)
        : null,
      remindMe: !!document.remindMe,
      reminderDays: Number(document.reminderDays) || DEFAULT_REMINDER_DAYS,
      imageUrl: document.imageUrl || '',
      file: document.file || null, // file url or object
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      // Per-type detail fields (util/documentFields.js) - only include if they have values
      ...Object.fromEntries(
        DOCUMENT_DETAIL_KEYS.filter(k => document[k]).map(k => [k, String(document[k])]),
      ),
    };

    const docRef = doc(recordsRef(email, id, 'documents'));
    commit(setDoc(docRef, data), 'Add documents');

    track(EVENTS.DOCUMENT_ADDED, {
      document_type: documentTypeName(document.documentName),
      has_photo: !!data.imageUrl,
      has_file: !!data.file,
      reminder_on: data.remindMe,
    });
    return docRef.id;
  } catch (error) {
    console.error('Error adding document:', error);
    throw error;
  }
};

export const updateUserDocument = async (email, document, vehicleId, documentId) => {
  try {
    if (!vehicleId) {
      throw new Error('vehicleId (id) is missing or empty');
    }

    if (!documentId) {
      throw new Error('documentId is missing or empty');
    }

    const data = {
      documentName: document.documentName,
      description: document.description || '',
      issueDate: document.issueDate ? new Date(document.issueDate) : null,
      expiryDate: document.expiryDate ? new Date(document.expiryDate) : null,
      remindMe: !!document.remindMe,
      reminderDays: Number(document.reminderDays) || DEFAULT_REMINDER_DAYS,
      imageUrl: document.imageUrl || '',
      file: document.file || null,
      updatedAt: serverTimestamp(),
      // Per-type detail fields — include even if empty to allow clearing old values
      ...Object.fromEntries(
        DOCUMENT_DETAIL_KEYS.map(k => [k, document[k] ? String(document[k]) : '']),
      ),
    };

    commit(updateDoc(recordRef(email, vehicleId, 'documents', documentId), data), 'Update documents');

    track(EVENTS.DOCUMENT_UPDATED, { document_type: documentTypeName(document.documentName) });
    return documentId;
  } catch (error) {
    console.error('Error updating document:', error);
    throw error;
  }
};

// Keeps an explicit 0 (a free service) instead of turning it into null.
const toNumberOrNull = v => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export const updateUserService = async (email, dataSource, vehicleId, serviceId) => {
  try {
    if (!vehicleId) throw new Error('vehicleId (id) is missing or empty');
    if (!serviceId) throw new Error('serviceId is missing or empty');

    const data = {
      name: dataSource.name || '',
      description: dataSource.description || '',
      serviceDate: dataSource.serviceDate ? new Date(dataSource.serviceDate) : null,
      nextServiceDate: dataSource.nextServiceDate ? new Date(dataSource.nextServiceDate) : null,
      nextServiceMileage: Number(dataSource.nextServiceMileage) || null,
      remindMe: !!dataSource.remindMe,
      currentMileage: toNumberOrNull(dataSource.currentMileage),
      totalCost: toNumberOrNull(dataSource.totalCost),
      // Editing keeps the record's own currency (forms pass it back).
      currency: dataSource.currency || BASE_CURRENCY,
      workshopName: dataSource.workshopName || '',
      imageUrl: dataSource.imageUrl || '',
      updatedAt: serverTimestamp(),
      // Per-type detail fields — include even if empty to allow clearing old values
      ...Object.fromEntries(
        SERVICE_DETAIL_KEYS.map(k => [k, dataSource[k] ? String(dataSource[k]) : '']),
      ),
    };

    commit(updateDoc(recordRef(email, vehicleId, 'services', serviceId), data), 'Update services');

    track(EVENTS.SERVICE_UPDATED, { service_type: serviceTypeName(dataSource.name) });
    return serviceId;
  } catch (error) {
    console.error('Error updating service:', error);
    throw error;
  }
};

// ADD FUEL LOG (subcollection inside vehicle)
export const addUserFuelLog = async (email, fuelLog, id) => {
  try {
    if (!id) {
      throw new Error('vehicleId (id) is missing or empty');
    }

    const data = {
      date: fuelLog.date ? new Date(fuelLog.date) : new Date(),
      odometer: Number(fuelLog.odometer) || 0,
      liters: Number(fuelLog.liters) || 0,
      pricePerLiter: Number(fuelLog.pricePerLiter) || 0,
      totalCost: Number(fuelLog.totalCost) || 0,
      // The currency both amounts were typed in; they are never converted.
      currency: fuelLog.currency || BASE_CURRENCY,
      fuelType: fuelLog.fuelType || 'Petrol',
      fuelName: fuelLog.fuelName || '',
      stationName: fuelLog.stationName || '',
      imageUrl: fuelLog.imageUrl || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = doc(recordsRef(email, id, 'fuelLogs'));
    commit(setDoc(docRef, data), 'Add fuelLogs');

    track(EVENTS.FUEL_LOG_ADDED, {
      fuel_type: data.fuelType,
      currency: data.currency,
      has_photo: !!data.imageUrl,
    });
    return docRef.id;
  } catch (error) {
    console.error('Error adding fuel log:', error);
    throw error;
  }
};

export const updateUserFuelLog = async (email, fuelLog, vehicleId, fuelLogId) => {
  try {
    if (!vehicleId) throw new Error('vehicleId is missing or empty');
    if (!fuelLogId) throw new Error('fuelLogId is missing or empty');

    const data = {
      date: fuelLog.date ? new Date(fuelLog.date) : new Date(),
      odometer: Number(fuelLog.odometer) || 0,
      liters: Number(fuelLog.liters) || 0,
      pricePerLiter: Number(fuelLog.pricePerLiter) || 0,
      totalCost: Number(fuelLog.totalCost) || 0,
      // The currency both amounts were typed in; they are never converted.
      currency: fuelLog.currency || BASE_CURRENCY,
      fuelType: fuelLog.fuelType || 'Petrol',
      fuelName: fuelLog.fuelName || '',
      stationName: fuelLog.stationName || '',
      imageUrl: fuelLog.imageUrl || '',
      updatedAt: serverTimestamp(),
    };

    commit(updateDoc(recordRef(email, vehicleId, 'fuelLogs', fuelLogId), data), 'Update fuelLogs');

    track(EVENTS.FUEL_LOG_UPDATED, { fuel_type: data.fuelType });
    return fuelLogId;
  } catch (error) {
    console.error('Error updating fuel log:', error);
    throw error;
  }
};

export const deleteUserFuelLog = async (email, vehicleId, fuelLogId) => {
  try {
    if (!email) throw new Error('email is missing or empty');
    if (!vehicleId) throw new Error('vehicleId is missing or empty');
    if (!fuelLogId) throw new Error('fuelLogId is missing or empty');

    commit(deleteDoc(recordRef(email, vehicleId, 'fuelLogs', fuelLogId)), 'Delete fuelLogs');

    track(EVENTS.RECORD_DELETED, { record_type: 'fuel', undoable: false });
    return { success: true, fuelLogId };
  } catch (error) {
    console.error('Error deleting fuel log:', error);
    throw error;
  }
};

// DELETE SERVICE (subcollection inside vehicle)
export const deleteUserService =async (email, vehicleId, serviceId) => {
  try {
    if (!email) throw new Error('email is missing or empty');
    if (!vehicleId) throw new Error('vehicleId is missing or empty');
    if (!serviceId) throw new Error('serviceId is missing or empty');


    commit(deleteDoc(recordRef(email, vehicleId, 'services', serviceId)), 'Delete services');

    track(EVENTS.RECORD_DELETED, { record_type: 'service', undoable: false });
    return { success: true, serviceId };
  } catch (error) {
    console.error('Error deleting service:', error);
    throw error;
  }
};

// DELETE DOCUMENT (subcollection inside vehicle)
export const deleteUserDocument = async (email, vehicleId, documentId) => {
  try {
    if (!email) throw new Error('email is missing or empty');
    if (!vehicleId) throw new Error('vehicleId is missing or empty');
    if (!documentId) throw new Error('documentId is missing or empty');


    commit(deleteDoc(recordRef(email, vehicleId, 'documents', documentId)), 'Delete documents');

    track(EVENTS.RECORD_DELETED, { record_type: 'document', undoable: false });
    return { success: true, documentId };
  } catch (error) {
    console.error('Error deleting document:', error);
    throw error;
  }
};

// ─── Delete with undo ────────────────────────────────────────────
// The record is read from the on-device cache (it was just shown in a list),
// deleted, and can be written back with the same id for a few seconds.
const RECORD_COLLECTIONS = { fuel: 'fuelLogs', service: 'services', document: 'documents' };

const rescheduleRecordReminder = (kind, id, data) => {
  if (!data?.remindMe) return;
  if (kind === 'service' && data.nextServiceDate) {
    scheduleReminder({
      id: reminderId('service', id),
      kind: 'service',
      subject: data.name,
      body: data.workshopName ? tr('At {0}', { 0: data.workshopName }) : tr('Next service reminder.'),
      dueDate: data.nextServiceDate,
      prompt: false,
    }).catch(() => {});
  } else if (kind === 'document' && data.expiryDate) {
    scheduleReminder({
      id: reminderId('document', id),
      kind: 'document',
      subject: data.documentName,
      dueDate: data.expiryDate,
      daysBefore: data.reminderDays,
      prompt: false,
    }).catch(() => {});
  }
};

/**
 * Deletes a fuel log / service / document and resolves to an `undo()` that
 * puts it back (null if no copy could be kept). Reminders are cancelled on
 * delete and set again on undo.
 */
export const deleteUserRecord = async (email, vehicleId, kind, recordId) => {
  const name = RECORD_COLLECTIONS[kind];
  if (!email || !vehicleId || !recordId || !name) throw new Error('Missing record reference');
  const ref = recordRef(email, vehicleId, name, recordId);

  let saved = null;
  try {
    const snap = await getDocFromCache(ref);
    if (snap.exists()) saved = snap.data();
  } catch (_) {
    // Not cached: the delete still goes ahead, just without undo.
  }

  if (kind !== 'fuel') cancelReminder(reminderId(kind, recordId));
  commit(deleteDoc(ref), `Delete ${name}`);
  track(EVENTS.RECORD_DELETED, { record_type: kind, undoable: !!saved });

  if (!saved) return null;
  return () => {
    commit(setDoc(ref, saved), `Restore ${name}`);
    track(EVENTS.RECORD_DELETE_UNDONE, { record_type: kind });
    rescheduleRecordReminder(kind, recordId, saved);
  };
};

// UPDATE VEHICLE
export const updateUserVehicle = async (email, vehicleId, vehicleData) => {
  try {
    if (!vehicleId) {
      throw new Error('vehicleId is missing or empty');
    }

    if (await findDuplicateVehicle(email, vehicleData, vehicleId)) {
      return { success: false, message: tr('This vehicle already exists.') };
    }

    const data = {
      brand: vehicleData.brand || '',
      model: vehicleData.model || '',
      year: vehicleData.year || '',
      imageUrl: vehicleData.imageUrl || '',
      updatedAt: serverTimestamp(),
    };
    if (vehicleData.currentOdometer !== undefined) {
      data.currentOdometer = Number(vehicleData.currentOdometer) || 0;
    }

    commit(updateDoc(doc(vehiclesRef(email), vehicleId), data), 'Update vehicle');

    track(EVENTS.VEHICLE_UPDATED);
    return { success: true, vehicleId };
  } catch (error) {
    console.error('Error updating vehicle:', error);
    throw error;
  }
};

const VEHICLE_SUBCOLLECTIONS = ['services', 'documents', 'fuelLogs', 'schedules'];
const BATCH_LIMIT = 450; // Firestore caps a batch at 500 writes

const deleteDocs = async docs => {
  for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(getFirestore());
    docs.slice(i, i + BATCH_LIMIT).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
};

// Firestore doesn't cascade: a vehicle's services, documents and fuel logs
// are deleted explicitly, along with their images and scheduled reminders.
export const deleteUserVehicle = async (email, vehicleId, { silent = false } = {}) => {
  try {
    if (!email) throw new Error('email is missing or empty');
    if (!vehicleId) throw new Error('vehicleId is missing or empty');

    const vehicleRef = doc(vehiclesRef(email), vehicleId);
    const [vehicleSnap, ...subSnaps] = await Promise.all([
      getDoc(vehicleRef),
      ...VEHICLE_SUBCOLLECTIONS.map(name => getDocs(collection(vehicleRef, name))),
    ]);

    const [services, documents, , schedules] = subSnaps;
    services.docs.forEach(d => cancelReminder(reminderId('service', d.id)));
    documents.docs.forEach(d => cancelReminder(reminderId('document', d.id)));
    schedules.docs.forEach(d => cancelRuleNotifications(vehicleId, d.id, { all: true }).catch(() => {}));

    const imageUrls = [
      vehicleSnap.data()?.imageUrl,
      // Records keep photos in `imageUrl` and document attachments in `file`.
      ...subSnaps.flatMap(snap => snap.docs.flatMap(d => [d.data()?.imageUrl, d.data()?.file])),
    ].filter(u => typeof u === 'string' && u);

    await deleteDocs(subSnaps.flatMap(snap => snap.docs));
    await deleteDoc(vehicleRef);

    await Promise.all(imageUrls.map(deleteImage));
    if (!silent) track(EVENTS.VEHICLE_DELETED, {
      services: subSnaps[0].size,
      documents: subSnaps[1].size,
      fuel_logs: subSnaps[2].size,
      schedules: subSnaps[3].size,
    });
    return { success: true };
  } catch (error) {
    console.error('Error deleting vehicle:', error);
    throw error;
  }
};

// Removes everything the account owns in Firestore/Storage: every vehicle
// (with its records and images), the profile photo and the user document.
// The Firebase Auth user itself is deleted by the caller afterwards.
export const deleteUserAccountData = async (email) => {
  if (!email) throw new Error('email is missing or empty');

  const vSnap = await getDocs(vehiclesRef(email));
  for (const v of vSnap.docs) {
    await deleteUserVehicle(email, v.id, { silent: true });
  }

  const userRef = doc(getFirestore(), 'users', email);
  const userSnap = await getDoc(userRef);
  await deleteImage(userSnap.data()?.photo);
  await deleteDoc(userRef);
};



const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setUserInfo: (state, action) => {
      state.name = action.payload.name;
      state.email = action.payload.email;
      state.photo = action.payload.photo;
      state.termCondition=action.payload.termCondition;
    },

    setUserEmail:(state, action)=>{
      state.userEmail = action.payload;
    },

    setSelectedCar:(state, action)=>{
        state.selectedCar = action.payload
    },
    setTrigger:(state,action)=>{
        state.Trigger=action.payload
    },
    setReload:(state,action)=>{
      state.reload=action.payload

    },

    // Bumped whenever the profile (name/photo) is saved anywhere in the app,
    // so the persistently-mounted Header can refetch and refresh its greeting/avatar.
    bumpProfileVersion:(state)=>{
      state.profileVersion += 1;
    },

    bumpRecordsVersion:(state)=>{
      state.recordsVersion += 1;
    },

    // Full reset on logout / account deletion so nothing (selected car,
    // email, modal flags) leaks into the next session on this device.
    clearUser: () => initialState,
  },
});

export const { setUserInfo, clearUser, setUserEmail, setSelectedCar,setTrigger, setReload, bumpProfileVersion, bumpRecordsVersion } = userSlice.actions;
export default userSlice.reducer;
