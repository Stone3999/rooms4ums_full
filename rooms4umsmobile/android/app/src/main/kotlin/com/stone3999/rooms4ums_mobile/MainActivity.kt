package com.stone3999.rooms4ums_mobile

import android.net.Uri
import com.google.android.gms.wearable.CapabilityClient
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.Node
import com.google.android.gms.wearable.Wearable
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import org.json.JSONObject

/**
 * PRÁCTICA 2 - Puente IoT entre el celular y el reloj.
 *
 * Flutter no trae un plugin oficial del Data Layer, así que se expone con un
 * MethodChannel. El reloj se descubre con NodeClient (nodos conectados) y con
 * CapabilityClient (capability `rooms4ums_wear` declarada en el manifiesto del
 * reloj), se le envía la sesión por MessageClient y se lee su telemetría con
 * DataClient a través del Google Play Services Data Layer.
 */
class MainActivity : FlutterActivity() {

    private val channelName = "rooms4ums/wear"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, channelName)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "status" -> status(result)
                    "link" -> link(
                        call.argument<String>("jwt"),
                        call.argument<String>("username"),
                        result,
                    )
                    "test" -> test(result)
                    "chat" -> chat(
                        call.argument<String>("id"),
                        call.argument<String>("sender"),
                        call.argument<String>("message"),
                        result,
                    )
                    "telemetry" -> telemetry(result)
                    "chatReplies" -> chatReplies(result)
                    else -> result.notImplemented()
                }
            }
    }

    /** Relojes conectados + si tienen instalada la app de Rooms4ums. */
    private fun status(result: MethodChannel.Result) {
        Wearable.getNodeClient(this).connectedNodes
            .addOnSuccessListener { nodes ->
                Wearable.getCapabilityClient(this)
                    .getCapability(WEAR_CAPABILITY, CapabilityClient.FILTER_REACHABLE)
                    .addOnSuccessListener { capability ->
                        val wearIds = capability.nodes.map { it.id }.toSet()
                        val payload = nodes.map { node ->
                            mapOf(
                                "id" to node.id,
                                "name" to (node.displayName ?: "Wear OS"),
                                "nearby" to node.isNearby,
                                "wearApp" to wearIds.contains(node.id),
                            )
                        }

                        result.success(
                            mapOf(
                                "connected" to payload.isNotEmpty(),
                                "nodes" to payload,
                            )
                        )
                    }
                    .addOnFailureListener { e ->
                        result.success(
                            mapOf(
                                "connected" to nodes.isNotEmpty(),
                                "nodes" to nodes.map { node ->
                                    mapOf(
                                        "id" to node.id,
                                        "name" to (node.displayName ?: "Wear OS"),
                                        "nearby" to node.isNearby,
                                        "wearApp" to false,
                                    )
                                },
                                "error" to e.message,
                            )
                        )
                    }
            }
            .addOnFailureListener { e ->
                result.success(
                    mapOf(
                        "connected" to false,
                        "nodes" to emptyList<Map<String, Any?>>(),
                        "error" to e.message,
                    )
                )
            }
    }

    /** Envía el JWT del celular al reloj para que registre su propio token FCM. */
    private fun link(jwt: String?, username: String?, result: MethodChannel.Result) {
        if (jwt.isNullOrBlank()) {
            result.success(mapOf("ok" to false, "error" to "NO HAY SESION EN EL CELULAR"))
            return
        }

        withWearAppNode(result) { node ->
            val payload = JSONObject()
                .put("jwt", jwt)
                .put("username", username ?: "")
                .toString()
                .toByteArray(Charsets.UTF_8)

            Wearable.getMessageClient(this)
                .sendMessage(node.id, PATH_LINK, payload)
                .addOnSuccessListener {
                    result.success(
                        mapOf("ok" to true, "node" to (node.displayName ?: "Wear OS"))
                    )
                }
                .addOnFailureListener { e ->
                    result.success(mapOf("ok" to false, "error" to e.message))
                }
        }
    }

    /** Manda un evento de prueba: el reloj debe mostrar una notificación. */
    private fun test(result: MethodChannel.Result) {
        withWearAppNode(result) { node ->
            val payload = JSONObject()
                .put("room", "general")
                .put("title", "Prueba desde el celular")
                .toString()
                .toByteArray(Charsets.UTF_8)

            Wearable.getMessageClient(this)
                .sendMessage(node.id, PATH_POST_CREATED, payload)
                .addOnSuccessListener { result.success(mapOf("ok" to true)) }
                .addOnFailureListener { e ->
                    result.success(mapOf("ok" to false, "error" to e.message))
                }
        }
    }

    /** Envía un mensaje breve directo al reloj por Data Layer (Práctica 6). */
    private fun chat(id: String?, sender: String?, message: String?, result: MethodChannel.Result) {
        val clean = message?.trim().orEmpty()
        if (clean.isEmpty()) {
            result.success(mapOf("ok" to false, "error" to "MENSAJE VACÍO"))
            return
        }

        withWearAppNode(result) { node ->
            val payload = JSONObject()
                .put("id", id ?: System.currentTimeMillis().toString())
                .put("sender", sender ?: "Smartphone")
                .put("message", clean)
                .toString()
                .toByteArray(Charsets.UTF_8)

            Wearable.getMessageClient(this)
                .sendMessage(node.id, PATH_CHAT, payload)
                .addOnSuccessListener { result.success(mapOf("ok" to true)) }
                .addOnFailureListener { e ->
                    result.success(mapOf("ok" to false, "error" to e.message))
                }
        }
    }

    private fun chatReplies(result: MethodChannel.Result) {
        val preferences = getSharedPreferences(
            WearReplyListener.PREFERENCES,
            MODE_PRIVATE,
        )
        val replies = preferences.getString(WearReplyListener.KEY_REPLIES, "[]") ?: "[]"
        preferences.edit().remove(WearReplyListener.KEY_REPLIES).apply()
        result.success(replies)
    }

    private fun withWearAppNode(
        result: MethodChannel.Result,
        action: (Node) -> Unit,
    ) {
        Wearable.getCapabilityClient(this)
            .getCapability(WEAR_CAPABILITY, CapabilityClient.FILTER_REACHABLE)
            .addOnSuccessListener { capability ->
                val wearIds = capability.nodes.map { it.id }.toSet()
                Wearable.getNodeClient(this).connectedNodes
                    .addOnSuccessListener { nodes ->
                        val node = nodes.firstOrNull { it.id in wearIds }
                        if (node == null) {
                            result.success(
                                mapOf("ok" to false, "error" to "NO HAY UNA APP ROOMS4UMS CONECTADA EN EL RELOJ")
                            )
                        } else {
                            action(node)
                        }
                    }
                    .addOnFailureListener { e ->
                        result.success(mapOf("ok" to false, "error" to e.message))
                    }
            }
            .addOnFailureListener { e ->
                result.success(mapOf("ok" to false, "error" to e.message))
            }
    }

    /** Última muestra de telemetría que publicó el reloj (Práctica 1 + 2). */
    private fun telemetry(result: MethodChannel.Result) {
        val uri = Uri.parse("wear://*/$PATH_TELEMETRY")

        Wearable.getDataClient(this).getDataItems(uri)
            .addOnSuccessListener { buffer ->
                try {
                    val item = buffer.firstOrNull()
                    if (item == null) {
                        result.success(null)
                        return@addOnSuccessListener
                    }

                    val map = DataMapItem.fromDataItem(item).dataMap
                    result.success(
                        mapOf(
                            "magnitude" to map.getFloat(KEY_MAGNITUDE),
                            "battery" to map.getInt(KEY_BATTERY),
                            "rotated" to map.getBoolean(KEY_ROTATED),
                            "ts" to map.getLong(KEY_TIMESTAMP),
                        )
                    )
                } finally {
                    buffer.release()
                }
            }
            .addOnFailureListener { result.success(null) }
    }

    companion object {
        private const val WEAR_CAPABILITY = "rooms4ums_wear"

        private const val PATH_LINK = "/rooms4ums/link"
        private const val PATH_POST_CREATED = "/rooms4ums/post-created"
        private const val PATH_CHAT = "/rooms4ums/chat"
        private const val PATH_TELEMETRY = "/rooms4ums/telemetry"

        private const val KEY_MAGNITUDE = "mag"
        private const val KEY_BATTERY = "bat"
        private const val KEY_ROTATED = "rot"
        private const val KEY_TIMESTAMP = "ts"
    }
}
