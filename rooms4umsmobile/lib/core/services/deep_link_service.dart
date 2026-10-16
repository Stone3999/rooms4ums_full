import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/foundation.dart';

/// PRÁCTICA 3 - URLs preasignadas.
///
/// A cada destino de la app se le asigna una URL estable y compartible:
///   `rooms4ums://room/<slug>`   ->  abre esa sala
///   `rooms4ums://post/<id>`     ->  abre ese post
///   `rooms4ums://popular`       ->  abre la sección de populares
///   `rooms4ums://home`          ->  vuelve al inicio
///
/// Estas URLs viajan como `payload` de las notificaciones, así que al tocar
/// el aviso en el Wear OS el sistema abre la app en la pantalla correcta.
class DeepLinkService {
  DeepLinkService._();

  static final DeepLinkService instance = DeepLinkService._();

  static const String scheme = 'rooms4ums';

  final AppLinks _appLinks = AppLinks();
  StreamSubscription<Uri>? _subscription;

  /// Emite cada deep link resuelto. La app se suscribe y navega.
  final StreamController<DeepLink> _controller = StreamController<DeepLink>.broadcast();

  Stream<DeepLink> get links => _controller.stream;

  /// Arranca a escuchar. Debe llamarse una vez desde `main()`.
  ///
  /// Devuelve el link con el que se abrió la app, si fue el caso.
  Future<DeepLink?> initialize() async {
    try {
      _subscription = _appLinks.uriLinkStream.listen(
        (uri) => _dispatch(uri),
        onError: (Object e) => debugPrint('[DeepLink] Error en el stream: $e'),
      );

      final initial = await _appLinks.getInitialLink();
      if (initial != null) return parse(initial);
    } catch (e) {
      debugPrint('[DeepLink] No se pudo inicializar: $e');
    }
    return null;
  }

  /// Permite que el usuario construya y comparta un enlace a un post.
  /// Es la operación inversa: de la app hacia el enlace compartible.
  static String shareLinkForPost(String postId, {String? roomSlug}) {
    final query = roomSlug == null ? '' : '?room=$roomSlug';
    return '$scheme://post/$postId$query';
  }

  static String shareLinkForRoom(String slug) => '$scheme://room/$slug';

  /// Convierte la URI cruda en una intención tipada de la app.
  static DeepLink? parse(Uri uri) {
    // OJO con esto: Dart parsea `rooms4ums://post/abc123` de forma distinta a
    // `https://rooms4ums.com/post/abc123`.
    //   - En el esquema propio, `post` queda en `host` y `abc123` en pathSegments.
    //   - En http(s), todo va en pathSegments y `host` es el dominio.
    final isWebScheme = uri.scheme == 'http' || uri.scheme == 'https';

    final segments = <String>[
      if (!isWebScheme && uri.host.isNotEmpty) uri.host,
      ...uri.pathSegments,
    ];

    if (segments.isEmpty) return null;

    switch (segments.first) {
      case 'room':
        if (segments.length < 2) return null;
        return DeepLinkRoom(slug: segments[1], roomName: uri.queryParameters['name']);

      case 'post':
        if (segments.length < 2) return null;
        return DeepLinkPost(id: segments[1], roomSlug: uri.queryParameters['room']);

      case 'popular':
        return const DeepLinkPopular();

      case 'home':
        return const DeepLinkHome();

      default:
        debugPrint('[DeepLink] Ruta desconocida: $uri');
        return null;
    }
  }

  void _dispatch(Uri uri) {
    final link = parse(uri);
    if (link != null) _controller.add(link);
  }

  void dispose() {
    _subscription?.cancel();
    _controller.close();
  }
}

/// Intención de navegación derivada de una URL preasignada.
sealed class DeepLink {
  const DeepLink();

  /// Parsea una URL cruda. Devuelve `null` si el formato no es reconocido.
  static DeepLink? tryParse(String raw) {
    final uri = Uri.tryParse(raw);
    if (uri == null) return null;
    return DeepLinkService.parse(uri);
  }
}

class DeepLinkHome extends DeepLink {
  const DeepLinkHome();
}

class DeepLinkPopular extends DeepLink {
  const DeepLinkPopular();
}

class DeepLinkRoom extends DeepLink {
  final String slug;
  final String? roomName;

  const DeepLinkRoom({required this.slug, this.roomName});

  @override
  String toString() => 'DeepLinkRoom($slug)';
}

class DeepLinkPost extends DeepLink {
  final String id;
  final String? roomSlug;

  const DeepLinkPost({required this.id, this.roomSlug});

  @override
  String toString() => 'DeepLinkPost($id)';
}