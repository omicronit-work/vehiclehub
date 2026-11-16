import AsyncStorage from '@react-native-async-storage/async-storage';
import ReminderScheduler from '../../../specs/NativeReminderScheduler';
import { isNotificationsEnabled } from '../notifications';
import { t as tr } from '../../i18n';

/*
 * R18: with the switch on, a 09:00 "Back up your vehicle data" notification
 * when the last backup is 30+ days old, or there is no backup and the first
 * record is 7+ days old. It repeats every 7 days until a backup is made.
 * Tapping it opens the Backup screen (App.jsx: vehiclehub://reminder/backup-…).
 */

const DAY = 24 * 60 * 60 * 1000;
export const BACKUP_AFTER_DAYS = 30;
export const FIRST_BACKUP_AFTER_DAYS = 7;
export const REPEAT_DAYS = 7;
const HOUR = 9;
// The native scheduler fires one-shot alarms; this many repeats are queued
// ahead and topped up whenever the app opens.
const QUEUED = 6;

export const BACKUP_REMINDER_PREFIX = 'backup-';
const LAST_BACKUP_KEY = 'backup:lastAt';
const SWITCH_KEY = 'backup:remind';
const ANCHOR_KEY = 'backup:reminderAnchor';

// Everything here belongs to the signed-in account (stored as
// `<key>:<email>`), so a second account on the same phone doesn't inherit
// the first one's last-backup time, reminder series or switch. Values saved
// by older versions under the bare key are adopted by the first account to
// read them (on almost every phone, the only one) and then removed.
const scopedKey = (key, email) => `${key}:${String(email || '').trim().toLowerCase()}`;

const readScoped = async (key, email) => {
  if (!email) return null;
  const own = await AsyncStorage.getItem(scopedKey(key, email));
  if (own != null) return own;
  const legacy = await AsyncStorage.getItem(key);
  if (legacy == null) return null;
  await AsyncStorage.setItem(scopedKey(key, email), legacy);
  await AsyncStorage.removeItem(key);
  return legacy;
};

const writeScoped = (key, email, value) =>
  email ? AsyncStorage.setItem(scopedKey(key, email), value) : Promise.resolve();

const nineOn = ms => {
  const d = new Date(ms);
  d.setHours(HOUR, 0, 0, 0);
  return d.getTime();
};
/** First 09:00 at or after `ms`. */
const nextNine = ms => {
  const today = nineOn(ms);
  return today >= ms ? today : nineOn(ms + DAY);
};

/** When a backup becomes due, or null (nothing to back up yet). */
export const backupDueAt = ({ lastBackupAt, firstRecordAt }) => {
  if (lastBackupAt) return lastBackupAt + BACKUP_AFTER_DAYS * DAY;
  if (firstRecordAt) return firstRecordAt + FIRST_BACKUP_AFTER_DAYS * DAY;
  return null;
};

/**
 * The next reminder times. The series starts at 09:00 on the due day (or the
 * next 09:00 when that has passed) and is remembered as `anchor`, so opening
 * the app daily doesn't turn a weekly reminder into a daily one.
 * Returns { anchor, times }.
 */
export const planBackupReminders = ({ lastBackupAt, firstRecordAt, now = Date.now(), anchor = null, count = QUEUED }) => {
  const due = backupDueAt({ lastBackupAt, firstRecordAt });
  if (due == null) return { anchor: null, due: null, times: [] };
  const series = anchor?.due === due ? anchor.at : Math.max(nextNine(due), nextNine(now));
  let first = series;
  while (first < now) first += REPEAT_DAYS * DAY;
  const times = Array.from({ length: count }, (_, i) => first + i * REPEAT_DAYS * DAY);
  return { anchor: { due, at: series }, due, times };
};

export const getBackupReminderOn = async email => (await readScoped(SWITCH_KEY, email)) !== 'off';
export const setBackupReminderOn = (email, on) => writeScoped(SWITCH_KEY, email, on ? 'on' : 'off');

export const getLastBackupAt = async email => {
  const v = Number(await readScoped(LAST_BACKUP_KEY, email));
  return Number.isFinite(v) && v > 0 ? v : null;
};

/** R5: set when a backup file is created. */
export const setLastBackupAt = (email, ms) => writeScoped(LAST_BACKUP_KEY, email, String(ms));

const cancelQueued = async () => {
  for (let i = 0; i < QUEUED; i++) {
    try {
      await ReminderScheduler?.cancel(`${BACKUP_REMINDER_PREFIX}${i}`);
    } catch (_) {}
  }
};

/**
 * Re-queues the reminders. `firstRecordAt` is when the oldest vehicle was
 * added (every record belongs to one). Never prompts for permission.
 */
export const syncBackupReminder = async ({ email, firstRecordAt } = {}) => {
  if (!ReminderScheduler) return;
  await cancelQueued();
  if (!email) return;
  if (!(await getBackupReminderOn(email)) || !(await isNotificationsEnabled())) return;

  const lastBackupAt = await getLastBackupAt(email);
  let anchor = null;
  try {
    anchor = JSON.parse((await readScoped(ANCHOR_KEY, email)) || 'null');
  } catch (_) {}
  const plan = planBackupReminders({ lastBackupAt, firstRecordAt, anchor });
  if (!plan.anchor) return;
  await writeScoped(ANCHOR_KEY, email, JSON.stringify(plan.anchor));

  for (let i = 0; i < plan.times.length; i++) {
    await ReminderScheduler.schedule(
      `${BACKUP_REMINDER_PREFIX}${i}`,
      tr('Back up your vehicle data'),
      tr('Make a backup file so you have your own copy of every record and photo.'),
      plan.times[i],
    );
  }
};

export const isBackupReminderId = id => String(id || '').startsWith(BACKUP_REMINDER_PREFIX);
