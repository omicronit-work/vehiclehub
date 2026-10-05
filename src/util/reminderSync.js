import { getReminderRecords } from '../store/userSlice.js';
import { scheduleReminder, reminderId } from './notifications.js';

/**
 * Reminders live on the device, and logout cancels all of them (so the next
 * user doesn't inherit them). Call after sign-in to rebuild every future
 * "Remind me" reminder from Firestore. Silent: never prompts for permission;
 * if notifications are off this simply schedules nothing. Notification ids
 * are stable per record, so running it repeatedly just replaces them.
 */
export async function rescheduleAllReminders(email) {
  if (!email) return 0;
  const records = await getReminderRecords(email);
  let count = 0;
  for (const r of records) {
    try {
      const res = await scheduleReminder({
        id: reminderId(r.kind, r.id),
        kind: r.kind,
        subject: r.subject,
        body: r.body,
        dueDate: r.dueDate,
        prompt: false,
      });
      if (res.scheduled) count += 1;
      else if (res.reason === 'permission') break; // nothing else will succeed either
    } catch (e) {
      console.log('Reminder reschedule failed:', e);
    }
  }
  return count;
}
