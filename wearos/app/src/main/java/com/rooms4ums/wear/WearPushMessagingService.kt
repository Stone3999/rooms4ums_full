package com.rooms4ums.wear

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.net.Uri
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * PRACTICA 3 - Push remoto en el wearable.
 *
 * El reloj registra su PROPIO token FCM contra el mismo endpoint que usa el
 * telefono (POST /api/push/register). Consecuencia: un unico envio del backend
 * notifica al celular Y al reloj, sin necesidad de un puente entre Flutter y
 * el reloj.
 *
 * POR QUE LLEGA CON EL PROCESO MUERTO:
 * FCM pertenece al sistema operativo, no a la aplicacion. Android recibe el
 * mensaje por el canal de Google Play Services, levanta este servicio y
 * entrega la notificacion sin que la app tenga que abrirse.
 */
class WearPushMessagingService : FirebaseMessagingService() {

    /**
     * El token puede rotar (reinstalacion o rotacion de Google).
     * Se re-registra contra el backend si hay un JWT guardado.
     */
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.i(TAG, "Token FCM del reloj renovado")

        SharedPrefs.saveToken(this, token)
        SharedPrefs.getJwt(this)?.let { jwt ->
            PushRegistration.send(this, token, jwt) { result ->
                Log.i(TAG, "Re-registro: $result")
            }
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val data = message.data
        val title = message.notification?.title ?: data["title"] ?: "Rooms4ums"
        val body = message.notification?.body ?: data["body"] ?: "Actividad nueva en el foro"

        Log.i(TAG, "Push recibido: $title | postId=${data["postId"]}")

        val room = data["room"]
        val deepLink = data["postId"]?.let { id ->
            "rooms4ums://post/$id" + (room?.let { "?room=$it" } ?: "")
        }

        show(
            id = (data["postId"] ?: title).hashCode() and 0x7fffffff,
            title = title,
            body = body,
            deepLink = deepLink
        )
    }

    private fun show(id: Int, title: String, body: String, deepLink: String?) {
        val manager = getSystemService(NotificationManager::class.java)

        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_ID,
                "Actividad en el foro",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                enableVibration(true)
                // Patron doble: reconocible en la muneca sin mirar.
                vibrationPattern = longArrayOf(0, 220, 120, 220)
            }
        )

        val intent = if (deepLink != null) {
            Intent(Intent.ACTION_VIEW, Uri.parse(deepLink), this, MainActivity::class.java)
        } else {
            Intent(this, MainActivity::class.java)
        }

        val pending = PendingIntent.getActivity(
            this,
            id,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setSmallIcon(R.drawable.ic_watch_notification)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pending)
            .setAutoCancel(true)
            .build()

        manager.notify(id, notification)
    }

    companion object {
        private const val TAG = "Rooms4umsWearPush"
        private const val CHANNEL_ID = "rooms4ums_remoto"
    }
}