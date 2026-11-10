package com.vehiclehub.reminders

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build

/**
 * Hands reminders to AlarmManager. The alarm belongs to the OS, so it fires
 * into [ReminderReceiver] whether or not the app process is alive.
 *
 * Exact alarms need "Alarms & reminders" (denied by default on Android 14+).
 * Without it we use setAndAllowWhileIdle — still delivered while the app is
 * closed and in Doze, just possibly a few minutes late.
 */
object ReminderScheduler {
  const val ACTION_FIRE = "com.vehiclehub.reminders.FIRE"
  const val EXTRA_ID = "id"

  fun canScheduleExact(context: Context): Boolean =
      Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
          context.getSystemService(AlarmManager::class.java).canScheduleExactAlarms()

  /** Persists and arms [reminder]. Returns whether an exact alarm was used. */
  fun schedule(context: Context, reminder: Reminder): Boolean {
    ReminderStore.put(context, reminder)
    return arm(context, reminder)
  }

  fun arm(context: Context, reminder: Reminder): Boolean {
    val alarms = context.getSystemService(AlarmManager::class.java)
    val operation = alarmIntent(context, reminder.id, PendingIntent.FLAG_UPDATE_CURRENT)!!
    if (canScheduleExact(context)) {
      try {
        alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, reminder.fireAt, operation)
        return true
      } catch (_: SecurityException) {
        // Permission revoked since the check; fall through to inexact.
      }
    }
    alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, reminder.fireAt, operation)
    return false
  }

  fun cancel(context: Context, id: String) {
    alarmIntent(context, id, PendingIntent.FLAG_NO_CREATE)?.let {
      context.getSystemService(AlarmManager::class.java).cancel(it)
      it.cancel()
    }
    ReminderStore.remove(context, id)
    ReminderNotifications.dismiss(context, id)
  }

  fun cancelAll(context: Context) {
    ReminderStore.all(context).forEach { cancel(context, it.id) }
    ReminderStore.clear(context)
    ReminderNotifications.dismissAll(context)
  }

  // The data URI makes each reminder's PendingIntent distinct.
  private fun alarmIntent(context: Context, id: String, flags: Int): PendingIntent? {
    val intent =
        Intent(context, ReminderReceiver::class.java)
            .setAction(ACTION_FIRE)
            .setData(Uri.fromParts("vehiclehub-reminder", id, null))
            .putExtra(EXTRA_ID, id)
    return PendingIntent.getBroadcast(context, 0, intent, flags or PendingIntent.FLAG_IMMUTABLE)
  }
}
