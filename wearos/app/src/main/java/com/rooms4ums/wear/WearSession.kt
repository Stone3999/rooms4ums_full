package com.rooms4ums.wear

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

/**
 * Sesion del reloj contra el backend NestJS.
 *
 * El reloj es un cliente mas de Rooms4ums: usa el mismo endpoint
 * POST /api/auth/login-password que la web y la app movil, y comparte con
 * ellos la misma tabla de usuarios y la misma sesion JWT.
 *
 * MOTIVACION DE DISENO:
 * El reloj necesita un JWT para registrar su token FCM contra el backend.
 * Compartirlo desde Flutter exigiria un plugin de terceros para Data Layer,
 * que introduce riesgo de compilacion y no es necesario. Darle su propio
 * login al reloj evita esa dependencia y, de paso, lo convierte en un
 * cliente autonomouso de la plataforma.
 */
object WearSession {

    private const val TAG = "Rooms4umsWearSession"
    private const val BASE_URL = "https://rooms4ums.onrender.com"

    private val client = OkHttpClient()
    private val mainHandler = Handler(Looper.getMainLooper())

    private val jsonMedia = "application/json; charset=utf-8".toMediaType()

    /** Indica si ya hay una sesion guardada. */
    fun hasSession(context: Context): Boolean =
        !SharedPrefs.getJwt(context).isNullOrEmpty()

    /**
     * Inicia sesion contra el backend y guarda el JWT.
     *
     * @param onResult true/false con el mensaje de error si aplica.
     */
    fun login(context: Context, identifier: String, password: String, onResult: (Boolean, String) -> Unit) {
        Thread {
            try {
                val body = JSONObject().apply {
                    put("identifier", identifier)
                    put("password", password)
                }.toString()

                val request = Request.Builder()
                    .url("$BASE_URL/api/auth/login-password")
                    .post(body.toRequestBody(jsonMedia))
                    .build()

                client.newCall(request).execute().use { response ->
                    val raw = response.body?.string().orEmpty()

                    if (!response.isSuccessful) {
                        val message = runCatching { JSONObject(raw).optString("message") }
                            .getOrNull()
                            ?.takeIf { it.isNotBlank() }
                            ?: "Error ${response.code}"
                        Log.e(TAG, "Login fallo: $message")
                        post { onResult(false, message) }
                        return@use
                    }

                    val token = JSONObject(raw).optString("token")
                    if (token.isEmpty()) {
                        post { onResult(false, "El servidor no devolvio token") }
                        return@use
                    }

                    SharedPrefs.saveJwt(context, token)
                    Log.i(TAG, "Sesion iniciada en el reloj")
                    post { onResult(true, "OK") }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error de red en login: ${e.message}")
                post { onResult(false, "Sin conexion: ${e.message}") }
            }
        }.start()
    }

    /** Cierra la sesion local del reloj. */
    fun logout(context: Context) {
        SharedPrefs.saveJwt(context, "")
    }

    /**
     * Registra el token FCM del reloj usando el JWT almacenado.
     * Se invoca tras un login exitoso o al arrancar si ya hay sesion.
     */
    fun registerPushToken(context: Context, onResult: (String) -> Unit) {
        val jwt = SharedPrefs.getJwt(context)
        if (jwt.isNullOrEmpty()) {
            post { onResult("sin sesion") }
            return
        }

        try {
            // El listener de la Task se ejecuta en el HILO PRINCIPAL. Por eso
            // aquí no se puede hacer red: la petición la hace PushRegistration,
            // que corre sobre Dispatchers.IO.
            com.google.firebase.messaging.FirebaseMessaging.getInstance().token
                .addOnSuccessListener { fcmToken ->
                    SharedPrefs.saveToken(context, fcmToken)
                    PushRegistration.send(context, fcmToken, jwt) { result ->
                        post { onResult(result) }
                    }
                }
                .addOnFailureListener {
                    Log.e(TAG, "No se pudo obtener el token FCM: ${it.message}")
                    post { onResult("sin token FCM") }
                }
        } catch (e: Exception) {
            // Ocurre si google-services.json no se procesó (FirebaseApp nulo).
            Log.e(TAG, "Firebase no inicializado: ${e.message}")
            post { onResult("firebase no inicializado") }
        }
    }

    /** Ejecuta en el hilo principal: la UI solo puede tocarse desde ahi. */
    private fun post(block: () -> Unit) {
        mainHandler.post(block)
    }
}