package com.rooms4ums.wear

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

object WearChatStore {
    const val PREFERENCES = "rooms4ums_wear_chat"
    const val KEY_MESSAGES = "messages"
    private const val MAX_MESSAGES = 30

    fun prefs(context: Context) =
        context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)

    fun append(context: Context, id: String, sender: String, message: String) {
        val preferences = prefs(context)
        val current = runCatching { JSONArray(preferences.getString(KEY_MESSAGES, "[]")) }
            .getOrElse { JSONArray() }
        val updated = JSONArray()

        for (index in (current.length() - MAX_MESSAGES + 1).coerceAtLeast(0) until current.length()) {
            updated.put(current.getJSONObject(index))
        }
        updated.put(
            JSONObject()
                .put("id", id)
                .put("sender", sender)
                .put("message", message)
                .put("timestamp", System.currentTimeMillis())
        )
        preferences.edit().putString(KEY_MESSAGES, updated.toString()).apply()
    }

    fun history(context: Context): String {
        val preferences = prefs(context)
        val messages = runCatching { JSONArray(preferences.getString(KEY_MESSAGES, "[]")) }
            .getOrElse { JSONArray() }
        if (messages.length() == 0) return "Sin mensajes todavía"

        return (0 until messages.length())
            .map { messages.getJSONObject(it) }
            .takeLast(5)
            .joinToString("\n") { "${it.optString("sender")}: ${it.optString("message")}" }
    }
}
