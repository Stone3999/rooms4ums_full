package com.rooms4ums.wear

import android.content.Context

/** Preferencias del reloj: token FCM propio y JWT compartido. */
object SharedPrefs {
    private const val NAME = "rooms4ums_wear"

    fun saveToken(context: Context, token: String) {
        prefs(context).edit().putString("fcm_token", token).apply()
    }

    fun getToken(context: Context): String? = prefs(context).getString("fcm_token", null)

    fun saveJwt(context: Context, jwt: String) {
        prefs(context).edit().putString("jwt", jwt).apply()
    }

    fun getJwt(context: Context): String? = prefs(context).getString("jwt", null)

    private fun prefs(context: Context) =
        context.getSharedPreferences(NAME, Context.MODE_PRIVATE)
}