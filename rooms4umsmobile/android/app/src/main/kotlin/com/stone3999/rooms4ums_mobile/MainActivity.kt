package com.stone3999.rooms4ums_mobile

import com.google.android.gms.wearable.CapabilityClient
import com.google.android.gms.wearable.Node
import com.google.android.gms.wearable.Wearable
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import org.json.JSONObject

class MainActivity : FlutterActivity() {
    private val channelName = "rooms4ums/wear"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, channelName)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "link" -> link(
                        call.argument<String>("jwt"),
                        call.argument<String>("username"),
                        result,
                    )
                    else -> result.notImplemented()
                }
            }
    }

    private fun link(jwt: String?, username: String?, result: MethodChannel.Result) {
        if (jwt.isNullOrBlank()) {
            result.success(mapOf("ok" to false, "error" to "INICIA SESION EN EL CELULAR"))
            return
        }

        withWearAppNode(result) { node ->
            val payload = JSONObject()
                .put("jwt", jwt)
                .put("username", username.orEmpty())
                .toString()
                .toByteArray(Charsets.UTF_8)

            Wearable.getMessageClient(this)
                .sendMessage(node.id, PATH_LINK, payload)
                .addOnSuccessListener {
                    result.success(mapOf("ok" to true))
                }
                .addOnFailureListener { error ->
                    result.success(
                        mapOf("ok" to false, "error" to (error.message ?: "NO SE PUDO ACTIVAR")),
                    )
                }
        }
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
                                mapOf(
                                    "ok" to false,
                                    "error" to "ABRE ROOMS4UMS EN EL RELOJ E INTENTA DE NUEVO",
                                ),
                            )
                        } else {
                            action(node)
                        }
                    }
                    .addOnFailureListener { error ->
                        result.success(
                            mapOf("ok" to false, "error" to (error.message ?: "RELOJ NO DISPONIBLE")),
                        )
                    }
            }
            .addOnFailureListener { error ->
                result.success(
                    mapOf("ok" to false, "error" to (error.message ?: "RELOJ NO DISPONIBLE")),
                )
            }
    }

    companion object {
        private const val WEAR_CAPABILITY = "rooms4ums_wear"
        private const val PATH_LINK = "/rooms4ums/link"
    }
}
