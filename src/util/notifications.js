import notifee, {
  AndroidImportance,
  AndroidNotificationSetting,
  AuthorizationStatus,
  TriggerType,
} from '@notifee/react-native';
import { Platform } from 'react-native';

const CHANNEL_ID = 'vehicle-reminders';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const REMINDER_HOUR = 9; // local time the reminder fires, on the day before the due date

let channelPromise = null;
const ensureChannel = () => {
  if (Platform.OS !== 'android') return Promise.resolve();
  if (!channelPromise) {
    channelPromise = notifee.createChannel({
      id: CHANNEL_ID,
      name: 'Vehicle reminders',
      importance: AndroidImportance.HIGH,
    });
  }
  return channelPromise;
};

/** Whether the app is currently allowed to show notifications at all. */
export async function isNotificationsEnabled() {
  const settings = await notifee.getNotificationSettings();
  return settings.authorizationStatus === AuthorizationStatus.AUTHORIZED;
}

/**
 * Shows the OS permission prompt if it hasn't been answered yet.
 * Once the user has denied it, the OS won't show the prompt again — the
 * caller should fall back to `openNotificationSettings()` in that case.
 */
export async function requestNotificationPermission() {
  await ensureChannel();
  const settings = await notifee.requestPermission();
  return settings.authorizationStatus === AuthorizationStatus.AUTHORIZED;
}

/** Deep-links into the OS notification settings screen for this app. */
export async function openNotificationSettings() {
  await notifee.openNotificationSettings();
}

/**
 * Android 12+ only allows exact (AlarmManager) triggers once the user has
 * flipped on "Alarms & reminders" for the app in system settings. Without it
 * we still schedule — just via WorkManager, which may fire a few minutes
 * late. That's fine for a day-before reminder, and far better than throwing
 * the user into system settings in the middle of saving a record.
 */
async function canUseExactAlarms() {
  if (Platform.OS !== 'android') return true;
  const settings = await notifee.getNotificationSettings();
  return settings.android?.alarm === AndroidNotificationSetting.ENABLED;
}

/** Deep-links to Android's "Alarms & reminders" setting for this app. */
export async function openAlarmSettings() {
  await notifee.openAlarmPermissionSettings();
}

export const reminderId = (kind, recordId) => `${kind}-${recordId}`;

const reminderTitle = (kind, subject, when) =>
  kind === 'document' ? `${subject} expires ${when}` : `${subject} is due ${when}`;

/**
 * Schedules a local notification for 9am the day before `dueDate`. When that
 * moment has already passed but the due date hasn't (e.g. a record added the
 * afternoon before, or on the day itself), it falls back to 9am on the due
 * day — or a minute from now if that has passed too — so the user still gets
 * a heads-up. No-ops once the due day is over.
 *
 * Notification permission is requested here — i.e. the first time the user
 * actually saves a reminder — rather than at app start, so the one-shot iOS
 * prompt appears with context. Pass `prompt: false` for background
 * rescheduling, which must never pop a permission dialog.
 *
 * Resolves to { scheduled: true } or { scheduled: false, reason } where
 * reason is 'past' | 'permission' | 'invalid'. Callers should surface
 * failures — see util/reminderFeedback.js.
 */
export async function scheduleReminder({ id, kind, subject, body, dueDate, prompt = true }) {
  if (!dueDate) return { scheduled: false, reason: 'invalid' };

  const due = new Date(typeof dueDate?.toDate === 'function' ? dueDate.toDate() : dueDate);
  if (Number.isNaN(due.getTime())) return { scheduled: false, reason: 'invalid' };

  const now = Date.now();
  const dayBefore = new Date(due.getTime() - ONE_DAY_MS);
  dayBefore.setHours(REMINDER_HOUR, 0, 0, 0);
  const dueDayMorning = new Date(due);
  dueDayMorning.setHours(REMINDER_HOUR, 0, 0, 0);
  const dueDayEnd = new Date(due);
  dueDayEnd.setHours(23, 59, 59, 999);

  let fireAt;
  let title;
  if (dayBefore.getTime() > now) {
    fireAt = dayBefore.getTime();
    title = reminderTitle(kind, subject, 'tomorrow');
  } else if (dueDayEnd.getTime() > now) {
    fireAt = Math.max(dueDayMorning.getTime(), now + 60 * 1000);
    title = reminderTitle(kind, subject, 'today');
  } else {
    return { scheduled: false, reason: 'past' };
  }

  await ensureChannel();
  const allowed = prompt ? await requestNotificationPermission() : await isNotificationsEnabled();
  if (!allowed) return { scheduled: false, reason: 'permission' };

  const exact = await canUseExactAlarms();

  await notifee.createTriggerNotification(
    {
      id,
      title,
      body,
      android: {
        channelId: CHANNEL_ID,
        pressAction: { id: 'default' },
      },
    },
    {
      type: TriggerType.TIMESTAMP,
      timestamp: fireAt,
      ...(exact ? { alarmManager: { allowWhileIdle: true } } : {}),
    },
  );
  return { scheduled: true, exact };
}

export async function cancelReminder(id) {
  try {
    await notifee.cancelNotification(id);
  } catch (_) {}
}

// Cancels every scheduled reminder on this device — used on logout and
// account deletion so the next user doesn't get the previous user's alerts.
export async function cancelAllReminders() {
  try {
    await notifee.cancelAllNotifications();
  } catch (_) {}
}
