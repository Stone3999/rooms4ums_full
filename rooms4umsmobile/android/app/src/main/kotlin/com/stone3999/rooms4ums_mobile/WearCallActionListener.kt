package com.stone3999.rooms4ums_mobile

import android.content.Context
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.WearableListenerService
import org.json.JSONArray
import org.json.JSONObject

class WearCallActionListener : WearableListenerService() {
    override fun onMessageReceived(messageEvent: MessageEvent) {
        if (messageEvent.path != PATH_CALL_ACTION) return

        val payload = runCatching {
            JSONObject(messageEvent.data.toString(Charsets.UTF_8))
        }.getOrNull() ?: return
        val action = payload.optString("action")
        if (action !in setOf(ACTION_TOGGLE_MUTE, ACTION_HANG_UP)) return

        val preferences = getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
        val current = runCatching {
            JSONArray(preferences.getString(KEY_ACTIONS, "[]"))
        }.getOrElse { JSONArray() }
        val id = payload.optString("id", messageEvent.requestId.toString())
        if ((0 until current.length()).any {
                current.optJSONObject(it)?.optString("id") == id
            }
        ) {
            return
        }

        val updated = JSONArray()
        for (index in (current.length() - MAX_ACTIONS + 1).coerceAtLeast(0) until current.length()) {
            updated.put(current.getJSONObject(index))
        }
        updated.put(
            JSONObject()
                .put("id", id)
                .put("callId", payload.optString("callId"))
                .put("action", action)
        )
        preferences.edit().putString(KEY_ACTIONS, updated.toString()).apply()
    }

    companion object {
        const val PATH_CALL_ACTION = "/rooms4ums/call-action"
        const val PREFERENCES = "rooms4ums_wear_phone"
        const val KEY_ACTIONS = "pending_call_actions"
        const val ACTION_TOGGLE_MUTE = "toggle_mute"
        const val ACTION_HANG_UP = "hang_up"
        private const val MAX_ACTIONS = 20
    }
}
