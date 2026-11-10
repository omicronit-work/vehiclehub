package com.vehiclehub.reminders

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.modules.core.PermissionAwareActivity
import com.facebook.react.modules.core.PermissionListener
import com.vehiclehub.specs.NativeReminderSchedulerSpec

/** TurboModule backing specs/NativeReminderScheduler.ts. */
class ReminderSchedulerModule(reactContext: ReactApplicationContext) :
    NativeReminderSchedulerSpec(reactContext) {

  override fun getName() = NAME

  override fun areNotificationsEnabled(promise: Promise) {
    promise.resolve(ReminderNotifications.areEnabled(reactApplicationContext))
  }

  override fun requestPermission(promise: Promise) {
    val context = reactApplicationContext
    ReminderNotifications.ensureChannel(context)

    val needsRuntimePrompt =
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) !=
                PackageManager.PERMISSION_GRANTED
    val activity = context.currentActivity as? PermissionAwareActivity
    if (!needsRuntimePrompt || activity == null) {
      promise.resolve(ReminderNotifications.areEnabled(context))
      return
    }

    // Once the user has denied twice Android answers immediately without a
    // prompt; the JS side then offers openNotificationSettings().
    activity.requestPermissions(
        arrayOf(Manifest.permission.POST_NOTIFICATIONS),
        PERMISSION_REQUEST_CODE,
        PermissionListener { requestCode, _, _ ->
          if (requestCode != PERMISSION_REQUEST_CODE) return@PermissionListener false
          promise.resolve(ReminderNotifications.areEnabled(context))
          true
        },
    )
  }

  override fun canScheduleExactAlarms(): Boolean =
      ReminderScheduler.canScheduleExact(reactApplicationContext)

  override fun schedule(id: String, title: String, body: String, fireAt: Double, promise: Promise) {
    try {
      ReminderNotifications.ensureChannel(reactApplicationContext)
      val exact =
          ReminderScheduler.schedule(
              reactApplicationContext,
              Reminder(id, title, body, fireAt.toLong()),
          )
      promise.resolve(exact)
    } catch (e: Exception) {
      promise.reject("E_SCHEDULE", e.message, e)
    }
  }

  override fun cancel(id: String, promise: Promise) {
    ReminderScheduler.cancel(reactApplicationContext, id)
    promise.resolve(null)
  }

  override fun cancelAll(promise: Promise) {
    ReminderScheduler.cancelAll(reactApplicationContext)
    promise.resolve(null)
  }

  override fun openNotificationSettings(promise: Promise) {
    val context = reactApplicationContext
    val intent =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
              .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
        } else {
          appDetailsIntent()
        }
    startSettings(intent, promise)
  }

  override fun openAlarmSettings(promise: Promise) {
    val intent =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM)
              .setData(Uri.fromParts("package", reactApplicationContext.packageName, null))
        } else {
          appDetailsIntent()
        }
    startSettings(intent, promise)
  }

  private fun appDetailsIntent() =
      Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
          .setData(Uri.fromParts("package", reactApplicationContext.packageName, null))

  private fun startSettings(intent: Intent, promise: Promise) {
    try {
      reactApplicationContext.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("E_SETTINGS", e.message, e)
    }
  }

  companion object {
    const val NAME = NativeReminderSchedulerSpec.NAME
    private const val PERMISSION_REQUEST_CODE = 4127
  }
}
