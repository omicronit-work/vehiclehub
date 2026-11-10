import ReminderScheduler from '../../specs/NativeReminderScheduler';

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

const reminderTitle = (kind, subject, when) =>
  kind === 'document' ? `${subject} expires ${when}` : `${subject} is due ${when}`;

const whenLabel = (days) => (days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`);

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
  if (remindAt.getTime() > now) return { fireAt: remindAt.getTime(), daysLeft: lead };

  const todayMorning = new Date(now);
  todayMorning.setHours(REMINDER_HOUR, 0, 0, 0);
  const fireAt = Math.max(todayMorning.getTime(), now + 60 * 1000);
  const fireDay = new Date(fireAt);
  fireDay.setHours(0, 0, 0, 0);
  const daysLeft = Math.max(0, Math.round((dueDay.getTime() - fireDay.getTime()) / ONE_DAY_MS));
  return { fireAt, daysLeft };
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
 * reason is 'past' | 'permission' | 'invalid' | 'unsupported'. Callers should surface
 * failures — see util/reminderFeedback.js.
 */
export async function scheduleReminder({ id, kind, subject, body, dueDate, daysBefore, prompt = true }) {
  if (!ReminderScheduler) return { scheduled: false, reason: 'unsupported' };
  if (!dueDate) return { scheduled: false, reason: 'invalid' };

  const slot = reminderSlot(dueDate, Date.now(), daysBefore);
  if (!slot) return { scheduled: false, reason: Number.isNaN(toDate(dueDate).getTime()) ? 'invalid' : 'past' };
  const { fireAt, daysLeft } = slot;
  const title = reminderTitle(kind, subject, whenLabel(daysLeft));

  const allowed = prompt ? await requestNotificationPermission() : await isNotificationsEnabled();
  if (!allowed) return { scheduled: false, reason: 'permission' };

  const exact = await ReminderScheduler.schedule(id, title, body ?? '', fireAt);
  return { scheduled: true, exact };
}

export async function cancelReminder(id) {
  try {
    await ReminderScheduler?.cancel(id);
  } catch (_) {}
}

// Cancels every scheduled reminder on this device — used on logout and
// account deletion so the next user doesn't get the previous user's alerts.
export async function cancelAllReminders() {
  try {
    await ReminderScheduler?.cancelAll();
  } catch (_) {}
}
