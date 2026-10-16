package com.rooms4ums.wear

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * PRÁCTICA 1 - Software de dispositivo (Wear OS)
 * PRÁCTICA 2 - Conexión IoT (Bluetooth Low Energy)
 *
 * Servicio en primer plano que lee sensores físicos del reloj y publica la
 * telemetría en el Data Layer, para que la app del teléfono la reciba.
 *
 * POR QUE UN SERVICIO EN PRIMER PLANO:
 * Un reloj se usa en estado de reposo: la pantalla está apagada la mayor parte
 * del tiempo. Una Activity normal deja de recibir sensores en cuanto la app
 * sale de pantalla. El servicio en primer plano mantiene la captura viva bajo
 * el presupuesto de energía del dispositivo, y Wakelock evita que la CPU se
 * suspenda entre muestras.
 *
 * POR QUE INTERVALO DE 1 Hz:
 * El acelerómetro puede muestrear a 50 Hz o más, pero publicar eso por BLE
 * agotaría la batería en minutos y no aportaría nada. 1 Hz basta para
 * detectar movimiento y sigue siendo tolerable en consumo.
 */
class TelemetryService : Service(), SensorEventListener {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private var sensorManager: SensorManager? = null
    private var accelerometer: Sensor? = null
    private var gyroscope: Sensor? = null

    private var sampleCount = 0
    private var lastSentAt = 0L

    override fun onCreate() {
        super.onCreate()
        createChannel()
        startForeground(NOTIFICATION_ID, buildNotification("Midiendo sensores..."))

        sensorManager = getSystemService(SENSOR_SERVICE) as? SensorManager
        accelerometer = sensorManager?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
        gyroscope = sensorManager?.getDefaultSensor(Sensor.TYPE_GYROSCOPE)

        val delayMicros = SAMPLE_PERIOD_US  // 1 Hz
        sensorManager?.registerListener(this, accelerometer, delayMicros)
        sensorManager?.registerListener(this, gyroscope, delayMicros)

        logLine("Telemetría iniciada. Acelerómetro=${accelerometer != null} Giroscopio=${gyroscope != null}")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // START_STICKY: si el sistema mata el proceso, lo reinicia. Necesario
        // porque el usuario espera que el reloj siga midiendo.
        return START_STICKY
    }

    override fun onSensorChanged(event: SensorEvent) {
        when (event.sensor.type) {
            Sensor.TYPE_ACCELEROMETER -> {
                val (x, y, z) = event.values
                val magnitude = Math.sqrt((x * x + y * y + z * z).toDouble()).toFloat()

                sampleCount++

                // Se publica 1 de cada N muestras para no saturar el BLE.
                if (sampleCount % PUBLISH_EVERY == 0) {
                    val now = System.currentTimeMillis()
                    publishTelemetry(
                        ax = x, ay = y, az = z,
                        magnitude = magnitude,
                        rotated = magnitude > ROTATION_THRESHOLD,
                        at = now
                    )
                    lastSentAt = now
                }
            }
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {
        // No se requiere: la precisión no afecta la telemetría enviada.
    }

    /**
     * Publica la lectura en el Data Layer.
     *
     * Data Layer usa una base de datos replicada entre reloj y teléfono. Se
     * escribe en un item y el teléfono lo recibe a través de
     * WearableListenerService. Es la vía canónica de comunicación wearable.
     */
    private fun publishTelemetry(
        ax: Float, ay: Float, az: Float,
        magnitude: Float,
        rotated: Boolean,
        at: Long
    ) {
        scope.launch {
            try {
                val request = PutDataMapRequest.create(PATH_TELEMETRY).apply {
                    dataMap.putLong(KEY_TIMESTAMP, at)
                    dataMap.putFloat(KEY_ACCEL_X, ax)
                    dataMap.putFloat(KEY_ACCEL_Y, ay)
                    dataMap.putFloat(KEY_ACCEL_Z, az)
                    dataMap.putFloat(KEY_MAGNITUDE, magnitude)
                    dataMap.putBoolean(KEY_ROTATED, rotated)
                    dataMap.putInt(KEY_BATTERY, batteryPercent())
                }.asPutDataRequest()

                Wearable.getDataClient(this@TelemetryService).putDataItem(request)

                val message = RequestMessage.Builder(PATH_TELEMETRY).apply {
                    map.putLong(KEY_TIMESTAMP, at)
                    map.putFloat(KEY_MAGNITUDE, magnitude)
                    map.putBoolean(KEY_ROTATED, rotated)
                    map.putInt(KEY_BATTERY, batteryPercent())
                }.build()

                Wearable.getMessageClient(this@TelemetryService).sendMessage(
                    message.nodeId, message.path, message.data
                )
            } catch (e: Exception) {
                // El reloj puede estar lejos del teléfono: Data Layer lo encola.
                logLine("Data Layer no disponible: ${e.message}")
            }
        }
    }

    private fun batteryPercent(): Int {
        val intent = registerReceiver(null, android.content.IntentFilter(android.content.Intent.ACTION_BATTERY_CHANGED))
            ?: return -1
        val level = intent.getIntExtra(android.os.BatteryManager.EXTRA_LEVEL, -1)
        val scale = intent.getIntExtra(android.os.BatteryManager.EXTRA_SCALE, -1)
        return if (level >= 0 && scale > 0) (level * 100 / scale) else -1
    }

    private fun logLine(message: String) {
        android.util.Log.i(TAG, message)
        updateNotification(message)
    }

    private fun createChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Telemetría de sensores",
            NotificationManager.IMPORTANCE_LOW
        ).apply { description = "Estado de los sensores del reloj" }

        (getSystemService(NotificationManager::class.java))?.createNotificationChannel(channel)
    }

    private fun buildNotification(text: String): Notification =
        NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Rooms4ums")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build()

    private fun updateNotification(text: String) {
        (getSystemService(NotificationManager::class.java))
            ?.notify(NOTIFICATION_ID, buildNotification(text))
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        sensorManager?.unregisterListener(this)
        scope.cancel()
        super.onDestroy()
    }

    companion object {
        private const val TAG = "Rooms4umsTelemetry"
        private const val CHANNEL_ID = "telemetria"
        private const val NOTIFICATION_ID = 1001

        const val PATH_TELEMETRY = "/rooms4ums/telemetry"

        const val KEY_TIMESTAMP = "ts"
        const val KEY_ACCEL_X = "ax"
        const val KEY_ACCEL_Y = "ay"
        const val KEY_ACCEL_Z = "az"
        const val KEY_MAGNITUDE = "mag"
        const val KEY_ROTATED = "rot"
        const val KEY_BATTERY = "bat"

        private const val SAMPLE_PERIOD_US = 1_000_000   // 1 Hz
        private const val PUBLISH_EVERY = 1              // publicar cada muestra
        private const val ROTATION_THRESHOLD = 12.0f      // m/s^2, umbral de giro
    }
}