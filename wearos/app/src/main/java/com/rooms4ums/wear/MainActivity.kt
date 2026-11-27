package com.rooms4ums.wear

import android.app.Activity
import android.content.Intent
import android.content.SharedPreferences
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.widget.Button
import android.widget.TextView
import androidx.core.app.ActivityCompat
import com.google.android.gms.wearable.Wearable
import org.json.JSONObject
import java.util.UUID

/**
 * Actividad principal del reloj. NO tiene login: la sesión llega desde el
 * celular por el Data Layer cuando el usuario pulsa "CONECTAR WEARABLE".
 *
 *  1. Pide el permiso de notificaciones (Android 13+ / Wear OS 3).
 *  2. Arranca el servicio de telemetría en primer plano (PRÁCTICA 1).
 *  3. Muestra el estado del enlace con el teléfono (PRÁCTICA 2).
 *  4. Muestra si la sesión ya fue vinculada y el push quedó activo.
 *  5. Resuelve las URLs preasignadas de las notificaciones (PRÁCTICA 3).
 */
class MainActivity : Activity() {

    private lateinit var statusText: TextView
    private lateinit var sessionText: TextView
    private lateinit var sensorText: TextView
    private lateinit var callStatusText: TextView
    private lateinit var callFeedbackText: TextView
    private lateinit var muteCallButton: Button
    private lateinit var hangUpButton: Button

    /** Se dispara cuando el servicio guarda el JWT que mandó el celular. */
    private val prefsListener = SharedPreferences.OnSharedPreferenceChangeListener { _, key ->
        if (key == SharedPrefs.KEY_JWT) updateSessionStatus()
    }
    private val callPrefsListener = SharedPreferences.OnSharedPreferenceChangeListener { _, key ->
        if (key in CALL_STATE_KEYS) updateCallStatus()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        statusText = findViewById(R.id.status)
        sessionText = findViewById(R.id.sesion)
        sensorText = findViewById(R.id.sensores)
        callStatusText = findViewById(R.id.call_status)
        callFeedbackText = findViewById(R.id.call_feedback)
        muteCallButton = findViewById(R.id.mute_call)
        hangUpButton = findViewById(R.id.hangup_call)
        muteCallButton.setOnClickListener {
            sendCallAction(WearCallDataLayer.ACTION_TOGGLE_MUTE)
        }
        hangUpButton.setOnClickListener {
            sendCallAction(WearCallDataLayer.ACTION_HANG_UP)
        }

        requestNotificationPermission()
        startTelemetryService()
        checkPhoneConnection()
        handleDeepLink(intent)
        updateSessionStatus()
        updateCallStatus()
        handleCallAction(intent)
    }

    override fun onResume() {
        super.onResume()
        SharedPrefs.prefs(this).registerOnSharedPreferenceChangeListener(prefsListener)
        getSharedPreferences(
            WearCallDataLayer.CALL_PREFERENCES,
            MODE_PRIVATE,
        ).registerOnSharedPreferenceChangeListener(callPrefsListener)
        updateSessionStatus()
        updateCallStatus()
    }

    override fun onPause() {
        SharedPrefs.prefs(this).unregisterOnSharedPreferenceChangeListener(prefsListener)
        getSharedPreferences(
            WearCallDataLayer.CALL_PREFERENCES,
            MODE_PRIVATE,
        ).unregisterOnSharedPreferenceChangeListener(callPrefsListener)
        super.onPause()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleDeepLink(intent)
        handleCallAction(intent)
    }

    /**
     * PRÁCTICA 3 - Si el usuario toca la notificación, la URL preasignada
     * llega como Intent data.
     */
    private fun handleDeepLink(intent: Intent?) {
        val data = intent?.data ?: return
        Log.i(TAG, "Deep link recibido: $data")
        statusText.text = getString(R.string.status_deep_link, data.toString())
    }

    /** La sesión la escribe el WearDataLayerListener cuando el celular vincula. */
    private fun updateSessionStatus() {
        val linked = WearSession.hasSession(this)
        sessionText.text = getString(
            if (linked) R.string.status_sesion_ok else R.string.status_esperando_vinculo
        )
    }

