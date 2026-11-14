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
export const LAST_BACKUP_KEY = 'backup:lastAt';
const SWITCH_KEY = 'backup:remind';
const ANCHOR_KEY = 'backup:reminderAnchor';

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

export const getBackupReminderOn = async () => (await AsyncStorage.getItem(SWITCH_KEY)) !== 'off';
export const setBackupReminderOn = on => AsyncStorage.setItem(SWITCH_KEY, on ? 'on' : 'off');

export const getLastBackupAt = async () => {
  const v = Number(await AsyncStorage.getItem(LAST_BACKUP_KEY));
  return Number.isFinite(v) && v > 0 ? v : null;
};

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
export const syncBackupReminder = async ({ firstRecordAt } = {}) => {
  if (!ReminderScheduler) return;
  await cancelQueued();
  if (!(await getBackupReminderOn()) || !(await isNotificationsEnabled())) return;

  const lastBackupAt = await getLastBackupAt();
  let anchor = null;
  try {
    anchor = JSON.parse((await AsyncStorage.getItem(ANCHOR_KEY)) || 'null');
  } catch (_) {}
  const plan = planBackupReminders({ lastBackupAt, firstRecordAt, anchor });
  if (!plan.anchor) return;
  await AsyncStorage.setItem(ANCHOR_KEY, JSON.stringify(plan.anchor));

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
