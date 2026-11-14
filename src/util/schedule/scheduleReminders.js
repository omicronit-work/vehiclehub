import AsyncStorage from '@react-native-async-storage/async-storage';
import ReminderScheduler from '../../../specs/NativeReminderScheduler';
import { isNotificationsEnabled } from '../notifications';
import { askNotificationPermission } from '../reminderFeedback';
import {
  STATUS,
  addDays,
  evaluateRule,
  formatDistance,
  formatYmd,
  formatDays,
  todayYmd,
  ymdToLocalDate,
} from './scheduleMath';
import { getAlertSettings, getDistanceUnit } from './scheduleSettings';
import { loadVehicleScheduleData, updateScheduleAlertState } from './scheduleStore';
import { t as tr } from '../../i18n';
import { vehicleName as displayVehicleName } from '../../i18n/brands';
import { ruleName } from '../serviceFields';

// Spec section 5. Time alerts are known in advance and handed to the native
// AlarmManager scheduler (they fire with the app closed and survive a reboot
// via ReminderReceiver). Distance can't be predicted, so distance alerts are
// raised when an odometer reading is saved or the app is opened, once per
// status change, then repeat every repeatOverdueDays at 09:00.
//
// Everything is rebuilt when a rule is created, edited, marked done or
// deleted, at sign-in / app open, and after notification permission is
// granted. Notification ids are stable, so rebuilding just replaces them.

export const ALERT_HOUR = 9;
const MAX_REPEATS = 8; // overdue repeats queued ahead; topped up on every open

const PREFIX = 'sched';
const idFor = (vehicleId, ruleId, suffix) => `${PREFIX}-${vehicleId}-${ruleId}-${suffix}`;
const pendingKey = (vehicleId, ruleId) => `schedNotifs:${vehicleId}:${ruleId}`;

/** 'sched-<vehicleId>-<ruleId>-<suffix>' → { vehicleId, ruleId } (Firestore ids have no '-'). */
export const parseScheduleNotificationId = id => {
  const parts = String(id || '').split('-');
  if (parts[0] !== PREFIX || parts.length < 4) return null;
  return { vehicleId: parts[1], ruleId: parts[2] };
};

const at9 = (ymdString) => ymdToLocalDate(ymdString, ALERT_HOUR)?.getTime() ?? null;

const vehicleLabel = vehicle => displayVehicleName(vehicle) || tr('Your vehicle');

/**
 * Pure: the timed notifications one rule should have queued, given its
 * evaluation. Returns [{ suffix, title, body, fireAt }] with fireAt > now.
 */
export const planRuleNotifications = (evaluation, { now = Date.now(), vehicleName, unit = 'km' }) => {
  const { rule, dueDate, dueKm, distance, time } = evaluation;
  if (!rule.remindersOn) return [];
  const name = ruleName(rule);
  const plan = [];
  const add = (suffix, title, body, fireAt) => {
    if (fireAt && fireAt > now) plan.push({ suffix, title, body, fireAt });
  };
  const dueText = [dueDate && formatYmd(dueDate), dueKm !== null && formatDistance(dueKm, unit)]
    .filter(Boolean)
    .join(' or ');

  if (time) {
    if (rule.warnDays > 0) {
      add(
        'warn',
        tr('{0} due in {1}', { 0: name, 1: formatDays(rule.warnDays) }),
        tr('{0} · due {1}. Tap to open.', { 0: vehicleName, 1: dueText }),
        at9(addDays(dueDate, -rule.warnDays)),
      );
    }
    add('due', tr('{0} due today', { 0: name }), tr('{0} · due {1}. Tap to open.', { 0: vehicleName, 1: dueText }), at9(dueDate));
    if (rule.repeatOverdueDays > 0) {
      for (let k = 1; k <= MAX_REPEATS; k += 1) {
        const days = k * rule.repeatOverdueDays;
        add(
          `over${k}`,
          tr('{0} is overdue by {1}', { 0: name, 1: formatDays(days) }),
          tr('{0} · was due {1}. Tap to mark as done.', { 0: vehicleName, 1: formatYmd(dueDate) }),
          at9(addDays(dueDate, days)),
        );
      }
    }
  }

  // Distance overdue repeats, counted from the day it was first seen overdue.
  // Skipped while the time limit is overdue too: those repeats already nag.
  const timeOverdue = time?.status === STATUS.OVERDUE;
  if (distance?.status === STATUS.OVERDUE && rule.distanceOverdueSince && rule.repeatOverdueDays > 0 && !timeOverdue) {
    for (let k = 1; k <= MAX_REPEATS; k += 1) {
      add(
        `dover${k}`,
        `${name} is overdue`,
        tr('{0} · was due at {1}. Tap to mark as done.', { 0: vehicleName, 1: formatDistance(dueKm, unit) }),
        at9(addDays(rule.distanceOverdueSince, k * rule.repeatOverdueDays)),
      );
    }
  }
  return plan;
};

/**
 * Pure: the distance alert to raise now, if a reading just moved the rule
 * into a worse distance status. Returns { alert, state } where state is the
 * new { distanceAlert, distanceOverdueSince } to store, or null if unchanged.
 */
