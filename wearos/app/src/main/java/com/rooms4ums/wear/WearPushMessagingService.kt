package com.rooms4ums.wear

import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class WearPushMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        SharedPrefs.saveToken(this, token)
        SharedPrefs.getJwt(this)?.let { jwt ->
            PushRegistration.send(this, token, jwt) { result ->
                Log.i(TAG, "Re-registro de avisos: $result")
            }
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val data = message.data
        val title = message.notification?.title
            ?: data["title"]
            ?: "Nueva publicación"
        val body = message.notification?.body
            ?: data["body"]
            ?: data["room"]?.let { "Nueva publicación en $it" }
            ?: "Hay una publicación nueva en Rooms4ums"
        val postId = data["postId"] ?: data["id"] ?: "$title:$body"
        val deepLink = data["postId"]?.let { id ->
            "rooms4ums://post/$id" + (data["room"]?.let { "?room=$it" } ?: "")
        }

        Log.i(TAG, "Publicación recibida: $postId")
        WearPostNotifier.showPost(this, postId, title, body, deepLink)
    }

    companion object {
        private const val TAG = "Rooms4umsWearPush"
    }
}
