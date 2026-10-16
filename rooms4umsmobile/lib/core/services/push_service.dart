import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import 'package:rooms4ums_mobile/core/services/api_service.dart';
import 'package:rooms4ums_mobile/core/services/notification_service.dart';
import 'package:rooms4ums_mobile/data/local/image_cache.dart';

/// Extrae una URL de imagen del mapa `data` de un push remoto.
///
/// Firebase no descarga imágenes automáticamente: si el adjunto viene como
/// `data['image']`, hay que bajarla a mano para poder ponerla de vista previa.
String? firstImageUrl(Map<String, dynamic> data) {
  final url = data['image']?.toString();
  if (url == null || url.isEmpty) return null;
  if (!url.startsWith('http')) return null;
  return url;
}

/// PUSH REMOTO mediante Firebase Cloud Messaging.
///
/// Complementa al push local: las notificaciones locales dependen de que la app
/// esté viva sondeando el backend; el push remoto llega aunque la aplicación
/// esté cerrada o el proceso haya sido eliminado por el sistema.
///
/// En Wear OS el comportamiento es idéntico: Android replica la notificación
/// en el reloj, incluida la imagen de vista previa.
///
/// LÓGICA DE RESBALDO: si Firebase no está disponible (por ejemplo en una
/// compilación sin google-services.json), esta clase degrada a no-op y la app
/// sigue funcionando con el push local. Nunca lanza durante el arranque.
class PushService {
  PushService._();

  static final PushService instance = PushService._();

  bool _initialized = false;
  String? _token;

  StreamSubscription<RemoteMessage>? _onMessage;
  StreamSubscription<RemoteMessage>? _onOpened;

  /// Token del dispositivo, útil para enviarlo al backend o para hacer pruebas
  /// manuales desde la consola de Firebase.
  String? get token => _token;

  bool get isAvailable => _initialized;

  /// Arranca Firebase y sus manejadores. Devuelve `false` si no está disponible.
  Future<bool> initialize() async {
    if (_initialized) return true;

    try {
      await Firebase.initializeApp();

      // Pedir permisos. En Android 13+ esto dispara el diálogo del sistema.
      final settings = await FirebaseMessaging.instance.requestPermission(
        alert: true,
        badge: true,
        sound: true,
        provisional: false,
      );
      debugPrint('[FCM] Permiso de notificaciones: ${settings.authorizationStatus}');

      _token = await FirebaseMessaging.instance.getToken();
      debugPrint('[FCM] Token del dispositivo: ${_token ?? "NO OBTENIDO"}');

      // Registra el token contra el backend para recibir push aunque la app
      // este cerrada. Si todavia no hay sesion, se reintentara al iniciar sesion.
      await _registerTokenIfLoggedIn();

      // Escucha cambios de token: si el usuario reinstala la app o Google lo
      // rota, hay que volver a registrarlo.
      FirebaseMessaging.instance.onTokenRefresh.listen((newToken) {
        _token = newToken;
        debugPrint('[FCM] Token renovado: $newToken');
        ApiService.registerPushToken(newToken, platform: 'android').then((_) {
          debugPrint('[FCM] Token renovado registrado en el backend');
        }).catchError((Object e) {
          debugPrint('[FCM] No se pudo registrar el token renovado: $e');
        });
      });

      // Mensaje recibido con la app EN PRIMER PLANO.
      // FCM no muestra notificación automática en ese caso: hay que hacerlo.
      _onMessage = FirebaseMessaging.onMessage.listen(_handleForegroundMessage);

      // Usuario tocó la notificación: payload puede traer el deep link.
      _onOpened = FirebaseMessaging.onMessageOpenedApp.listen(_handleOpenedMessage);

      // Si la app se cerró y el usuario tocó el aviso, se recupera el estado
      // inicial de Firebase (getInitialMessage) desde el punto de entrada.
      final initial = await FirebaseMessaging.instance.getInitialMessage();
      if (initial != null) _handleOpenedMessage(initial);

      _initialized = true;
      return true;
    } catch (e) {
      debugPrint('[FCM] No disponible, se continúa con push local: $e');
      return false;
    }
  }

  /// Publica una notificación local replicando el contenido del push remoto.
  /// Necesario porque, con la app visible, Android no dibuja la notificación.
  Future<void> _handleForegroundMessage(RemoteMessage message) async {
    final data = message.data;
    final title = message.notification?.title ??
        (data['title'] as String? ?? 'Nuevo en Rooms4ums');
    final body = message.notification?.body ??
        (data['body'] as String? ?? 'Hay actividad nueva en el foro.');

    final postId = data['postId']?.toString();
    final roomSlug = data['room']?.toString();

    Uint8List? preview;
    final imageUrl = firstImageUrl(data);
    if (imageUrl != null) {
      preview = await ImageCacheService.instance.load(imageUrl);
    }

    await NotificationService.instance.showRemote(
      id: (postId ?? title).hashCode & 0x7fffffff,
      title: title,
      body: body,
      deepLink: postId != null
          ? 'rooms4ums://post/$postId${roomSlug != null ? '?room=$roomSlug' : ''}'
          : null,
      imageBytes: preview,
    );
  }

  /// El usuario tocó el aviso. Se delega el deep link al servicio central.
  void _handleOpenedMessage(RemoteMessage message) {
    final postId = message.data['postId']?.toString();
    final roomSlug = message.data['room']?.toString();
    if (postId == null) return;

    // Se reemite por el mismo canal que usa app_links, de modo que el
    // deep link se resuelve igual venga de donde venga.
    NotificationService.instance.onDeepLinkRequested(
      'rooms4ums://post/$postId${roomSlug != null ? '?room=$roomSlug' : ''}',
    );
  }

  void dispose() {
    _onMessage?.cancel();
    _onOpened?.cancel();
  }

  /// Intenta asociar el token FCM al usuario autenticado.
  /// Silencioso si no hay sesión: se reintentará más tarde.
  Future<void> _registerTokenIfLoggedIn() async {
    final token = _token;
    if (token == null || token.isEmpty) return;

    try {
      await ApiService.registerPushToken(token, platform: 'android');
      debugPrint('[FCM] Token registrado en el backend');
    } catch (e) {
      debugPrint('[FCM] Todavia no se pudo registrar el token: $e');
    }
  }

  /// Se invoca justo despues de iniciar sesion, cuando ya hay JWT.
  Future<void> registerAfterLogin() => _registerTokenIfLoggedIn();
}