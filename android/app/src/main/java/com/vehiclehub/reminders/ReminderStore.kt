package com.vehiclehub.reminders

import android.content.Context
import org.json.JSONObject

data class Reminder(val id: String, val title: String, val body: String, val fireAt: Long)

/**
 * Pending reminders, persisted natively so the receivers can post and
 * reschedule them without starting React Native. An entry is removed once its
 * notification has been shown or it is cancelled.
 */
object ReminderStore {
  private const val PREFS = "vehiclehub_reminders"

  private fun prefs(context: Context) =
      context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun put(context: Context, reminder: Reminder) {
    val json =
        JSONObject()
            .put("title", reminder.title)
            .put("body", reminder.body)
            .put("fireAt", reminder.fireAt)
            .toString()
    prefs(context).edit().putString(reminder.id, json).apply()
  }

  fun get(context: Context, id: String): Reminder? =
      prefs(context).getString(id, null)?.let { parse(id, it) }

  fun all(context: Context): List<Reminder> =
      prefs(context).all.mapNotNull { (id, value) -> (value as? String)?.let { parse(id, it) } }

  fun remove(context: Context, id: String) {
    prefs(context).edit().remove(id).apply()
  }

  fun clear(context: Context) {
    prefs(context).edit().clear().apply()
  }

  private fun parse(id: String, raw: String): Reminder? =
      try {
        val json = JSONObject(raw)
        Reminder(id, json.getString("title"), json.optString("body"), json.getLong("fireAt"))
      } catch (_: Exception) {
        null
      }
}
