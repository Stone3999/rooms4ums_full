package com.rooms4ums.wear

import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import com.google.android.gms.wearable.Wearable

/**
 * Actividad principal del reloj.
 *
 *  1. Pide el permiso de notificaciones (Android 13+ / Wear OS 3).
 *  2. Session: login propio contra el backend NestJS (mismo endpoint que
 *     web y movil). Necesario para registrar el token FCM del reloj.
 *  3. Arranca el servicio de telemetria en primer plano   (PRACTICA 1).
 *  4. Muestra el estado del enlace con el telefono       (PRACTICA 2).
 *  5. Resuelve las URLs preasignadas de las notificaciones (PRACTICA 3).
 */
class MainActivity : AppCompatActivity() {

    private lateinit var statusText: TextView
    private lateinit var sensorText: TextView

    private lateinit var loginPanel: View
    private lateinit var userInput: EditText
    private lateinit var passInput: EditText
    private lateinit var loginButton: Button
    private lateinit var loginMessage: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        statusText = findViewById(R.id.status)
        sensorText = findViewById(R.id.sensores)
        loginPanel = findViewById(R.id.login_panel)
        userInput = findViewById(R.id.input_usuario)
        passInput = findViewById(R.id.input_password)
        loginButton = findViewById(R.id.btn_login)
        loginMessage = findViewById(R.id.login_mensaje)

        requestNotificationPermission()
        startTelemetryService()
        checkPhoneConnection()
        handleDeepLink(intent)

        // Si ya hay sesion, se omite el login y se registra el push.
        if (WearSession.hasSession(this)) {
            showLoginPanel(false)
            statusText.text = getString(R.string.status_sesion_ok)
            WearSession.registerPushToken(this) { result ->
                Log.i(TAG, "Registro FCM: $result")
            }
        } else {
            showLoginPanel(true)
        }

        loginButton.setOnClickListener { attemptLogin() }

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

    private fun attemptLogin() {
        val identifier = userInput.text.toString().trim()
        val password = passInput.text.toString()

        if (identifier.isEmpty() || password.isEmpty()) {
            loginMessage.text = getString(R.string.login_completar)
            return
        }

        loginButton.isEnabled = false
        loginMessage.text = getString(R.string.login_enviando)

        WearSession.login(this, identifier, password) { ok, message ->
            loginButton.isEnabled = true

            if (ok) {
                loginMessage.text = getString(R.string.login_exitoso)
                showLoginPanel(false)
                statusText.text = getString(R.string.status_sesion_ok)
                WearSession.registerPushToken(this) { result ->
                    Log.i(TAG, "Registro FCM tras login: $result")
                }
            } else {
                loginMessage.text = getString(R.string.login_error, message)
            }
        }
    }

    private fun showLoginPanel(visible: Boolean) {
        loginPanel.visibility = if (visible) View.VISIBLE else View.GONE
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