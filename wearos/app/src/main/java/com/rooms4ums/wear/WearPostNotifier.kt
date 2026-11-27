package com.rooms4ums.wear

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log
import androidx.core.app.NotificationCompat
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject

object WearPostNotifier {
    private const val TAG = "Rooms4umsPostNotice"
    const val PREFERENCES = "rooms4ums_post_notifications"
    const val KEY_POSTS = "posts"
    private const val MAX_POSTS = 20

    fun showPost(
        context: Context,
        postId: String,
        title: String,
        body: String,
        deepLink: String?,
    ) {
        recordPost(context, postId, title, body)

        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        val intent = if (deepLink.isNullOrBlank()) {
            Intent(context, MainActivity::class.java)
        } else {
            Intent(
                Intent.ACTION_VIEW,
                Uri.parse(deepLink),
                context,
                MainActivity::class.java,
            )
        }
        val notificationId = postId.hashCode() and 0x7fffffff
        val pendingIntent = PendingIntent.getActivity(
            context,
            notificationId,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(context, WearApplication.CHANNEL_REMOTE)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setSmallIcon(R.drawable.ic_watch_notification)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build()

        manager.notify(notificationId, notification)
    }

    fun recordPost(context: Context, postId: String, title: String, body: String) {
        savePost(context, postId, title, body)
    }

    fun history(context: Context): String {
        val raw = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
            .getString(KEY_POSTS, "[]")
        val posts = try {
            JSONArray(raw)
        } catch (error: JSONException) {
            Log.e(TAG, "No se pudo leer el historial de publicaciones", error)
            return "NO SE PUDIERON CARGAR LAS PUBLICACIONES."
        }

        if (posts.length() == 0) return "AUN NO HAY PUBLICACIONES NUEVAS."

        return (0 until posts.length()).mapNotNull { index ->
            posts.optJSONObject(index)?.let { post ->
                val title = post.optString("title").ifBlank { "Nueva publicación" }
                val body = post.optString("body")
                if (body.isBlank()) title else "$title\n$body"
            }
        }.joinToString("\n\n")
    }

    private fun savePost(context: Context, postId: String, title: String, body: String) {
        synchronized(this) {
            val preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
            val existing = try {
                JSONArray(preferences.getString(KEY_POSTS, "[]"))
            } catch (error: JSONException) {
                Log.e(TAG, "Historial inválido; se iniciará uno nuevo", error)
                JSONArray()
            }
            val stableId = postId.ifBlank { "$title:$body" }
            val updated = JSONArray().put(
                JSONObject()
                    .put("id", stableId)
                    .put("title", title)
                    .put("body", body),
            )

            var stored = 1
            for (index in 0 until existing.length()) {
                val post = existing.optJSONObject(index) ?: continue
                if (post.optString("id") == stableId || stored >= MAX_POSTS) continue
                updated.put(post)
                stored++
            }

            preferences.edit().putString(KEY_POSTS, updated.toString()).apply()
        }
    }
}
