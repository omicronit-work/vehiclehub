import { Alert } from 'react-native';
import { Toast } from 'toastify-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  scheduleReminder,
  openNotificationSettings,
  requestNotificationPermission,
  isNotificationsEnabled,
} from './notifications.js';

const toast = (type, text1, text2) =>
  Toast.show({ type, text1, text2, position: 'top', visibilityTime: 3500, autoHide: true });

const ASKED_KEY = 'notifPermissionAsked';

const ask = (title, message, buttons) =>
  new Promise(resolve =>
    Alert.alert(
      title,
      message,
      buttons.map(b => ({ ...b, onPress: () => resolve(b.value) })),
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );

/**
 * Asks for notification permission at the moment it's needed (a reminder is
 * switched on, a schedule is saved) — never at launch. The first time, a short
 * explanation comes before the system prompt; if the user says no, they're
 * told what that means and how to turn it on later. Resolves whether
 * notifications are allowed.
 */
export async function askNotificationPermission({ what = 'this' } = {}) {
  try {
    if (await isNotificationsEnabled()) return true;

    const askedBefore = await AsyncStorage.getItem(ASKED_KEY);
    if (!askedBefore) {
      const go = await ask(
        'Get reminders?',
        `VehicleHub can remind you before ${what} is due, even when the app is closed. Android will ask you to allow notifications next.`,
        [
          { text: 'Not now', style: 'cancel', value: false },
          { text: 'Continue', value: true },
        ],
      );
      if (!go) return false;
      await AsyncStorage.setItem(ASKED_KEY, 'true');
    }
    if (await requestNotificationPermission()) return true;
  } catch (err) {
    console.log('Error requesting notification permission:', err);
  }

  Alert.alert(
    'Notifications are off',
    "You won't get reminders until notifications are allowed. Everything else still works, and you can turn them on later in Settings.",
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Open settings', onPress: () => openNotificationSettings().catch(() => {}) },
    ],
  );
  return false;
}

/**
 * Called when the user switches "Remind me" ON. Resolves false when
 * notifications end up not allowed, so the toggle stays OFF.
 */
export const ensureReminderPermission = () => askNotificationPermission({ what: 'this' });

/**
 * Schedules a reminder after a record is saved and tells the user when it
 * didn't work, instead of leaving "Remind me" showing ON with nothing behind
 * it. Never throws — the record itself is already saved.
 */
export async function scheduleReminderWithFeedback(args) {
  try {
    const res = await scheduleReminder(args);
    if (res.scheduled) return res;

    if (res.reason === 'permission') {
      // Explain first; only deep-link if the user asks to.
      Alert.alert(
        'Notifications are off',
        `Your record was saved, but VehicleHub can't remind you about "${args.subject}" until notifications are allowed.`,
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open settings', onPress: () => openNotificationSettings().catch(() => {}) },
        ],
      );
    } else if (res.reason === 'unsupported') {
      toast('info', 'No reminder set', "Reminders aren't available on this device yet.");
    } else if (res.reason === 'past') {
      toast('info', 'No reminder set', 'That date has already passed.');
    } else {
      toast('error', "Reminder couldn't be set", 'Check the date and try again.');
    }
    return res;
  } catch (err) {
    console.log('Reminder scheduling failed:', err);
    toast('error', "Reminder couldn't be set", 'Your record was saved. Try editing it to set the reminder again.');
    return { scheduled: false, reason: 'error' };
  }
}
