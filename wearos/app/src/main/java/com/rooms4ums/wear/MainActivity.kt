package com.rooms4ums.wear

import android.app.Activity
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.content.SharedPreferences
import android.widget.TextView
import androidx.core.app.ActivityCompat

class MainActivity : Activity() {
    private lateinit var notificationHistory: TextView

    private val notificationPrefsListener =
        SharedPreferences.OnSharedPreferenceChangeListener { _, key ->
            if (key == WearPostNotifier.KEY_POSTS) updateNotificationHistory()
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        notificationHistory = findViewById(R.id.notification_history)
        requestNotificationPermission()
        recordPostFromIntent(intent)
        updateNotificationHistory()
    }

    override fun onResume() {
        super.onResume()
        getSharedPreferences(
            WearPostNotifier.PREFERENCES,
            MODE_PRIVATE,
        ).registerOnSharedPreferenceChangeListener(notificationPrefsListener)
        updateNotificationHistory()
    }

    override fun onPause() {
        getSharedPreferences(
            WearPostNotifier.PREFERENCES,
            MODE_PRIVATE,
        ).unregisterOnSharedPreferenceChangeListener(notificationPrefsListener)
        super.onPause()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        recordPostFromIntent(intent)
        updateNotificationHistory()
    }

    private fun recordPostFromIntent(intent: Intent?) {
        val extras = intent?.extras ?: return
        val postId = extras.getString("postId") ?: return
        val title = extras.getString("title")
            ?: extras.getString("gcm.n.title")
            ?: "Nueva publicación"
        val body = extras.getString("body")
            ?: extras.getString("gcm.n.body")
            ?: "Hay una publicación nueva en Rooms4ums"
        WearPostNotifier.recordPost(this, postId, title, body)
    }

    private fun updateNotificationHistory() {
        notificationHistory.text = WearPostNotifier.history(this)
    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(android.Manifest.permission.POST_NOTIFICATIONS),
                NOTIFICATION_PERMISSION_REQUEST,
            )
        }
    }

    companion object {
        private const val NOTIFICATION_PERMISSION_REQUEST = 100
    }
}
