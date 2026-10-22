import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'package:rooms4ums_mobile/data/local/image_cache.dart';

/// PUSH + INTEGRACIÓN CON WEARABLE.
///
/// Android y Wear OS comparten el sistema de notificaciones: cuando esta app
/// publica una notificación en el teléfono, el sistema operativo la refleja
/// automáticamente en el reloj emparejado, con su propia vibración, sin que
/// exista ninguna app instalada en el wearable.
///
/// Esa es la razón por la que el push hacia el reloj no requiere una sola
/// línea de Kotlin: lo hace la plataforma.
class NotificationService {
  NotificationService._();

  static final NotificationService instance = NotificationService._();

  static const String _channelId = 'rooms4ums_forum';
  static const String _channelIdDirect = 'rooms4ums_direct';
  static const String _channelIdSocial = 'rooms4ums_social';
  static const String _channelIdRemote = 'rooms4ums_remoto';

  /// Permite que el push remoto redirija a una URL (deep link).
  /// Se usa cuando el usuario toca el aviso y llegó por Firebase en vez de
  /// por app_links, para que ambos caminos converjan en el mismo enrutador.
  final StreamController<String> _deepLinkRequests = StreamController<String>.broadcast();

  Stream<String> get deepLinkRequests => _deepLinkRequests.stream;

  void onDeepLinkRequested(String url) {
    if (url.isEmpty) return;
    _deepLinkRequests.add(url);
  }

  final FlutterLocalNotificationsPlugin _plugin = FlutterLocalNotificationsPlugin();

  bool _initialized = false;

  /// Se invoca una sola vez desde `main()`.
  Future<void> initialize() async {
    if (_initialized) return;

    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    await _plugin.initialize(const InitializationSettings(android: androidSettings));

    // Un canal por tipo, para que el usuario pueda silenciar lo que quiera
    // sin perder el push de lo importante.
    await _createChannel(
      _channelId,
      'Actividad en el foro',
      'Avisos cuando alguien publica o responde en tus salas.',
      importance: Importance.high,
    );
    await _createChannel(
      _channelIdDirect,
      'Mensajes directos',
      'Avisos de mensajes privados.',
      importance: Importance.high,
    );
    await _createChannel(
      _channelIdSocial,
      'Interacciones',
      'Respuestas y menciones a tus posts.',
      importance: Importance.defaultImportance,
    );
    await _createChannel(
      _channelIdRemote,
      'Push remoto',
      'Avisos enviados desde el servidor.',
      importance: Importance.high,
    );

    _initialized = true;
  }

  Future<void> _createChannel(
    String id,
    String name,
    String description, {
    required Importance importance,
  }) async {
    final android = _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
    if (android == null) return;

    await android.createNotificationChannel(
      AndroidNotificationChannel(
        id,
        name,
        description: description,
        importance: importance,
        // Patrón de vibración distintivo para que se reconozca en la muñeca.
        enableVibration: true,
        vibrationPattern: Int64List.fromList([0, 220, 120, 220]),
      ),
    );
  }

  /// Publica una notificación recibida por Firebase con la app en primer plano.
  ///
  /// Android no dibuja automáticamente la notificación cuando el proceso está
  /// vivo, así que se construye a mano replicando el contenido del push.
  Future<void> showRemote({
    required int id,
    required String title,
    required String body,
    String? deepLink,
    Uint8List? imageBytes,
  }) async {
    if (!_initialized) return;

    final details = NotificationDetails(
      android: AndroidNotificationDetails(
        _channelIdRemote,
        'Push remoto',
        importance: Importance.high,
        priority: Priority.high,
        styleInformation: imageBytes != null
            ? BigPictureStyleInformation(
                ByteArrayAndroidBitmap(imageBytes),
                largeIcon: ByteArrayAndroidBitmap(imageBytes),
                contentTitle: title,
                summaryText: body,
              )
            : BigTextStyleInformation(body, contentTitle: title),
      ),
    );

    try {
      await _plugin.show(id, title, body, details, payload: deepLink);
    } catch (e) {
      debugPrint('[Notificaciones] No se pudo publicar el push remoto: $e');
    }
  }

