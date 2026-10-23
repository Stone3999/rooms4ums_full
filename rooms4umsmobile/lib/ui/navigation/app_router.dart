import 'package:flutter/material.dart';

import 'package:rooms4ums_mobile/core/services/api_service.dart';
import 'package:rooms4ums_mobile/core/services/deep_link_service.dart';
import 'package:rooms4ums_mobile/ui/screens/image_viewer_screen.dart';
import 'package:rooms4ums_mobile/ui/screens/popular_screen.dart';
import 'package:rooms4ums_mobile/ui/screens/post_detail_screen.dart';
import 'package:rooms4ums_mobile/ui/screens/room_screen.dart';

/// PRÁCTICA 3 - Enrutador de URLs preasignadas.
///
/// Concentra en un solo lugar el significado de cada URL, para que el deep
/// link que llega desde la notificación (celular o reloj) y el que genera la
/// propia app se comporten exactamente igual.
class AppRouter {
  const AppRouter._();

  static const String postPath = 'post';
  static const String roomPath = 'room';
  static const String imagePath = 'image';

  /// Navega según la intención derivada de la URL.
  static void route(NavigatorState navigator, DeepLink link, {bool replace = false}) {
    final route = _routeFor(link);
    if (route == null) return;

    if (replace) {
      navigator.pushReplacement(route);
    } else {
      navigator.push(route);
    }
  }

  static Route<void>? _routeFor(DeepLink link) {
    return switch (link) {
      DeepLinkHome() => MaterialPageRoute(builder: (_) => const _HomePlaceholder()),

      DeepLinkPopular() => MaterialPageRoute(builder: (_) => const PopularScreen()),

      // El slug es la clave primaria de las salas en el backend, así que la
      // URL preasignada de una puerta es literalmente su slug.
      DeepLinkRoom(:final slug, :final roomName) => MaterialPageRoute(
        builder: (_) => RoomScreen(roomId: slug, roomName: roomName ?? slug.toUpperCase()),
      ),

      // Cuando el post viene sin sala (por ejemplo desde una notificación
      // antigua), se abre igual el detalle: el endpoint trae el contenido.
      DeepLinkPost(:final id, :final roomSlug) => MaterialPageRoute(
        builder: (_) => roomSlug == null
            ? _PostWithoutPreview(postId: id)
            : PostDetailScreen(postId: id, preview: const {}),
      ),

      // PRÁCTICA 3: la URL de un adjunto abre el visor directamente.
      DeepLinkImage(:final postId, :final index) => MaterialPageRoute(
        builder: (_) => ImageViewerScreen(postId: postId, index: index),
      ),
    };
  }
}

/// Destino simple para `rooms4ums://home`.
class _HomePlaceholder extends StatelessWidget {
  const _HomePlaceholder();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('ROOMS4UMS')),
      body: const Center(
        child: Text(
          'Usa el botón atrás para volver a las salas.',
          style: TextStyle(color: Colors.grey),
        ),
      ),
    );
  }
}

/// Resuelve el post antes de mostrar el detalle cuando no hay preview.
class _PostWithoutPreview extends StatelessWidget {
  final String postId;

  const _PostWithoutPreview({required this.postId});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('POST')),
      body: FutureBuilder<Map<String, dynamic>>(
        future: ApiService.getPost(postId),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError || !snapshot.hasData) {
            return const Center(
              child: Text(
                'NO SE PUDO CARGAR LA PUBLICACIÓN',
                style: TextStyle(color: Colors.white70, fontSize: 12),
              ),
            );
          }

          final post = snapshot.data!;
          final roomSlug = post['roomId']?.toString();

          // Reemplaza este widget por el detalle real ya con los datos.
          return PostDetailScreen(postId: postId, preview: post, roomSlug: roomSlug);
        },
      ),
    );
  }
}