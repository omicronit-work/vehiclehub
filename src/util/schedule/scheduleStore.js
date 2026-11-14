import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  getDocsFromCache,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from '@react-native-firebase/firestore';
import { toPlain } from '../../store/fetchSlice';
import { commit } from '../firestoreWrite';
import { addUserService } from '../../store/userSlice';
import { resolveServiceType } from '../serviceFields';
import { MODES, DEFAULTS, currentOdometer, normalizeRule, toYmd, usesDistance, usesTime } from './scheduleMath';
import { EVENTS, track } from '../analytics';

// Schedule rules live next to the vehicle's other records:
//   users/{email}/vehicles/{vehicleId}/schedules/{ruleId}
// A rule stores only its current baseline; completed services stay in the
// existing services subcollection (tagged with scheduleId).

// Every preset is only a suggestion — the owner's manual decides.
// `serviceType` ties the rule to a built-in service type (util/serviceFields)
// so completed services get the right icon, fields and expense category.
export const SCHEDULE_PRESETS = [
  { name: 'Engine oil & filter', serviceType: 'Engine Oil Refill', mode: MODES.BOTH, intervalKm: 10000, intervalMonths: 6 },
  { name: 'Tyre rotation', serviceType: 'Tire Rotation', mode: MODES.DISTANCE, intervalKm: 5000, intervalMonths: null },
  { name: 'Cabin air filter', serviceType: 'Cabin / AC Filter', mode: MODES.BOTH, intervalKm: 15000, intervalMonths: 12 },
  { name: 'Brake fluid', serviceType: 'Brake Fluid', mode: MODES.TIME, intervalKm: null, intervalMonths: 24 },
];
export const CUSTOM_PRESET = 'Custom';

const vehicleRef = (email, vehicleId) => doc(getFirestore(), 'users', email, 'vehicles', vehicleId);
const schedulesRef = (email, vehicleId) =>
  collection(getFirestore(), 'users', email, 'vehicles', vehicleId, 'schedules');
const scheduleRef = (email, vehicleId, ruleId) => doc(schedulesRef(email, vehicleId), ruleId);
const subRef = (email, vehicleId, name) =>
  collection(getFirestore(), 'users', email, 'vehicles', vehicleId, name);

const norm = s => String(s ?? '').trim().toLowerCase();

/** Whether a service record (by its name) is this rule's service type. */
export const serviceMatchesRule = (rule, serviceName) => {
  if (!serviceName) return false;
  if (rule.serviceType) {
    const type = resolveServiceType(serviceName);
    if (type) return type.name === rule.serviceType;
  }
  return norm(serviceName) === norm(rule.name);
};

/** Completed services that belong to a rule, newest first. */
export const ruleHistory = (rule, services = []) =>
  services
    .filter(s => s.scheduleId === rule.id || (!s.scheduleId && serviceMatchesRule(rule, s.name)))
    .sort((a, b) => (toYmd(b.serviceDate) || '').localeCompare(toYmd(a.serviceDate) || ''));

const plainDocs = snap => snap.docs.map(d => ({ id: d.id, ...toPlain(d.data()) }));

export const fetchSchedules = async (email, vehicleId) => {
  if (!email || !vehicleId) return [];
  return plainDocs(await getDocs(schedulesRef(email, vehicleId)));
};

export const fetchSchedule = async (email, vehicleId, ruleId) => {
  const snap = await getDoc(scheduleRef(email, vehicleId, ruleId));
  return snap.exists() ? { id: snap.id, ...toPlain(snap.data()) } : null;
};

/**
 * Highest odometer reading in a vehicle's services and fuel logs (null when
 * there is none) — the lowest the vehicle's own reading may be set to.
 */
export const recordsOdometer = async (email, vehicleId) => {
  if (!email || !vehicleId) return null;
  const [sSnap, fSnap] = await Promise.all([
    getDocs(subRef(email, vehicleId, 'services')),
    getDocs(subRef(email, vehicleId, 'fuelLogs')),
  ]);
  return currentOdometer({ services: plainDocs(sSnap), fuelLogs: plainDocs(fSnap) });
};

/**
 * Everything the schedule screens need for one vehicle, including K (the
 * current odometer, 4.6).
 */
