import AsyncStorage from '@react-native-async-storage/async-storage';
import ReminderScheduler from '../../specs/NativeReminderScheduler';
import { t as tr } from '../i18n';
import { serviceLabel } from './serviceFields';
import { documentLabel } from './documentFields';

// Reminders are scheduled natively (AlarmManager + a BroadcastReceiver) by the
// ReminderScheduler TurboModule, so they fire even when the app is closed.
// The module only exists on Android; elsewhere every call is a safe no-op.

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const REMINDER_HOUR = 9; // local time the reminder fires
const REMINDER_DAYS_BEFORE = 7; // default: how far ahead of the due date the reminder fires

// Lead times a document reminder can be set to (days before expiry).
export const REMINDER_LEAD_OPTIONS = [1, 7, 14, 30];
export const DEFAULT_REMINDER_DAYS = REMINDER_DAYS_BEFORE;

/** Whether the app is currently allowed to show notifications at all. */
export async function isNotificationsEnabled() {
  if (!ReminderScheduler) return false;
  return ReminderScheduler.areNotificationsEnabled();
}

/**
 * Shows the OS permission prompt if it hasn't been answered yet.
 * Once the user has denied it, the OS won't show the prompt again — the
 * caller should fall back to `openNotificationSettings()` in that case.
 */
export async function requestNotificationPermission() {
  if (!ReminderScheduler) return false;
  return ReminderScheduler.requestPermission();
}

/** Deep-links into the OS notification settings screen for this app. */
export async function openNotificationSettings() {
  await ReminderScheduler?.openNotificationSettings();
}

/** Deep-links to Android's "Alarms & reminders" setting for this app. */
export async function openAlarmSettings() {
  await ReminderScheduler?.openAlarmSettings();
}

export const reminderId = (kind, recordId) => `${kind}-${recordId}`;

// Built in the app language each time a reminder is (re)scheduled. Built-in
// service and document types show their label; typed names stay as typed.
const TITLES = {
  document: ['{0} expires today', '{0} expires tomorrow', '{0} expires in {1} days'],
  service: ['{0} is due today', '{0} is due tomorrow', '{0} is due in {1} days'],
};
const reminderTitle = (kind, subject, days) => {
  const name = (kind === 'document' ? documentLabel(subject) : serviceLabel(subject))
    || tr(kind === 'document' ? 'Document' : 'Service');
  const [today, tomorrow, later] = TITLES[kind === 'document' ? 'document' : 'service'];
  return tr(days === 0 ? today : days === 1 ? tomorrow : later, { 0: name, 1: days });
};

const toDate = (d) => new Date(typeof d?.toDate === 'function' ? d.toDate() : d);

/**
 * When the reminder for `dueDate` will fire: 9am, `daysBefore` (default 7) days before. Inside that
 * window it's 9am today, or a minute from now once 9am has passed. Returns
 * { fireAt, daysLeft } or null if the due day is over or the date is invalid.
 */
export function reminderSlot(dueDate, now = Date.now(), daysBefore = REMINDER_DAYS_BEFORE) {
  const lead = Number(daysBefore) > 0 ? Number(daysBefore) : REMINDER_DAYS_BEFORE;
  if (!dueDate) return null;
  const due = toDate(dueDate);
  if (Number.isNaN(due.getTime())) return null;

  const dueDay = new Date(due);
  dueDay.setHours(0, 0, 0, 0);
  const dueDayEnd = new Date(due);
  dueDayEnd.setHours(23, 59, 59, 999);
  if (dueDayEnd.getTime() <= now) return null;

  const remindAt = new Date(dueDay);
  remindAt.setDate(remindAt.getDate() - lead);
  remindAt.setHours(REMINDER_HOUR, 0, 0, 0);
  if (remindAt.getTime() > now) return { fireAt: remindAt.getTime(), daysLeft: lead, late: false };

  const todayMorning = new Date(now);
  todayMorning.setHours(REMINDER_HOUR, 0, 0, 0);
  const fireAt = Math.max(todayMorning.getTime(), now + 60 * 1000);
  const fireDay = new Date(fireAt);
  fireDay.setHours(0, 0, 0, 0);
  const daysLeft = Math.max(0, Math.round((dueDay.getTime() - fireDay.getTime()) / ONE_DAY_MS));
  return { fireAt, daysLeft, late: true, dueDay: dueDay.getTime() };
}

// ─── Late heads-ups sent once ────────────────────────────────────
// A reminder whose planned moment has passed (`late` above) fires today or a
// minute from now. Reminders are re-queued in the background on every start
// and after edits, and the native side forgets a reminder once it has fired,
// so without this the same heads-up would come again on every app open until
// the due day. Kept per reminder id: the due day it was sent for.
const LATE_SENT_KEY = 'reminderLateSent';

