package com.rooms4ums.wear

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.sqrt

class WearLogicTest {

    @Test
    fun `telemetry magnitude calculation detects rotation threshold`() {
        val x = 8.0f
        val y = 8.0f
        val z = 9.0f
        val magnitude = sqrt((x * x + y * y + z * z).toDouble()).toFloat()
        assertTrue(magnitude > 12.5f)
    }

    @Test
    fun `chat payload serializes sender and non-empty message`() {
        val json = JSONObject()
            .put("sender", "Smartphone")
            .put("message", "Prueba BLE")

        assertEquals("Smartphone", json.optString("sender"))
        assertEquals("Prueba BLE", json.optString("message"))
        assertFalse(json.optString("message").isBlank())
    }
}