export const loadVehicleScheduleData = async (email, vehicleId) => {
  const [vSnap, schedules, sSnap, fSnap] = await Promise.all([
    getDoc(vehicleRef(email, vehicleId)),
    fetchSchedules(email, vehicleId),
    getDocs(subRef(email, vehicleId, 'services')),
    getDocs(subRef(email, vehicleId, 'fuelLogs')),
  ]);
  let vehicle = vSnap.exists() ? { id: vSnap.id, ...toPlain(vSnap.data()) } : null;
  const services = plainDocs(sSnap);
  const fuelLogs = plainDocs(fSnap);
  const odometer = currentOdometer({ vehicle, services, fuelLogs });

  // The stored reading fell behind a service / fuel log (e.g. it was lowered
  // in Edit vehicle): raise it so the garage card and forms show the same
  // reading the schedule maths uses. Best effort; never lowers it.
  if (vehicle && odometer != null && odometer > (Number(vehicle.currentOdometer) || 0)) {
    vehicle = { ...vehicle, currentOdometer: odometer };
    updateDoc(vehicleRef(email, vehicleId), { currentOdometer: odometer }).catch(e =>
      console.log('Odometer sync failed:', e),
    );
  }

  return { vehicle, schedules, services, fuelLogs, odometer };
};

/**
 * For the garage cards: each vehicle's services, documents, schedules and
 * fuel logs, fetched in parallel. `vehicles` are the loaded vehicle objects
 * (with id). Resolves { [vehicleId]: { vehicle, services, documents, schedules, fuelLogs } }.
 * `fromCache` reads only the copy stored on the phone (instant, no network);
 * a collection missing from the cache comes back empty, and a vehicle with
 * nothing cached at all is left out.
 */
export const loadGarageRecords = async (email, vehicles = [], { fromCache = false } = {}) => {
  if (!email) return {};
  const read = fromCache
    ? ref => getDocsFromCache(ref).then(plainDocs, () => [])
    : ref => getDocs(ref).then(plainDocs);
  const rows = await Promise.all(vehicles.filter(v => v?.id).map(async vehicle => {
    const [schedules, services, documents, fuelLogs] = await Promise.all([
      read(schedulesRef(email, vehicle.id)),
      read(subRef(email, vehicle.id, 'services')),
      read(subRef(email, vehicle.id, 'documents')),
      read(subRef(email, vehicle.id, 'fuelLogs')),
    ]);
    // Nothing cached tells us nothing (e.g. fresh install): leave it out so
    // the caller keeps waiting for the server instead of showing "all clear".
    if (fromCache && !schedules.length && !services.length && !documents.length && !fuelLogs.length) return null;
    return [vehicle.id, { vehicle, schedules, services, documents, fuelLogs }];
  }));
  return Object.fromEntries(rows.filter(Boolean));
};

/** Dated odometer readings ([{ date: ymd, km }]) for the driving rate. */
export const odometerReadings = ({ services = [], fuelLogs = [] }) => [
  ...services.map(s => ({ date: toYmd(s.serviceDate), km: Number(s.currentMileage) })),
  ...fuelLogs.map(f => ({ date: toYmd(f.date), km: Number(f.odometer) })),
];

// Only the fields the spec's data model defines (section 3), clean.
const ruleFields = rule => {
  const r = normalizeRule(rule);
  return {
    name: String(rule.name || '').trim(),
    serviceType: rule.serviceType || null,
    mode: r.mode,
    intervalKm: usesDistance(r.mode) ? r.intervalKm : null,
    intervalMonths: usesTime(r.mode) ? r.intervalMonths : null,
    baseDate: rule.baseDate,
    // When the part was bought (time-only schedules); optional.
    boughtDate: rule.boughtDate || null,
    baseOdo: r.baseOdo,
    warnKm: r.warnKm ?? DEFAULTS.warnKm,
    warnDays: r.warnDays ?? DEFAULTS.warnDays,
    repeatOverdueDays: r.repeatOverdueDays ?? DEFAULTS.repeatOverdueDays,
    remindersOn: r.remindersOn,
    // Optional photo on the media server (see imageStorage.js).
    imageUrl: rule.imageUrl || null,
  };
};

