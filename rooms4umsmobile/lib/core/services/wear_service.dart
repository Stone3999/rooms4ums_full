import 'package:flutter/services.dart';

/// PRÁCTICA 2 - Puente con el reloj (Data Layer API).
///
/// Todo el trabajo real lo hace `MainActivity.kt` con Google Play Services:
/// descubrir nodos, mandar la sesión y leer la telemetría. Aquí solo se
/// tipa el resultado para que la UI de Flutter no maneje mapas sueltos.
class WearNode {
  final String id;
  final String name;
  final bool nearby;
  final bool wearApp;

  const WearNode({
    required this.id,
    required this.name,
    required this.nearby,
    required this.wearApp,
  });

  factory WearNode.fromMap(Map raw) {
    return WearNode(
      id: (raw['id'] ?? '').toString(),
      name: (raw['name'] ?? 'Wear OS').toString(),
      nearby: raw['nearby'] == true,
      wearApp: raw['wearApp'] == true,
    );
  }
}

class WearStatus {
  final bool supported;
  final bool connected;
  final List<WearNode> nodes;
  final String? error;

  const WearStatus({
    required this.supported,
    required this.connected,
    required this.nodes,
    this.error,
  });

  factory WearStatus.unsupported() => const WearStatus(
        supported: false,
        connected: false,
        nodes: <WearNode>[],
        error: 'ESTA VERSION SOLO CORRE EN ANDROID',
      );

  factory WearStatus.fromMap(Map raw) {
    final rawNodes = raw['nodes'];
    final nodes = rawNodes is List
        ? rawNodes.whereType<Map>().map(WearNode.fromMap).toList()
        : <WearNode>[];

    return WearStatus(
      supported: true,
      connected: raw['connected'] == true,
      nodes: nodes,
      error: raw['error']?.toString(),
    );
  }
}

class WearTelemetry {
  final double magnitude;
  final int battery;
  final bool rotated;
  final int timestamp;

  const WearTelemetry({
    required this.magnitude,
    required this.battery,
    required this.rotated,
    required this.timestamp,
  });

  factory WearTelemetry.fromMap(Map raw) {
    return WearTelemetry(
      magnitude: (raw['magnitude'] as num?)?.toDouble() ?? 0,
      battery: (raw['battery'] as num?)?.toInt() ?? -1,
      rotated: raw['rotated'] == true,
      timestamp: (raw['ts'] as num?)?.toInt() ?? 0,
    );
  }
}

class WearResult {
  final bool ok;
  final String message;

  const WearResult(this.ok, this.message);
}

class WearService {
  static const MethodChannel _channel = MethodChannel('rooms4ums/wear');

  static Future<WearStatus> status() async {
    try {
      final raw = await _channel.invokeMethod<dynamic>('status');
      if (raw is Map) return WearStatus.fromMap(raw);
      return WearStatus.unsupported();
    } on MissingPluginException {
      return WearStatus.unsupported();
    } on PlatformException catch (e) {
      return WearStatus(
        supported: true,
        connected: false,
        nodes: const <WearNode>[],
        error: e.message ?? 'ERROR DEL PUENTE ANDROID',
      );
    }
  }

  static Future<WearResult> link({
    required String jwt,
    required String username,
  }) async {
    try {
      final raw = await _channel.invokeMethod<dynamic>('link', {
        'jwt': jwt,
        'username': username,
      });
      final map = raw is Map ? raw : const <String, dynamic>{};
      final ok = map['ok'] == true;
      final message = ok
          ? 'RELOJ VINCULADO: ${map['node'] ?? 'WEAR OS'}'
          : (map['error'] ?? 'NO SE PUDO VINCULAR').toString();
      return WearResult(ok, message);
    } on MissingPluginException {
      return const WearResult(false, 'PUENTE ANDROID NO DISPONIBLE');
    } on PlatformException catch (e) {
      return WearResult(false, e.message ?? 'ERROR AL VINCULAR');
    }
  }

  static Future<WearResult> testNotification() async {
    try {
      final raw = await _channel.invokeMethod<dynamic>('test');
      final map = raw is Map ? raw : const <String, dynamic>{};
      final ok = map['ok'] == true;
      return WearResult(
        ok,
        ok ? 'EVENTO ENVIADO AL RELOJ' : (map['error'] ?? 'NO SE PUDO ENVIAR').toString(),
      );
    } on MissingPluginException {
      return const WearResult(false, 'PUENTE ANDROID NO DISPONIBLE');
    } on PlatformException catch (e) {
      return WearResult(false, e.message ?? 'ERROR AL ENVIAR');
    }
  }

  static Future<WearTelemetry?> telemetry() async {
    try {
      final raw = await _channel.invokeMethod<dynamic>('telemetry');
      if (raw is Map) return WearTelemetry.fromMap(raw);
      return null;
    } catch (_) {
      return null;
    }
  }
}
