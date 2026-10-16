import 'package:flutter/material.dart';

import 'package:rooms4ums_mobile/core/services/api_service.dart';
import 'package:rooms4ums_mobile/core/services/deep_link_service.dart';
import 'package:rooms4ums_mobile/core/services/new_post_watcher.dart';
import 'package:rooms4ums_mobile/core/services/notification_service.dart';
import 'package:rooms4ums_mobile/core/services/push_service.dart';
import 'package:rooms4ums_mobile/core/theme/app_theme.dart';
import 'package:rooms4ums_mobile/data/local/local_database.dart';
import 'package:rooms4ums_mobile/ui/navigation/app_router.dart';
import 'package:rooms4ums_mobile/ui/screens/landing_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // --- PUSH: se registra el plugin y se crean los canales ------------------
  // El permiso en Android 13+ se pide después, cuando el usuario entra.
  await NotificationService.instance.initialize();

  // --- PUSH REMOTO: Firebase Cloud Messaging -------------------------------
  // Complementa al local. Si Firebase no está disponible, la app sigue
  // funcionando con el push local por sondeo.
  final remotePushAvailable = await PushService.instance.initialize();
  debugPrint('[App] Push remoto disponible: $remotePushAvailable');

  // --- PRÁCTICA 4: limpieza de registros vencidos al arrancar ---------------
  try {
    final purged = await LocalDatabase.instance.purgeExpired();
    debugPrint('[BD] Registros vencidos eliminados: $purged');
  } catch (e) {
    debugPrint('[BD] No se pudo limpiar la caché: $e');
  }

  // --- PRÁCTICA 3: deep links ----------------------------------------------
  // Si la app se abrió desde una URL, se guarda para navegar al llegar.
  final initialLink = await DeepLinkService.instance.initialize();

  runApp(Rooms4umsApp(initialLink: initialLink));
}

class Rooms4umsApp extends StatefulWidget {
  final DeepLink? initialLink;

  const Rooms4umsApp({super.key, this.initialLink});

  @override
  State<Rooms4umsApp> createState() => _Rooms4umsAppState();
}

class _Rooms4umsAppState extends State<Rooms4umsApp> {
  final GlobalKey<NavigatorState> _navigatorKey = GlobalKey<NavigatorState>();

  @override
  void initState() {
    super.initState();

    // Cada deep link entrante (incluido el que abre la notificación desde
    // el reloj) se enruta a la pantalla correspondiente.
    DeepLinkService.instance.links.listen(_handleLink);

    // Los deep links que llegan por un push remoto de Firebase pasan por el
    // mismo enrutador: app_links y FCM convergen aquí.
    NotificationService.instance.deepLinkRequests.listen((url) {
      final link = DeepLink.tryParse(url);
      if (link != null) _handleLink(link);
    });

    // El monitoreo de posts nuevos arranca cuando ya hay sesión activa.
    ApiService.getToken().then((token) {
      if (token != null) NewPostWatcher.instance.start();
    });
  }

  void _handleLink(DeepLink link) {
    final navigator = _navigatorKey.currentState;
    if (navigator == null) return;
    AppRouter.route(navigator, link, replace: true);
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Rooms4ums',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.darkRetroTheme,
      navigatorKey: _navigatorKey,
      home: LandingScreen(initialLink: widget.initialLink),
    );
  }
}