/** Create (no ruleId) or update a rule. Resolves to the rule with its id. */
export const saveSchedule = async (email, vehicleId, rule, ruleId) => {
  const data = ruleFields(rule);
  if (ruleId) {
    // Editing changes the due values, so distance alerts start fresh.
    commit(updateDoc(scheduleRef(email, vehicleId, ruleId), {
      ...data,
      distanceAlert: null,
      distanceOverdueSince: null,
      updatedAt: serverTimestamp(),
    }), 'Update schedule');
    track(EVENTS.SCHEDULE_UPDATED, { mode: data.mode, reminders_on: !!data.remindersOn });
    return { id: ruleId, vehicleId, ...data, distanceAlert: null, distanceOverdueSince: null };
  }
  const ref = doc(schedulesRef(email, vehicleId));
  commit(setDoc(ref, {
    ...data,
    distanceAlert: null,
    distanceOverdueSince: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }), 'Add schedule');
  track(EVENTS.SCHEDULE_CREATED, {
    mode: data.mode,
    service_type: resolveServiceType(data.serviceType)?.name || 'Custom',
    reminders_on: !!data.remindersOn,
  });
  return { id: ref.id, vehicleId, ...data, distanceAlert: null, distanceOverdueSince: null };
};

/** Deleting a rule never deletes the completed services it created. */
export const deleteSchedule = async (email, vehicleId, ruleId) => {
  commit(deleteDoc(scheduleRef(email, vehicleId, ruleId)), 'Delete schedule');
  track(EVENTS.SCHEDULE_DELETED);
};

export const updateScheduleAlertState = (email, vehicleId, ruleId, patch) =>
  updateDoc(scheduleRef(email, vehicleId, ruleId), patch);

/**
 * R9 restart: new baseline from the day and odometer the service was done.
 * The old due values are not used, so early or late service never shifts
 * the cycle.
 */
export const restartSchedule = async (email, vehicleId, ruleId, { dateDone, odo }) => {
  const patch = {
    baseDate: dateDone,
    baseOdo: Math.round(Number(odo)) || 0,
    distanceAlert: null,
    distanceOverdueSince: null,
    lastDoneAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  commit(updateDoc(scheduleRef(email, vehicleId, ruleId), patch), 'Restart schedule');
  return patch;
};

/**
 * R8–R10 Mark as done: adds a completed service to history, restarts the
 * rule, and raises the vehicle odometer if the entered reading is higher.
 * `cost` is saved as typed, in `currency` (never converted).
 */
export const markScheduleDone = async (email, vehicleId, rule, { dateDone, odo, cost, currency, shop }) => {
  const serviceId = await addUserService(
    email,
    {
      name: rule.serviceType || rule.name,
      description: '',
      currentMileage: odo,
      totalCost: cost,
      currency,
      workshopName: shop || '',
      // Local noon, so the stored instant falls on the right calendar day in
      // every time zone the phone may later move to.
      serviceDate: new Date(`${dateDone}T12:00:00`),
      nextServiceDate: null,
      nextServiceMileage: null,
      remindMe: false,
    },
    vehicleId,
  );
  commit(updateDoc(doc(subRef(email, vehicleId, 'services'), serviceId), { scheduleId: rule.id }), 'Link service to schedule');
  const patch = await restartSchedule(email, vehicleId, rule.id, { dateDone, odo });

  // R10 — never lowers the stored reading.
  const vSnap = await getDoc(vehicleRef(email, vehicleId));
  if (Number(odo) > (Number(vSnap.data()?.currentOdometer) || 0)) {
    commit(updateDoc(vehicleRef(email, vehicleId), { currentOdometer: Math.round(Number(odo)), updatedAt: serverTimestamp() }), 'Update odometer');
  }
  track(EVENTS.SCHEDULE_MARKED_DONE, { mode: rule.mode, service_type: resolveServiceType(rule.serviceType)?.name || 'Custom' });
  return { serviceId, rule: { ...rule, ...patch } };
};

/** R12 — first rule on this vehicle matching a newly added service. */
export const findScheduleForService = async (email, vehicleId, serviceName) => {
  const schedules = await fetchSchedules(email, vehicleId);
  return schedules.find(r => serviceMatchesRule(r, serviceName)) || null;
};

/**
 * Service alerts screen: a changed warning / repeat value applies to every
 * existing rule as well as being the default for new ones.
 */
export const applyAlertValuesToAll = async (email, vehicleIds, patch) => {
  const fields = Object.fromEntries(
    Object.entries(patch).filter(([k]) => ['warnKm', 'warnDays', 'repeatOverdueDays'].includes(k)),
  );
  if (!Object.keys(fields).length) return;
  for (const vehicleId of vehicleIds) {
    const rules = await fetchSchedules(email, vehicleId);
    await Promise.all(rules.map(r => updateDoc(scheduleRef(email, vehicleId, r.id), fields)));
  }
};
