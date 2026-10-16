package com.rooms4ums.wear

import android.os.Build
import android.os.Bundle
import android.util.Log
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import com.google.android.gms.wearable.Wearable
import com.google.firebase.messaging.FirebaseMessaging

/**
 * Actividad principal del reloj.
 *
 *  1. Pide el permiso de notificaciones (Android 13+ / Wear OS 3).
 *  2. Arranca el servicio de telemetria en primer plano  (PRACTICA 1).
 *  3. Muestra el estado del enlace con el telefono      (PRACTICA 2).
 *  4. Resuelve las URLs preasignadas de las notificaciones (PRACTICA 3).
 */
class MainActivity : AppCompatActivity() {

    private lateinit var statusText: TextView
    private lateinit var sensorText: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        statusText = findViewById(R.id.status)
        sensorText = findViewById(R.id.sensores)

        requestNotificationPermission()
        startTelemetryService()

        checkPhoneConnection()
        handleDeepLink(intent)

        // El token FCM se registra cuando ya hay un JWT disponible.
        SharedPrefs.getJwt(this)?.let { jwt -> registerWearToken(jwt) }

        sensorText.postDelayed({ checkPhoneConnection() }, 5000)
    }

    override fun onNewIntent(intent: android.content.Intent) {
        super.onNewIntent(intent)
        handleDeepLink(intent)
    }

    /**
     * PRACTICA 3 - Si el usuario toca la notificacion, la URL preasignada
     * llega como Intent data.
     */
    private fun handleDeepLink(intent: android.content.Intent?) {
        val data = intent?.data ?: return
        Log.i(TAG, "Deep link recibido: $data")
        statusText.text = getString(R.string.status_deep_link, data.toString())
    }

    /** PRACTICA 1 - El servicio en primer plano mantiene los sensores vivos. */
    private fun startTelemetryService() {
        val service = android.content.Intent(this, TelemetryService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(service)
        } else {
            startService(service)
        }
    }

    /**
     * PRACTICA 2 - Comprueba si hay un telefono emparejado y en alcance.
     * Si `connectedNodes` viene vacio, el enlace BLE no esta activo.
     */
    private fun checkPhoneConnection() {
        Wearable.getNodeClient(this).connectedNodes
            .addOnSuccessListener { nodes ->
                statusText.text = if (nodes.isEmpty()) {
                    getString(R.string.status_sin_telefono)
                } else {
                    getString(R.string.status_conectado, nodes.size)
                }
                sensorText.text = getString(R.string.status_sensores_activos)
            }
            .addOnFailureListener {
                statusText.text = getString(R.string.status_error_enlace)
            }
    }

    /**
     * Registra el token FCM del reloj contra el mismo endpoint que usa el
     * movil. Un solo envio del backend notifica a ambos dispositivos.
     */
    private fun registerWearToken(jwt: String) {
        FirebaseMessaging.getInstance().token
            .addOnSuccessListener { fcmToken ->
                Log.i(TAG, "Token FCM del reloj: $fcmToken")
                SharedPrefs.saveToken(this, fcmToken)
                PushRegistration.send(applicationContext, fcmToken, jwt) { result ->
                    Log.i(TAG, "Registro remoto del reloj: $result")
                }
            }
            .addOnFailureListener {
                Log.e(TAG, "No se pudo obtener el token del reloj: ${it.message}")
            }
    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(android.Manifest.permission.POST_NOTIFICATIONS),
                100
            )
        }
    }

    companion object {
        private const val TAG = "Rooms4umsWearMain"
    }
}