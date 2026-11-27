import 'package:flutter/services.dart';

class WearResult {
  final bool ok;
  final String message;

  const WearResult(this.ok, this.message);
}

class WearService {
  static const MethodChannel _channel = MethodChannel('rooms4ums/wear');

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
      return WearResult(
        ok,
        ok
            ? 'AVISOS ACTIVADOS EN EL RELOJ'
            : (map['error'] ?? 'NO SE PUDIERON ACTIVAR LOS AVISOS').toString(),
      );
    } on MissingPluginException {
      return const WearResult(false, 'FUNCION DISPONIBLE SOLO EN ANDROID');
    } on PlatformException catch (error) {
      return WearResult(
        false,
        error.message ?? 'NO SE PUDIERON ACTIVAR LOS AVISOS',
      );
    }
  }
}
