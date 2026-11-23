import { getReminderRecords } from '../store/userSlice.js';
import { cancelOrphanedReminders, scheduleReminder, reminderId } from './notifications.js';
import { fetchVehicleByEmail } from '../store/fetchSlice.js';
import { syncAllSchedules } from './schedule/scheduleReminders.js';

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
  // A record deleted (or its reminder turned off) on another phone leaves
  // its reminder queued here: cancel every one no current record asks for.
  // Self-correcting: anything cancelled wrongly is queued again below or on
  // the next run.
  await cancelOrphanedReminders(records.map(r => reminderId(r.kind, r.id)))
    .catch(e => console.log('Orphaned reminder cleanup failed:', e));
  let count = 0;
  for (const r of records) {
    try {
      const res = await scheduleReminder({
        id: reminderId(r.kind, r.id),
        kind: r.kind,
        subject: r.subject,
        body: r.body,
        dueDate: r.dueDate,
        daysBefore: r.daysBefore,
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

/**
 * Service schedules (util/schedule): re-checks distance alerts and re-queues
 * the timed ones for every vehicle. Run at sign-in, whenever the app comes
 * back to the foreground, and after notification permission is granted.
 */
export async function resyncScheduleReminders(email) {
  if (!email) return;
  const vehicles = await fetchVehicleByEmail(email);
  await syncAllSchedules(email, vehicles.map(v => v.id));
}