    private fun updateCallStatus() {
        val preferences = getSharedPreferences(
            WearCallDataLayer.CALL_PREFERENCES,
            MODE_PRIVATE,
        )
        val active = preferences.getBoolean(WearCallDataLayer.KEY_CALL_ACTIVE, false)
        val muted = preferences.getBoolean(WearCallDataLayer.KEY_CALL_MUTED, false)
        val room = preferences.getString(WearCallDataLayer.KEY_CALL_ROOM, "").orEmpty()
        val username = preferences.getString(WearCallDataLayer.KEY_CALL_USERNAME, "").orEmpty()

        callStatusText.text = if (active) {
            "EN LLAMADA${room.takeIf(String::isNotBlank)?.let { ": $it" } ?: ""}"
        } else {
            "SIN LLAMADA ACTIVA"
        }
        callStatusText.setTextColor(
            getColor(if (active) R.color.acento else R.color.texto_suave)
        )
        muteCallButton.text = if (muted) "ACTIVAR MICRO" else "SILENCIAR"
        muteCallButton.isEnabled = active
        hangUpButton.isEnabled = active
        findViewById<android.view.View>(R.id.call_controls).visibility =
            if (active) android.view.View.VISIBLE else android.view.View.GONE
        callFeedbackText.text = if (active && username.isNotBlank()) {
            "EN CURSO EN EL TELÉFONO DE $username"
        } else {
            ""
        }
    }

    private fun sendCallAction(action: String) {
        val preferences = getSharedPreferences(
            WearCallDataLayer.CALL_PREFERENCES,
            MODE_PRIVATE,
        )
        if (!preferences.getBoolean(WearCallDataLayer.KEY_CALL_ACTIVE, false)) {
            updateCallStatus()
            return
        }
        val callId = preferences.getString(WearCallDataLayer.KEY_CALL_ID, "").orEmpty()
        if (callId.isBlank()) {
            callFeedbackText.text = "ESTADO DE LLAMADA DESACTUALIZADO"
            return
        }

        Wearable.getNodeClient(this).connectedNodes
            .addOnSuccessListener { nodes ->
                val phone = nodes.firstOrNull()
                if (phone == null) {
                    callFeedbackText.text = getString(R.string.status_sin_telefono)
                    return@addOnSuccessListener
                }

                val payload = JSONObject()
                    .put("id", UUID.randomUUID().toString())
                    .put("callId", callId)
                    .put("action", action)
                    .toString()
                    .toByteArray(Charsets.UTF_8)

                Wearable.getMessageClient(this)
                    .sendMessage(phone.id, WearCallDataLayer.PATH_CALL_ACTION, payload)
                    .addOnSuccessListener {
                        callFeedbackText.text = "SOLICITUD ENVIADA AL TELÉFONO"
                    }
                    .addOnFailureListener {
                        callFeedbackText.text = getString(R.string.status_error_enlace)
                    }
            }
            .addOnFailureListener {
                callFeedbackText.text = getString(R.string.status_error_enlace)
            }
    }

    private fun handleCallAction(intent: Intent?) {
        if (intent?.action != ACTION_CALL_CONTROL) return
        val action = intent.getStringExtra(EXTRA_CALL_ACTION) ?: return
        sendCallAction(action)
    }

    /** PRÁCTICA 1 - El servicio en primer plano mantiene los sensores vivos. */
    private fun startTelemetryService() {
        val service = Intent(this, TelemetryService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(service)
        } else {
            startService(service)
        }
    }

    /**
     * PRÁCTICA 2 - Comprueba si hay un teléfono emparejado y en alcance.
     * Si `connectedNodes` viene vacío, no hay un teléfono enlazado y alcanzable.
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
                sensorText.text = getString(R.string.status_error_enlace)
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
        const val ACTION_CALL_CONTROL = "com.rooms4ums.wear.CALL_CONTROL"
        const val EXTRA_CALL_ACTION = "call_action"
        private val CALL_STATE_KEYS = setOf(
            WearCallDataLayer.KEY_CALL_ACTIVE,
            WearCallDataLayer.KEY_CALL_MUTED,
            WearCallDataLayer.KEY_CALL_ID,
            WearCallDataLayer.KEY_CALL_ROOM,
            WearCallDataLayer.KEY_CALL_USERNAME,
        )
    }
}