const readLateSent = async () => {
  try {
    return JSON.parse((await AsyncStorage.getItem(LATE_SENT_KEY)) || '{}') || {};
  } catch {
    return {};
  }
};

const markLateSent = async (id, dueDay) => {
  try {
    const sent = await readLateSent();
    const startOfToday = new Date().setHours(0, 0, 0, 0);
    // Due days that are over can't come back: drop them.
    Object.keys(sent).forEach(k => { if (sent[k] < startOfToday) delete sent[k]; });
    sent[id] = dueDay;
    await AsyncStorage.setItem(LATE_SENT_KEY, JSON.stringify(sent));
  } catch {}
};

// ─── Reminders queued on this phone ──────────────────────────────
// The native scheduler can't list what it holds, so the ids of service and
// document reminders queued here are kept, to cancel the ones whose record is
// gone (deleted on another phone): see cancelOrphanedReminders. Changes run
// one after another, so concurrent saves can't drop each other's ids.
const QUEUED_KEY = 'reminderQueued';
let queuedChain = Promise.resolve();

const updateQueued = change => {
  queuedChain = queuedChain.then(async () => {
    try {
      const ids = new Set(JSON.parse((await AsyncStorage.getItem(QUEUED_KEY)) || '[]'));
      change(ids);
      await AsyncStorage.setItem(QUEUED_KEY, JSON.stringify([...ids]));
    } catch {}
  });
  return queuedChain;
};

/** Ids of the service / document reminders queued on this phone. */
export const queuedReminderIds = async () => {
  await queuedChain;
  try {
    return JSON.parse((await AsyncStorage.getItem(QUEUED_KEY)) || '[]');
  } catch {
    return [];
  }
};

/**
 * Cancels every queued reminder not in `keepIds` (the ids the account's
 * current records should have). Resolves to how many were cancelled.
 */
export async function cancelOrphanedReminders(keepIds) {
  const keep = new Set(keepIds);
  const orphans = (await queuedReminderIds()).filter(id => !keep.has(id));
  await Promise.all(orphans.map(id => cancelReminder(id)));
  return orphans.length;
}

/**
 * Schedules a local notification for 9am, 7 days before `dueDate`. When that
 * moment has already passed but the due date hasn't (e.g. a record added with
 * an expiry only a few days away), it falls back to 9am today — or a minute
 * from now if that has passed too — so the user still gets a heads-up with
 * the actual days left. No-ops once the due day is over.
 *
 * Notification permission is requested here — i.e. the first time the user
 * actually saves a reminder — rather than at app start, so the one-shot
 * prompt appears with context. Pass `prompt: false` for background
 * rescheduling, which must never pop a permission dialog.
 *
 * Resolves to { scheduled: true, exact } or { scheduled: false, reason } where
 * reason is 'past' | 'permission' | 'invalid' | 'unsupported' | 'sent' (a late
 * heads-up already sent for this due day; background re-queues only). Callers should surface
 * failures — see util/reminderFeedback.js.
 */
export async function scheduleReminder({ id, kind, subject, body, dueDate, daysBefore, prompt = true }) {
  if (!ReminderScheduler) return { scheduled: false, reason: 'unsupported' };
  if (!dueDate) return { scheduled: false, reason: 'invalid' };

  const slot = reminderSlot(dueDate, Date.now(), daysBefore);
  if (!slot) return { scheduled: false, reason: Number.isNaN(toDate(dueDate).getTime()) ? 'invalid' : 'past' };
  const { fireAt, daysLeft, late, dueDay } = slot;
  // Background re-queues (prompt: false) don't send a late heads-up already
  // sent for this due day. A save by the user (prompt: true) always does.
  if (late && !prompt && (await readLateSent())[id] === dueDay) {
    return { scheduled: false, reason: 'sent' };
  }
  const title = reminderTitle(kind, subject, daysLeft);

  const allowed = prompt ? await requestNotificationPermission() : await isNotificationsEnabled();
  if (!allowed) return { scheduled: false, reason: 'permission' };

  const exact = await ReminderScheduler.schedule(id, title, body ?? '', fireAt);
  updateQueued(ids => ids.add(id));
  if (late) await markLateSent(id, dueDay);
  return { scheduled: true, exact };
}

export async function cancelReminder(id) {
  try {
    await ReminderScheduler?.cancel(id);
  } catch (_) {}
  updateQueued(ids => ids.delete(id));
}

// Cancels every scheduled reminder on this device — used on logout and
// account deletion so the next user doesn't get the previous user's alerts.
export async function cancelAllReminders() {
  try {
    await ReminderScheduler?.cancelAll();
  } catch (_) {}
  await updateQueued(ids => ids.clear());
}
