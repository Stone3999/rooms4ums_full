package com.rooms4ums.wear

import android.util.Log
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.WearableListenerService
import org.json.JSONException
import org.json.JSONObject

class WearDataLayerListener : WearableListenerService() {
    override fun onMessageReceived(messageEvent: MessageEvent) {
        when (messageEvent.path) {
            PATH_LINK -> linkPhoneAccount(messageEvent.data.toString(Charsets.UTF_8))
            PATH_POST_CREATED -> showNewPost(messageEvent.data.toString(Charsets.UTF_8))
            else -> Log.i(TAG, "Ruta de mensaje ignorada: ${messageEvent.path}")
        }
    }

    private fun linkPhoneAccount(raw: String) {
        val payload = try {
            JSONObject(raw)
        } catch (error: JSONException) {
            Log.e(TAG, "Mensaje de vinculación inválido", error)
            return
        }
        val jwt = payload.optString("jwt")
        if (jwt.isBlank()) {
            Log.e(TAG, "Mensaje de vinculación sin sesión")
            return
        }

        SharedPrefs.saveJwt(this, jwt)
        WearSession.registerPushToken(this) { result ->
            Log.i(TAG, "Registro de notificaciones: $result")
        }
    }

    private fun showNewPost(raw: String) {
        val payload = try {
            JSONObject(raw)
        } catch (error: JSONException) {
            Log.e(TAG, "Notificación de publicación inválida", error)
            return
        }
        val title = payload.optString("title").ifBlank { "Nueva publicación" }
        val room = payload.optString("room")
        val postId = payload.optString("postId").ifBlank { "$room:$title" }
        val body = room.takeIf(String::isNotBlank)?.let { "Nueva publicación en $it" }
            ?: "Hay una publicación nueva en Rooms4ums"
        val deepLink = payload.optString("postId")
            .takeIf(String::isNotBlank)
            ?.let { "rooms4ums://post/$it" + (room.takeIf(String::isNotBlank)?.let { slug -> "?room=$slug" } ?: "") }

        WearPostNotifier.showPost(this, postId, title, body, deepLink)
    }

    companion object {
        private const val TAG = "Rooms4umsDataLayer"
        const val PATH_LINK = "/rooms4ums/link"
        const val PATH_POST_CREATED = "/rooms4ums/post-created"
    }
}
