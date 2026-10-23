import 'package:flutter/material.dart';

import 'package:rooms4ums_mobile/core/services/api_service.dart';
import 'package:rooms4ums_mobile/core/services/new_post_watcher.dart';
import 'package:rooms4ums_mobile/core/theme/app_colors.dart';
import 'package:rooms4ums_mobile/data/local/local_database.dart';
import 'package:rooms4ums_mobile/ui/screens/landing_screen.dart';
import 'package:rooms4ums_mobile/ui/screens/room_screen.dart';
import 'package:rooms4ums_mobile/ui/widgets/door_card.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  /// Falso mientras la base local aún no pudo leerse (p. ej. sin permisos).
  bool _cacheAvailable = true;

  @override
  void initState() {
    super.initState();
    _loadRooms();
  }

  /// PRÁCTICA 4: primero red, y si falla se sirve la caché local.
  Future<void> _loadRooms() async {
    try {
      final rooms = await ApiService.getRooms();
      await LocalDatabase.instance.cacheRooms(rooms);
      if (mounted) setState(() => _roomsFuture = Future.value(rooms));
    } catch (_) {
      final cached = await LocalDatabase.instance.cachedRooms();
      if (cached.isEmpty) {
        if (mounted) {
          setState(() => _roomsFuture = Future.error('No se pudieron cargar las salas.'));
        }
        return;
      }
      if (!mounted) return;
      setState(() {
        _cacheAvailable = true;
        _roomsFuture = Future.value(cached.map(LocalDatabase.roomFromRow).toList());
      });
    }
  }

  late Future<List<Map<String, dynamic>>> _roomsFuture;

  void _reload() {
    _loadRooms();
  }

  Future<void> _refresh() async {
    _loadRooms();
    try {
      await _roomsFuture;
    } catch (_) {
      // La caché ya se cargó en _loadRooms.
    }
  }

  Future<void> _logout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('CERRAR SESIÓN'),
        content: const Text('¿Seguro que quieres salir de tu sesión actual?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('CANCELAR', style: TextStyle(color: AppColors.textSecondary)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.accent,
              foregroundColor: Colors.black,
            ),
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('SALIR'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    await ApiService.logout();
    NewPostWatcher.instance.stop();
    if (!mounted) return;
    Navigator.pushAndRemoveUntil(
      context,
      MaterialPageRoute(builder: (_) => const LandingScreen()),
      (route) => false,
    );
  }

  void _openRoom(Map<String, dynamic> room) {
    // Tomamos tanto el slug como el ID de la sala para máxima resiliencia
    final slug = (room['slug'] ?? '').toString();
    final rawId = (room['id'] ?? room['_id'] ?? '').toString();
    final targetId = slug.isNotEmpty ? slug : rawId;
    if (targetId.isEmpty) return;

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => RoomScreen(
          roomId: targetId,
          roomSlug: slug.isNotEmpty ? slug : null,
          roomName: (room['name'] ?? 'SALA').toString(),
          isInteractive: room['is_interactive'] == true,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('ROOMS4UMS'),
        actions: [
          IconButton(
            tooltip: 'Actualizar salas',
            icon: const Icon(Icons.refresh),
            onPressed: _reload,
          ),
          IconButton(
            tooltip: 'Cerrar sesión',
            icon: const Icon(Icons.logout),
            onPressed: _logout,
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 18, 16, 4),
              child: Row(
                children: [
                  const Icon(Icons.door_front_door, size: 18),
                  const SizedBox(width: 10),
                  Text('SELECCIONA UNA SALA', style: kTitleStyle.copyWith(fontSize: 15)),
                ],
              ),
            ),
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16),
              child: Text(
                'Cada puerta abre un foro. Entra para leer y publicar.',
                style: TextStyle(color: AppColors.textSecondary, fontSize: 11),
              ),
            ),
            if (!_cacheAvailable)
              const Padding(
                padding: EdgeInsets.fromLTRB(16, 8, 16, 0),
                child: Row(
                  children: [
                    Icon(Icons.cloud_off, size: 12, color: AppColors.accent),
                    SizedBox(width: 8),
                    Text(
                      'SIN CONEXIÓN · MOSTRANDO CACHÉ LOCAL',
                      style: TextStyle(color: AppColors.accent, fontSize: 9, letterSpacing: 1),
                    ),
                  ],
                ),
              ),
            const SizedBox(height: 12),
            Expanded(
              child: RefreshIndicator(
                color: AppColors.accent,
                backgroundColor: AppColors.bgSecondary,
                onRefresh: _refresh,
                child: FutureBuilder<List<Map<String, dynamic>>>(
                  future: _roomsFuture,
                  builder: (context, snapshot) {
                    if (snapshot.connectionState == ConnectionState.waiting) {
                      return const Center(
                        child: CircularProgressIndicator(color: AppColors.accent),
                      );
                    }

                    if (snapshot.hasError) {
                      return _ErrorState(
                        message: snapshot.error.toString().replaceFirst('Exception: ', ''),
                        onRetry: _refresh,
                      );
                    }

                    final rooms = snapshot.data ?? const <Map<String, dynamic>>[];
                    if (rooms.isEmpty) {
                      return const _ErrorState(
                        message: 'NO HAY SALAS DISPONIBLES EN ESTE MOMENTO.',
                      );
                    }

                    return GridView.builder(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                      physics: const AlwaysScrollableScrollPhysics(),
                      gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                        maxCrossAxisExtent: 220,
                        mainAxisSpacing: 14,
                        crossAxisSpacing: 14,
                        childAspectRatio: 0.78,
                      ),
                      itemCount: rooms.length,
                      itemBuilder: (context, index) {
                        final room = rooms[index];
                        return DoorCard(
                          title: (room['name'] ?? 'SALA').toString(),
                          subtitle: (room['description'] ?? '').toString(),
                          isInteractive: room['is_interactive'] == true,
                          onTap: () => _openRoom(room),
                        );
                      },
                    );
                  },
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback? onRetry;

  const _ErrorState({required this.message, this.onRetry});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) => SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: constraints.maxHeight),
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.warning_amber, color: AppColors.accent, size: 40),
                  const SizedBox(height: 16),
                  Text(
                    message,
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: AppColors.textSecondary, fontSize: 12, height: 1.5),
                  ),
                  if (onRetry != null) ...[
                    const SizedBox(height: 20),
                    OutlinedButton.icon(
                      onPressed: onRetry,
                      icon: const Icon(Icons.refresh, size: 16),
                      label: const Text('REINTENTAR'),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}