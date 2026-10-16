import 'dart:async';
import 'dart:collection';

import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:http/http.dart' as http;

/// Caché de imágenes para las notificaciones con vista previa.
///
/// Cuando llega un post nuevo con foto, la notificación necesita el archivo.
/// Descargarlo en cada push desperdica datos y retrasa el aviso, así que se
/// guarda aquí en un LRU acotado.
///
/// Se cachean BYTES, no bitmaps decodificados: la librería de notificaciones
/// acepta `ByteArrayAndroidBitmap` directamente, y así no hay que gestionar el
/// ciclo de vida de objetos nativos de imagen.
///
/// Solo vive en memoria a propósito: al reiniciar el proceso es correcto
/// descartarla, porque la notificación que la generó ya se entregó.
class ImageCacheService {
  ImageCacheService._();

  static final ImageCacheService instance = ImageCacheService._();

  /// Cuántas imágenes mantener a la vez.
  static const int maxEntries = 12;

  /// Tope de tamaño para no cargar adjuntos gigantic en un móvil.
  static const int maxBytes = 5 * 1024 * 1024;

  static const Duration _timeout = Duration(seconds: 12);

  final LinkedHashMap<String, Uint8List> _cache = LinkedHashMap();
  final Map<String, Future<Uint8List?>> _inFlight = {};

  /// Devuelve los bytes de la imagen, o `null` si no se pudo obtener.
  /// Nunca lanza: una notificación sin foto es mejor que una fallida.
  Future<Uint8List?> load(String url) {
    final cached = _cache.remove(url);
    if (cached != null) {
      // Reinsertar para marcarlo como usado recientemente.
      _cache[url] = cached;
      return Future.value(cached);
    }

    // Si ya hay una descarga en curso, se reutiliza la misma promesa.
    return _inFlight.putIfAbsent(url, () async {
      final bytes = await _download(url);
      if (bytes != null) _put(url, bytes);
      _inFlight.remove(url);
      return bytes;
    });
  }

  Future<Uint8List?> _download(String url) async {
    try {
      final response = await http.get(Uri.parse(url)).timeout(_timeout);
      if (response.statusCode != 200) return null;
      if (response.bodyBytes.isEmpty) return null;

      if (response.bodyBytes.length > maxBytes) {
        debugPrint('[ImageCache] Imagen descartada por tamaño ($url)');
        return null;
      }

      return response.bodyBytes;
    } catch (e) {
      debugPrint('[ImageCache] No se pudo descargar $url: $e');
      return null;
    }
  }

  void _put(String url, Uint8List bytes) {
    _cache[url] = bytes;
    while (_cache.length > maxEntries) {
      _cache.remove(_cache.keys.first);
    }
  }

  /// Expuesto para diagnóstico: cuántas imágenes están en caché ahora mismo.
  int get length => _cache.length;

  void clear() => _cache.clear();
}

/// Extrae la primera imagen de un post, si el adjunto es una imagen.
///
/// El backend guarda los adjuntos como `[{ url, type, name }]`.
String? firstImageUrl(Map<String, dynamic> post) {
  final attachments = post['attachments'];
  if (attachments is! List) return null;

  for (final attachment in attachments) {
    if (attachment is! Map) continue;
    final url = attachment['url']?.toString();
    if (url == null || url.isEmpty) continue;

    final type = attachment['type']?.toString().toLowerCase() ?? '';
    // Si el backend no manda el tipo, asumimos imagen: en la práctica los
    // adjuntos del foro lo son.
    final looksLikeImage = type.startsWith('image/') ||
        type.isEmpty ||
        const ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp']
            .any((ext) => url.toLowerCase().endsWith('.$ext'));

    if (looksLikeImage) return url;
  }
  return null;
}

/// Nombre de la sala que se muestra en la notificación.
String resolveRoomName(Map<String, dynamic> post) {
  final slug = post['roomId']?.toString() ?? '';
  if (slug.isEmpty) return 'FORO';
  return slug.toUpperCase();
}

/// Envuelve los bytes en el tipo que espera la librería de notificaciones.
AndroidBitmap? toNotificationBitmap(Uint8List? bytes) {
  if (bytes == null || bytes.isEmpty) return null;
  return ByteArrayAndroidBitmap(bytes);
}