export const distanceTransition = (evaluation, { today, vehicleName, unit = 'km' }) => {
  const { rule, distance, dueKm } = evaluation;
  const prev = rule.distanceAlert || null;
  const next = !distance || distance.status === STATUS.OK ? null : distance.status;
  if (next === prev) return { alert: null, state: null };

  const state = {
    distanceAlert: next,
    distanceOverdueSince: next === STATUS.OVERDUE ? rule.distanceOverdueSince || today : null,
  };
  let alert = null;
  if (rule.remindersOn && next === STATUS.OVERDUE) {
    alert = {
      title: tr('{0} is overdue by {1}', { 0: ruleName(rule), 1: formatDistance(-distance.left, unit) }),
      body: tr('{0} · was due at {1}. Tap to mark as done.', { 0: vehicleName, 1: formatDistance(dueKm, unit) }),
    };
  } else if (rule.remindersOn && next === STATUS.SOON && prev !== STATUS.OVERDUE) {
    alert = {
      title: distance.left === 0 ? tr('{0} is due now', { 0: ruleName(rule) }) : tr('{0} due in {1}', { 0: ruleName(rule), 1: formatDistance(distance.left, unit) }),
      body: tr('{0} · due at {1}. Tap to open.', { 0: vehicleName, 1: formatDistance(dueKm, unit) }),
    };
  }
  return { alert, state };
};

/* ── Native side effects ────────────────────────────────────────────────── */

const readPending = async (vehicleId, ruleId) => {
  try {
    return JSON.parse((await AsyncStorage.getItem(pendingKey(vehicleId, ruleId))) || '[]');
  } catch (_) {
    return [];
  }
};

/**
 * Cancels a rule's queued alarms. `all` also clears notifications already on
 * screen (used when the rule is done or deleted); otherwise ones that have
 * fired stay visible.
 */
export const cancelRuleNotifications = async (vehicleId, ruleId, { all = false } = {}) => {
  if (!ReminderScheduler) return;
  const now = Date.now();
  const pending = await readPending(vehicleId, ruleId);
  const ids = all
    ? [...new Set([...pending.map(p => p.id), idFor(vehicleId, ruleId, 'dnow')])]
    : pending.filter(p => p.fireAt > now).map(p => p.id);
  await Promise.all(ids.map(id => ReminderScheduler.cancel(id).catch(() => {})));
  await AsyncStorage.setItem(
    pendingKey(vehicleId, ruleId),
    JSON.stringify(all ? [] : pending.filter(p => p.fireAt <= now)),
  );
};

const queue = async (vehicleId, ruleId, plan) => {
  const pending = (await readPending(vehicleId, ruleId)).filter(p => p.fireAt <= Date.now());
  for (const item of plan) {
    const id = idFor(vehicleId, ruleId, item.suffix);
    await ReminderScheduler.schedule(id, item.title, item.body, item.fireAt);
    pending.push({ id, fireAt: item.fireAt });
  }
  await AsyncStorage.setItem(pendingKey(vehicleId, ruleId), JSON.stringify(pending));
};

const showNow = (vehicleId, ruleId, alert) =>
  ReminderScheduler.schedule(idFor(vehicleId, ruleId, 'dnow'), alert.title, alert.body, Date.now() + 1000);

/**
 * Re-evaluates and re-queues every rule on one vehicle. `seed` (after the
 * user creates or edits a rule on screen) records the current distance
 * status without notifying, since they're looking at it.
 */
export const syncVehicleSchedules = async (email, vehicleId, { data, seed = false } = {}) => {
  if (!email || !vehicleId) return;
  const loaded = data || (await loadVehicleScheduleData(email, vehicleId));
  const { vehicle, schedules, odometer } = loaded;
  if (!vehicle) return;

  const [settings, unit, allowed] = await Promise.all([
    getAlertSettings(),
    getDistanceUnit(),
    ReminderScheduler ? isNotificationsEnabled() : Promise.resolve(false),
  ]);
  const today = todayYmd();
  const vehicleName = vehicleLabel(vehicle);

  for (const stored of schedules) {
    try {
      let rule = stored;
      const evaluation = evaluateRule(rule, { today, odometer });
      const { alert, state } = distanceTransition(evaluation, { today, vehicleName, unit });
      if (state) {
        await updateScheduleAlertState(email, vehicleId, rule.id, state);
        rule = { ...rule, ...state };
      }
      if (!ReminderScheduler) continue;

      await cancelRuleNotifications(vehicleId, rule.id);
      if (!settings.enabled || !allowed) continue;
      if (alert && !seed) await showNow(vehicleId, rule.id, alert);
      const plan = planRuleNotifications(evaluateRule(rule, { today, odometer }), { vehicleName, unit });
      await queue(vehicleId, rule.id, plan);
    } catch (e) {
      console.log('Schedule reminder sync failed:', e);
    }
  }
};

/** App open / sign-in / permission granted: every vehicle's rules. */
export const syncAllSchedules = async (email, vehicleIds) => {
  if (!email) return;
  for (const vehicleId of vehicleIds) {
    try {
      await syncVehicleSchedules(email, vehicleId);
    } catch (e) {
      console.log('Schedule sync failed for vehicle', vehicleId, e);
    }
  }
};

/**
 * First rule save: ask for notification permission in context (Android 13+),
 * not at launch. Resolves whether notifications are allowed.
 */
export const askPermissionForSchedules = () =>
  askNotificationPermission({ what: 'a service' }).catch(() => false);
