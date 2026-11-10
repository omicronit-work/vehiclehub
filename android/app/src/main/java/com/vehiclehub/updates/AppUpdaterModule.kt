package com.vehiclehub.updates

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.UpdateAvailability
import com.vehiclehub.specs.NativeAppUpdaterSpec

/** TurboModule backing specs/NativeAppUpdater.ts. */
class AppUpdaterModule(reactContext: ReactApplicationContext) :
    NativeAppUpdaterSpec(reactContext) {

  private val manager by lazy { AppUpdateManagerFactory.create(reactApplicationContext) }

  override fun getName() = NAME

  override fun checkForUpdate(promise: Promise) {
    manager.appUpdateInfo
        .addOnSuccessListener { info ->
          val availability = info.updateAvailability()
          promise.resolve(
              Arguments.createMap().apply {
                putBoolean("available", availability == UpdateAvailability.UPDATE_AVAILABLE)
                putBoolean(
                    "inProgress",
                    availability == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS,
                )
                putBoolean("immediateAllowed", info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE))
                putInt("availableVersionCode", info.availableVersionCode())
              }
          )
        }
        .addOnFailureListener { e ->
          promise.reject("CHECK_FAILED", e.message ?: "Could not check for updates", e)
        }
  }

  override fun startUpdate(promise: Promise) {
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "The app isn't in the foreground")
      return
    }

    // AppUpdateInfo can only start one flow, so always fetch a fresh one.
    manager.appUpdateInfo
        .addOnSuccessListener { info ->
          val availability = info.updateAvailability()
          val canStart =
              availability == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS ||
                  (availability == UpdateAvailability.UPDATE_AVAILABLE &&
                      info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE))
          if (!canStart) {
            promise.reject("NOT_ALLOWED", "Google Play can't start the update here")
            return@addOnSuccessListener
          }

          manager
              .startUpdateFlow(
                  info,
                  activity,
                  AppUpdateOptions.defaultOptions(AppUpdateType.IMMEDIATE),
              )
              .addOnSuccessListener { resultCode -> promise.resolve(resultCode == Activity.RESULT_OK) }
              .addOnFailureListener { e ->
                promise.reject("UPDATE_FAILED", e.message ?: "Could not start the update", e)
              }
        }
        .addOnFailureListener { e ->
          promise.reject("CHECK_FAILED", e.message ?: "Could not check for updates", e)
        }
  }

  override fun openStore(promise: Promise) {
    val packageName = reactApplicationContext.packageName
    val market =
        Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=$packageName"))
            .setPackage("com.android.vending")
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    try {
      reactApplicationContext.startActivity(market)
    } catch (_: ActivityNotFoundException) {
      // No Play Store app: fall back to the web listing.
      val web =
          Intent(
                  Intent.ACTION_VIEW,
                  Uri.parse("https://play.google.com/store/apps/details?id=$packageName"),
              )
              .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      try {
        reactApplicationContext.startActivity(web)
      } catch (e: ActivityNotFoundException) {
        promise.reject("NO_STORE", "No app can open Google Play", e)
        return
      }
    }
    promise.resolve(null)
  }

  companion object {
    const val NAME = "AppUpdater"
  }
}
