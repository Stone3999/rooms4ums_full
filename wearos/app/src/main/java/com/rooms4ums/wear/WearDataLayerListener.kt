package com.rooms4ums.wear

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.WearableListenerService
import org.json.JSONObject

/**
 * PRÁCTICA 2 - ConexIÓN IoT.
 *
 * Receptor de mensajes enviados por el teléfono a través del Data Layer API,
 * que viaja por Bluetooth Low Energy.
 *
 * Data Layer tiene dos canales:
 *
 *   1) Data API -> putDataItem. Para datos que "quedan": el último valor se
 *      conserva y se sincroniza cuando el otro dispositivo entra en alcance.
 *      Es el canal de la telemetría de sensores.
 *
 *   2) Message API -> sendMessage. Para eventos que no se pueden perder y que
 *      deben llegar aunque el otro lado esté en pantalla. Es el canal de
 *      "abre esta sala" o "hay post nuevo".
 *
 * Esta clase atiende ambos canales del lado del reloj.
 */
class WearDataLayerListener : WearableListenerService() {

    override fun onMessageReceived(messageEvent: MessageEvent) {
        val path = messageEvent.path
        Log.i(TAG, "Mensaje del teléfono: $path")

        when (path) {
            PATH_LINK -> {
                // El celular manda su JWT al vincular el reloj. Con la sesión
                // guardada, el reloj registra su PROPIO token FCM y empieza a
                // recibir los mismos pushes que el teléfono.
                val raw = messageEvent.data.toString(Charsets.UTF_8)
                val json = runCatching { JSONObject(raw) }.getOrNull()
                val jwt = json?.optString("jwt").orEmpty()
                val username = json?.optString("username").orEmpty()

                if (jwt.isEmpty()) {
                    Log.e(TAG, "Vinculacion sin JWT")
                    Notify.show(this, "Vinculacion invalida")
                } else {
                    SharedPrefs.saveJwt(this, jwt)
                    Log.i(TAG, "Sesion vinculada desde el celular: $username")
                    WearSession.registerPushToken(this) { result ->
                        Log.i(TAG, "Token FCM tras vinculacion: $result")
                    }
                    Notify.show(this, "Vinculado a ${username.ifEmpty { "tu cuenta" }}")
                }
            }

            PATH_OPEN_ROOM -> {
                val slug = messageEvent.data.toString(Charsets.UTF_8)
                Log.i(TAG, "Solicitud de abrir sala: $slug")
                // El reloj no tiene interfaz de foro; confirma y notifica.
                // La navegación real ocurre en el teléfono.
                Notify.show(this, "Sala: $slug")
            }

            PATH_POST_CREATED -> {
                val raw = messageEvent.data.toString(Charsets.UTF_8)
                val room = Regex("\"room\":\"([^\"]*)\"").find(raw)?.groupValues?.get(1) ?: "foro"
                val title = Regex("\"title\":\"([^\"]*)\"").find(raw)?.groupValues?.get(1) ?: raw
                Log.i(TAG, "Post creado en $room")
                Notify.show(this, "${room.uppercase()}: $title")
            }

            WearCallDataLayer.PATH_CALL_STATUS -> {
                val raw = messageEvent.data.toString(Charsets.UTF_8)
                val json = runCatching { JSONObject(raw) }.getOrNull()
                if (json == null) {
                    Log.e(TAG, "Estado de llamada inválido")
                    return
                }

                val active = json.optBoolean("active")
                val muted = json.optBoolean("muted")
                val callId = json.optString("callId")
                val room = json.optString("room")
                val username = json.optString("username")
                val preferences = getSharedPreferences(
                    WearCallDataLayer.CALL_PREFERENCES,
                    Context.MODE_PRIVATE,
                )
                val changed = preferences.getBoolean(WearCallDataLayer.KEY_CALL_ACTIVE, false) != active ||
                    preferences.getBoolean(WearCallDataLayer.KEY_CALL_MUTED, false) != muted ||
                    preferences.getString(WearCallDataLayer.KEY_CALL_ID, "") != callId
                preferences.edit()
                    .putBoolean(WearCallDataLayer.KEY_CALL_ACTIVE, json.optBoolean("active"))
                    .putBoolean(WearCallDataLayer.KEY_CALL_MUTED, json.optBoolean("muted"))
                    .putString(WearCallDataLayer.KEY_CALL_ID, callId)
                    .putString(WearCallDataLayer.KEY_CALL_ROOM, room)
                    .putString(WearCallDataLayer.KEY_CALL_USERNAME, username)
                    .apply()

                if (active && changed) {
                    Notify.showCall(this, muted, room, username)
                } else if (!active) {
                    Notify.clearCall(this)
                }
                Log.i(TAG, "Estado de llamada actualizado: $active")
            }

            else -> Log.i(TAG, "Ruta ignorada: $path")
        }
    }

