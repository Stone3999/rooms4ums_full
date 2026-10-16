package com.rooms4ums.wear

import android.util.Log
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.WearableListenerService

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
                Log.i(TAG, "Post creado en $room: $title")
                Notify.show(this, "${room.uppercase()}: $title")
            }

            else -> Log.i(TAG, "Ruta ignorada: $path")
        }
    }

    override fun onDataChanged(dataEvents: DataEventBuffer) {
        // Telemetría de sensores publicada por TelemetryService.
        while (dataEvents.hasNext()) {
            val event = dataEvents.next()
            if (event.type == TelemetryService.PATH_TELEMETRY) {
                val map = event.dataMap
                Log.i(
                    TAG,
                    "Telemetría: magnitud=${map.get(TelemetryService.KEY_MAGNITUDE)} " +
                        "bateria=${map.get(TelemetryService.KEY_BATTERY)}"
                )
            }
        }
        dataEvents.release()
    }

    companion object {
        private const val TAG = "Rooms4umsDataLayer"

        const val PATH_OPEN_ROOM = "/rooms4ums/open-room"
        const val PATH_POST_CREATED = "/rooms4ums/post-created"
    }
}

/** Publica notificaciones propias del módulo de wearable. */
object Notify {
    private const val CHANNEL_ID = "eventos"

    fun show(context: android.content.Context, text: String) {
        val manager = context.getSystemService(android.app.NotificationManager::class.java)

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
}