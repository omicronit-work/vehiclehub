package com.vehiclehub.reminders

import android.app.AlarmManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * ACTION_FIRE: an alarm went off — post the reminder. Runs without the React
 * Native runtime, so it works when the app has been closed.
 *
 * Boot / app update / exact-alarm permission change: alarms don't survive a
 * reboot or reinstall, so re-arm everything still pending. A reminder missed
 * while the phone was off is shown now if it is less than a day late.
 */
class ReminderReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      ReminderScheduler.ACTION_FIRE -> {
        val id = intent.getStringExtra(ReminderScheduler.EXTRA_ID) ?: return
        val reminder = ReminderStore.get(context, id) ?: return
        ReminderNotifications.show(context, reminder)
        ReminderStore.remove(context, id)
      }
      Intent.ACTION_BOOT_COMPLETED,
      Intent.ACTION_MY_PACKAGE_REPLACED,
      AlarmManager.ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED -> restoreAll(context)
    }
  }

  private fun restoreAll(context: Context) {
    val now = System.currentTimeMillis()
    for (reminder in ReminderStore.all(context)) {
      when {
        reminder.fireAt > now -> ReminderScheduler.arm(context, reminder)
        now - reminder.fireAt < ONE_DAY_MS -> {
          ReminderNotifications.show(context, reminder)
          ReminderStore.remove(context, reminder.id)
        }
        else -> ReminderStore.remove(context, reminder.id)
      }
    }
  }

  private companion object {
    const val ONE_DAY_MS = 24 * 60 * 60 * 1000L
  }
}