    override fun onDataChanged(dataEvents: DataEventBuffer) {
        // Telemetría de sensores publicada por TelemetryService.
        try {
            for (event in dataEvents) {
                if (event.type != DataEvent.TYPE_CHANGED) continue

                val path = event.dataItem.uri.path ?: continue
                if (path != TelemetryService.PATH_TELEMETRY) continue

                val map = DataMapItem.fromDataItem(event.dataItem).dataMap
                Log.i(
                    TAG,
                    "Telemetría: magnitud=${map.getFloat(TelemetryService.KEY_MAGNITUDE)} " +
                        "bateria=${map.getInt(TelemetryService.KEY_BATTERY)}"
                )
            }
        } finally {
            dataEvents.release()
        }
    }

    companion object {
        private const val TAG = "Rooms4umsDataLayer"

        const val PATH_LINK = "/rooms4ums/link"
        const val PATH_OPEN_ROOM = "/rooms4ums/open-room"
        const val PATH_POST_CREATED = "/rooms4ums/post-created"
    }
}

object WearCallDataLayer {
    const val PATH_CALL_STATUS = "/rooms4ums/call-status"
    const val PATH_CALL_ACTION = "/rooms4ums/call-action"
    const val CALL_PREFERENCES = "rooms4ums_wear_call"
    const val KEY_CALL_ACTIVE = "active"
    const val KEY_CALL_MUTED = "muted"
    const val KEY_CALL_ID = "call_id"
    const val KEY_CALL_ROOM = "room"
    const val KEY_CALL_USERNAME = "username"
    const val ACTION_TOGGLE_MUTE = "toggle_mute"
    const val ACTION_HANG_UP = "hang_up"
}

/** Publica notificaciones propias del módulo de wearable. */
object Notify {
    private const val CHANNEL_ID = WearApplication.CHANNEL_EVENTS
    private const val CALL_NOTIFICATION_ID = 4_206

    fun show(context: android.content.Context, text: String) {
        val manager = context.getSystemService(android.app.NotificationManager::class.java) ?: return

        manager.createNotificationChannel(
            android.app.NotificationChannel(
                CHANNEL_ID,
                "Eventos de Rooms4ums",
                android.app.NotificationManager.IMPORTANCE_DEFAULT
            )
        )

        val notification = androidx.core.app.NotificationCompat
            .Builder(context, CHANNEL_ID)
            .setContentTitle("Rooms4ums")
            .setContentText(text)
            .setSmallIcon(R.drawable.ic_watch_notification)
            .build()

        manager.notify(text.hashCode() and 0x7fffffff, notification)
    }

    fun showCall(context: Context, muted: Boolean, room: String, username: String) {
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        manager.createNotificationChannel(
            android.app.NotificationChannel(
                CHANNEL_ID,
                "Eventos de Rooms4ums",
                NotificationManager.IMPORTANCE_HIGH,
            )
        )

        fun actionIntent(action: String, requestCode: Int): PendingIntent {
            val intent = Intent(context, MainActivity::class.java)
                .setAction(MainActivity.ACTION_CALL_CONTROL)
                .putExtra(MainActivity.EXTRA_CALL_ACTION, action)
            return PendingIntent.getActivity(
                context,
                requestCode,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        }

        val openIntent = PendingIntent.getActivity(
            context,
            CALL_NOTIFICATION_ID,
            Intent(context, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val text = buildString {
            if (username.isNotBlank()) append("$username · ")
            append(room.ifBlank { "Canal de voz" })
            if (muted) append(" · MICRÓFONO SILENCIADO")
        }
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_watch_notification)
            .setContentTitle("EN LLAMADA · Rooms4ums")
            .setContentText(text)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(openIntent)
            .addAction(
                R.drawable.ic_watch_notification,
                if (muted) "ACTIVAR MICRO" else "SILENCIAR",
                actionIntent(WearCallDataLayer.ACTION_TOGGLE_MUTE, 1),
            )
            .addAction(
                R.drawable.ic_watch_notification,
                "COLGAR",
                actionIntent(WearCallDataLayer.ACTION_HANG_UP, 2),
            )
            .build()
        manager.notify(CALL_NOTIFICATION_ID, notification)
    }

    fun clearCall(context: Context) {
        context.getSystemService(NotificationManager::class.java)
            ?.cancel(CALL_NOTIFICATION_ID)
    }
}