package com.vehiclehub.reminders

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.vehiclehub.R

/** Posting and cancelling the visible notification for a reminder. */
object ReminderNotifications {
  // Same id the previous (notifee) implementation used, so users keep any
  // per-channel settings they already changed.
  const val CHANNEL_ID = "vehicle-reminders"

  // Reminders are addressed by tag (the reminder id); the numeric id is fixed.
  private const val NOTIFICATION_ID = 1

  // Ids of service schedule reminders (src/util/schedule/scheduleReminders.js).
  private const val SCHEDULE_PREFIX = "sched-"

  fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(NotificationManager::class.java)
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    manager.createNotificationChannel(
        NotificationChannel(CHANNEL_ID, "Vehicle reminders", NotificationManager.IMPORTANCE_HIGH)
    )
  }

  fun areEnabled(context: Context): Boolean {
    val compat = NotificationManagerCompat.from(context)
    if (!compat.areNotificationsEnabled()) return false
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
        ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED) {
      return false
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel =
          context.getSystemService(NotificationManager::class.java).getNotificationChannel(CHANNEL_ID)
      if (channel?.importance == NotificationManager.IMPORTANCE_NONE) return false
    }
    return true
  }

  fun show(context: Context, reminder: Reminder) {
    if (!areEnabled(context)) return
    ensureChannel(context)

    val launch =
        context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
          // Service schedule reminders open their schedule: React Native's
          // Linking reads ACTION_VIEW data (getInitialURL on a cold start, the
          // "url" event when MainActivity is already running — singleTask).
          if (reminder.id.startsWith(SCHEDULE_PREFIX)) {
            action = Intent.ACTION_VIEW
            data = Uri.parse("vehiclehub://reminder/" + Uri.encode(reminder.id))
          }
        }
    val contentIntent =
        launch?.let {
          PendingIntent.getActivity(
              context,
              reminder.id.hashCode(),
              it,
              PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
          )
        }

    val notification =
        NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(reminder.title)
            .setContentText(reminder.body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(reminder.body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setAutoCancel(true)
            .setContentIntent(contentIntent)
            .build()

    try {
      NotificationManagerCompat.from(context).notify(reminder.id, NOTIFICATION_ID, notification)
    } catch (_: SecurityException) {
      // Permission revoked between the check and the post.
    }
  }

  fun dismiss(context: Context, id: String) {
    NotificationManagerCompat.from(context).cancel(id, NOTIFICATION_ID)
  }

  fun dismissAll(context: Context) {
    NotificationManagerCompat.from(context).cancelAll()
  }
}
