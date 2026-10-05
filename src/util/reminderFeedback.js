import { Alert } from 'react-native';
import { Toast } from 'toastify-react-native';
import { scheduleReminder, openNotificationSettings } from './notifications.js';

const toast = (type, text1, text2) =>
  Toast.show({ type, text1, text2, position: 'top', visibilityTime: 3500, autoHide: true });

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
