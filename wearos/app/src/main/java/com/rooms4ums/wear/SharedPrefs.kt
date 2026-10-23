package com.rooms4ums.wear

import android.content.Context

/** Preferencias del reloj: token FCM propio y JWT vinculado desde el celular. */
object SharedPrefs {
    private const val NAME = "rooms4ums_wear"

    const val KEY_JWT = "jwt"
    const val KEY_TOKEN = "fcm_token"

    fun saveToken(context: Context, token: String) {
        prefs(context).edit().putString(KEY_TOKEN, token).apply()
    }

    fun getToken(context: Context): String? = prefs(context).getString(KEY_TOKEN, null)

    fun saveJwt(context: Context, jwt: String) {
        prefs(context).edit().putString(KEY_JWT, jwt).apply()
    }

    fun getJwt(context: Context): String? = prefs(context).getString(KEY_JWT, null)

    fun prefs(context: Context) =
        context.getSharedPreferences(NAME, Context.MODE_PRIVATE)
}