package com.stone3999.rooms4ums_mobile

import android.content.Context
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.WearableListenerService
import org.json.JSONArray
import org.json.JSONObject

class WearReplyListener : WearableListenerService() {
    override fun onMessageReceived(messageEvent: MessageEvent) {
        if (messageEvent.path != PATH_CHAT_REPLY) return

        val payload = runCatching {
            JSONObject(messageEvent.data.toString(Charsets.UTF_8))
        }.getOrNull() ?: return
        val message = payload.optString("message").trim()
        if (message.isEmpty()) return

        val preferences = getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
        val current = runCatching { JSONArray(preferences.getString(KEY_REPLIES, "[]")) }
            .getOrElse { JSONArray() }
        val updated = JSONArray()
        for (index in (current.length() - MAX_REPLIES + 1).coerceAtLeast(0) until current.length()) {
            updated.put(current.getJSONObject(index))
        }
        updated.put(
            JSONObject()
                .put("id", payload.optString("id", messageEvent.requestId.toString()))
                .put("sender", payload.optString("sender", "Wear OS"))
                .put("message", message)
                .put("timestamp", System.currentTimeMillis())
        )
        preferences.edit().putString(KEY_REPLIES, updated.toString()).apply()
    }

    companion object {
        const val PATH_CHAT_REPLY = "/rooms4ums/chat-reply"
        const val PREFERENCES = "rooms4ums_wear_phone"
        const val KEY_REPLIES = "pending_chat_replies"
        private const val MAX_REPLIES = 50
    }
}
