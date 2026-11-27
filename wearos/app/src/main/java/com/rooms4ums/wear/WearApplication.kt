package com.rooms4ums.wear

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager

/**
 * Punto de entrada del proceso del reloj.
 *
 * MOTIVACION: cuando la app está cerrada y llega un push con bloque
 * `notification`, es el sistema (no la app) quien dibuja el aviso, y usa el
 * `channelId` que venga en el mensaje. Si ese canal no existe todavía, Android
 * lo descarta o cae a un canal de importancia mínima. Como el backend manda
 * `rooms4ums_remoto`, el canal debe existir ANTES de cualquier push: por eso se
 * crea aquí, que corre en cuanto arranca el proceso (incluso si el proceso lo
 * levanta el propio servicio de FCM).
 */
class WearApplication : Application() {

    override fun onCreate() {
        super.onCreate()
        val manager = getSystemService(NotificationManager::class.java) ?: return

        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_REMOTE,
                "Actividad en el foro",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Posts nuevos en Rooms4ums"
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 220, 120, 220)
            }
        )

    }

    companion object {
        const val CHANNEL_REMOTE = "rooms4ums_remoto"
    }
}
