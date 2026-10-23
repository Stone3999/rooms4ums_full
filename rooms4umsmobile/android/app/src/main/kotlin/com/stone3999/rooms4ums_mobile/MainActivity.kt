package com.stone3999.rooms4ums_mobile

import android.net.Uri
import com.google.android.gms.wearable.CapabilityClient
import com.google.android.gms.wearable.DataMapItem
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
 * DataClient. Todo el transporte lo hace Google Play Services por BLE.
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
                    "telemetry" -> telemetry(result)
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
                    .addOnCompleteListener { capability ->
                        val wearIds = capability.result?.nodes?.map { it.id }?.toSet() ?: emptySet()

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

        Wearable.getNodeClient(this).connectedNodes
            .addOnSuccessListener { nodes ->
                val node = nodes.firstOrNull()
                if (node == null) {
                    result.success(mapOf("ok" to false, "error" to "NO HAY RELOJ CONECTADO"))
                    return@addOnSuccessListener
                }

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
            .addOnFailureListener { e ->
                result.success(mapOf("ok" to false, "error" to e.message))
            }
    }

    /** Manda un evento de prueba: el reloj debe mostrar una notificación. */
    private fun test(result: MethodChannel.Result) {
        Wearable.getNodeClient(this).connectedNodes
            .addOnSuccessListener { nodes ->
                val node = nodes.firstOrNull()
                if (node == null) {
                    result.success(mapOf("ok" to false, "error" to "NO HAY RELOJ CONECTADO"))
                    return@addOnSuccessListener
                }

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
        private const val PATH_TELEMETRY = "/rooms4ums/telemetry"

        private const val KEY_MAGNITUDE = "mag"
        private const val KEY_BATTERY = "bat"
        private const val KEY_ROTATED = "rot"
        private const val KEY_TIMESTAMP = "ts"
    }
}
