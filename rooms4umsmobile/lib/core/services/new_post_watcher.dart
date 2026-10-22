import 'dart:async';

import 'package:flutter/foundation.dart';

import 'package:rooms4ums_mobile/core/services/api_service.dart';
import 'package:rooms4ums_mobile/core/services/notification_service.dart';
import 'package:rooms4ums_mobile/data/local/image_cache.dart';
import 'package:rooms4ums_mobile/data/local/local_database.dart';

/// Detecta posts nuevos y dispara el push.
///
/// IMPORTANTE - Por qué polling y no Socket.IO:
/// El gateway del backend (`voice.gateway.ts`) solo emite eventos de canales
/// de voz: no emite nada cuando se crea un post. Para tener tiempo real
/// harían falta dos cambios: emitir `new-post` desde `ForumController` y
/// suscribirse desde aquí. Como el alcance acordado es no modificar el
/// backend, usamos polling contra `/api/forum/recent`.
///
/// Si más adelante se autoriza tocar el backend, sustituir `_poll()` por una
/// suscripción a `socket.on('new-post', ...)` es un cambio local de esta clase.
class NewPostWatcher {
  NewPostWatcher._();

  static final NewPostWatcher instance = NewPostWatcher._();

  /// cada cuántos segundos se consulta el backend.
  static const Duration interval = Duration(seconds: 45);

  Timer? _timer;
  bool _running = false;
  final Set<String> _seen = <String>{};
  bool _primeraCarga = true;

  /// Arranca el monitoreo. No hace nada si ya está corriendo.
  void start() {
    if (_running) return;
    _running = true;
    _timer = Timer.periodic(interval, (_) => _poll());
    // Primera consulta casi inmediata para no esperar un ciclo completo.
    unawaited(_poll());
  }

  void stop() {
    _timer?.cancel();
    _timer = null;
    _running = false;
  }

  /// Permite que las pantallas avisen qué posts ya vieron, para no notificar
  /// algo que el usuario está viendo en ese momento.
  void markAsSeen(Iterable<String> postIds) => _seen.addAll(postIds);

  Future<void> _poll() async {
    if (!_running) return;

    final token = await ApiService.getToken();
    if (token == null) return; // Sin sesión no hay a quién avisarle.

    try {
      final recent = await ApiService.getRecentPosts(limit: 15);
      if (recent.isEmpty) return;

      final nuevos = <String, Map<String, dynamic>>{};

      for (final post in recent) {
        final id = (post['_id'] ?? post['id'] ?? '').toString();
        if (id.isEmpty || _seen.contains(id)) continue;
        nuevos[id] = post;
      }

      // La primera pasada solo siembra la lista de vistos: si no, el usuario
      // recibiría un_notification_ por cada post histórico al abrir la app.
      if (_primeraCarga) {
        _primeraCarga = false;
        _seen.addAll(recent.map((p) => (p['_id'] ?? p['id'] ?? '').toString()).where((e) => e.isNotEmpty));
        await LocalDatabase.instance.cachePosts(recent);
        return;
      }

      if (nuevos.isEmpty) return;

      // Notificar de lo más antiguo a lo más reciente para leer en orden.
      final ordered = nuevos.values.toList()
        ..sort((a, b) => (a['createdAt']?.toString() ?? '')
            .compareTo(b['createdAt']?.toString() ?? ''));

      for (final post in ordered) {
        final id = (post['_id'] ?? post['id'] ?? '').toString();
        _seen.add(id);

        await NotificationService.instance.notifyNewPost(
          postId: id,
          roomSlug: (post['roomId'] ?? '').toString(),
          roomName: resolveRoomName(post),
          authorName: (post['authorName'] ?? 'ALGUIEN').toString(),
          title: (post['title'] ?? '').toString(),
          // Si el post trae foto, la notificación la muestra como vista previa
          // y el Wear OS emparejado la replica en el reloj.
          imageUrl: firstImageUrl(post),
        );
      }

      await LocalDatabase.instance.cachePosts(ordered);
      debugPrint('[Watcher] ${ordered.length} post(s) nuevo(s) notificado(s)');
    } catch (e) {
      // Silencioso a propósito: un fallo de red no debe romper la app.
      debugPrint('[Watcher] Error consultando posts recientes: $e');
    }
  }
}