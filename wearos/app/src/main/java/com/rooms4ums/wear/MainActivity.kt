package com.rooms4ums.wear

import android.app.Activity
import android.content.Intent
import android.content.SharedPreferences
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.widget.Button
import android.widget.EditText
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
    private lateinit var chatHistoryText: TextView
    private lateinit var chatInput: EditText

    /** Se dispara cuando el servicio guarda el JWT que mandó el celular. */
    private val prefsListener = SharedPreferences.OnSharedPreferenceChangeListener { _, key ->
        if (key == SharedPrefs.KEY_JWT) updateSessionStatus()
    }
    private val chatPrefsListener = SharedPreferences.OnSharedPreferenceChangeListener { _, key ->
        if (key == WearChatStore.KEY_MESSAGES) updateChatHistory()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        statusText = findViewById(R.id.status)
        sessionText = findViewById(R.id.sesion)
        sensorText = findViewById(R.id.sensores)
        chatHistoryText = findViewById(R.id.chat_history)
        chatInput = findViewById(R.id.chat_input)
        findViewById<Button>(R.id.chat_send).setOnClickListener { sendChatReply() }

        requestNotificationPermission()
        startTelemetryService()
        checkPhoneConnection()
        handleDeepLink(intent)
        updateSessionStatus()
        updateChatHistory()
    }

    override fun onResume() {
        super.onResume()
        SharedPrefs.prefs(this).registerOnSharedPreferenceChangeListener(prefsListener)
        WearChatStore.prefs(this).registerOnSharedPreferenceChangeListener(chatPrefsListener)
        updateSessionStatus()
        updateChatHistory()
    }

    override fun onPause() {
        SharedPrefs.prefs(this).unregisterOnSharedPreferenceChangeListener(prefsListener)
        WearChatStore.prefs(this).unregisterOnSharedPreferenceChangeListener(chatPrefsListener)
        super.onPause()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleDeepLink(intent)
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

    private fun updateChatHistory() {
        chatHistoryText.text = WearChatStore.history(this)
    }

    private fun sendChatReply() {
        val message = chatInput.text.toString().trim()
        if (message.isEmpty()) {
            chatInput.error = "Escribe un mensaje"
            return
        }

        Wearable.getNodeClient(this).connectedNodes
            .addOnSuccessListener { nodes ->
                val phone = nodes.firstOrNull()
                if (phone == null) {
                    sensorText.text = getString(R.string.status_sin_telefono)
                    return@addOnSuccessListener
                }

                val id = UUID.randomUUID().toString()
                val payload = JSONObject()
                    .put("id", id)
                    .put("sender", "Wear OS")
                    .put("message", message)
                    .toString()
                    .toByteArray(Charsets.UTF_8)

                Wearable.getMessageClient(this)
                    .sendMessage(phone.id, WearDataLayerListener.PATH_CHAT_REPLY, payload)
                    .addOnSuccessListener {
                        WearChatStore.append(this, id, "Wear OS", message)
                        chatInput.text.clear()
                        chatInput.error = null
                        updateChatHistory()
                        sensorText.text = "Mensaje enviado al teléfono"
                    }
                    .addOnFailureListener {
                        sensorText.text = getString(R.string.status_error_enlace)
                    }
            }
            .addOnFailureListener {
                sensorText.text = getString(R.string.status_error_enlace)
            }
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
    }
}
