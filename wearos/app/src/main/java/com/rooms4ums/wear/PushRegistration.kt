package com.rooms4ums.wear

import android.content.Context
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

/**
 * Registro del token FCM del reloj contra el backend.
 *
 * Usa el mismo contrato que la app movil (POST /api/push/register). Como el
 * `token` es la clave primaria unica de `device_tokens`, el reloj queda
 * asociado al mismo usuario sin necesidad de un esquema nuevo.
 */
object PushRegistration {

    private const val TAG = "Rooms4umsWearReg"
    private const val BASE_URL = "https://rooms4ums.onrender.com"

    private val client = OkHttpClient()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val jsonMedia = "application/json; charset=utf-8".toMediaType()

    fun send(context: Context, fcmToken: String, jwt: String, onResult: (String) -> Unit) {
        scope.launch {
            try {
                val payload = JSONObject().apply {
                    put("token", fcmToken)
                    put("platform", "wearos")
                }.toString()

                val request = Request.Builder()
                    .url("$BASE_URL/api/push/register")
                    .addHeader("Authorization", "Bearer $jwt")
                    .post(payload.toRequestBody(jsonMedia))
                    .build()

                client.newCall(request).execute().use { response ->
                    val result = "HTTP ${response.code}"
                    Log.i(TAG, "Token registrado: $result")
                    onResult(result)
                }
            } catch (e: Exception) {
                Log.e(TAG, "No se pudo registrar el reloj: ${e.message}")
            }
        }
    }
}