  /// Solicita el permiso de notificaciones (Android 13+ lo exige).
  /// Devuelve `true` si quedó concedido.
  Future<bool> requestPermission() async {
    if (!Platform.isAndroid) return false;

    final android = _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
    if (android == null) return false;

    return await android.requestNotificationsPermission() ?? false;
  }

  Future<bool> hasPermission() async {
    if (!Platform.isAndroid) return false;
    final android = _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
    return await android?.areNotificationsEnabled() ?? false;
  }

  /// Notifica un post nuevo en una sala.
  ///
  /// Si el post trae una imagen, se adjunta como vista previa. Android refleja
  /// la notificación en el Wear OS emparejado incluyendo esa imagen, así que el
  /// reloj muestra la foto del post nuevo sin necesidad de app de wearable.
  ///
  /// El deep link viaja en el payload, de modo que al tocar la notificación
  /// (en el celular O en el reloj) se abre directamente ese post.
  Future<void> notifyNewPost({
    required String postId,
    required String roomSlug,
    required String roomName,
    required String authorName,
    required String title,
    String? imageUrl,
  }) async {
    final Uint8List? preview = imageUrl == null
        ? null
        : await ImageCacheService.instance.load(imageUrl);

    await _show(
      id: postId.hashCode & 0x7fffffff,
      channelId: _channelId,
      title: 'Nuevo post en $roomName',
      body: '$authorName escribió: $title',
deepLink: 'rooms4ums://post/$postId?room=$roomSlug',
      priority: Priority.high,
      preview: preview,
    );
  }

  /// Notifica una respuesta a un post propio.
  Future<void> notifyComment({
    required String postId,
    required String roomSlug,
    required String roomName,
    required String authorName,
  }) async {
    await _show(
      id: (postId.hashCode ^ 0x5bf03635) & 0x7fffffff,
      channelId: _channelIdSocial,
      title: 'Respuesta en $roomName',
      body: '$authorName respondió en un post tuyo.',
      deepLink: 'rooms4ums://post/$postId?room=$roomSlug',
      priority: Priority.defaultPriority,
    );
  }

  Future<void> _show({
    required int id,
    required String channelId,
    required String title,
    required String body,
    String? deepLink,
    required Priority priority,
    Uint8List? preview,
  }) async {
    if (!_initialized) return;

    // Traza de la URL preasignada: deja visible en el logcat qué deep link
    // viaja en el aviso, para poder verificar la Práctica 3 en caliente.
    if (deepLink != null) {
      debugPrint('[PRACTICA 3] Notificacion -> deep link: $deepLink');
    }

    // Si hay imagen, usamos BigPictureStyle: Android la copia al reloj como
    // vista previa grande. Sin imagen, caemos a texto plano.
    final details = NotificationDetails(
      android: AndroidNotificationDetails(
        channelId,
        channelId == _channelId ? 'Actividad en el foro' : 'Interacciones',
        importance: priority == Priority.high ? Importance.high : Importance.defaultImportance,
        priority: priority,
        styleInformation: preview != null
            ? BigPictureStyleInformation(
                ByteArrayAndroidBitmap(preview),
                largeIcon: ByteArrayAndroidBitmap(preview),
                contentTitle: title,
                summaryText: body,
              )
            : BigTextStyleInformation(body, contentTitle: title),
        actions: const [
          AndroidNotificationAction(
            'open_room',
            'Ver en la sala',
            showsUserInterface: true,
            cancelNotification: true,
          ),
        ],
      ),
    );

    try {
      await _plugin.show(id, title, body, details, payload: deepLink);
    } catch (e) {
      debugPrint('[Notificaciones] No se pudo publicar: $e');
    }
  }

  Future<void> cancel(int id) => _plugin.cancel(id);

  Future<void> cancelAll() => _plugin.cancelAll();

  void dispose() {
    _deepLinkRequests.close();
  }
}