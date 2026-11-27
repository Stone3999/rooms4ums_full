import 'dart:convert';

import 'package:material_ui/material_ui.dart';

import 'package:rooms4ums_mobile/core/services/api_service.dart';
import 'package:rooms4ums_mobile/core/services/wear_service.dart';
import 'package:rooms4ums_mobile/core/theme/app_colors.dart';

class WearableScreen extends StatefulWidget {
  const WearableScreen({super.key});

  @override
  State<WearableScreen> createState() => _WearableScreenState();
}

class _WearableScreenState extends State<WearableScreen> {
  bool _busy = false;

  String _usernameFromJwt(String? token) {
    if (token == null || token.isEmpty) return 'tu cuenta';
    final parts = token.split('.');
    if (parts.length < 2) return 'tu cuenta';

    try {
      final normalized = base64Url.normalize(parts[1]);
      final payload = utf8.decode(base64Url.decode(normalized));
      final map = jsonDecode(payload) as Map<String, dynamic>;
      return (map['username'] ?? 'tu cuenta').toString();
    } on FormatException {
      return 'tu cuenta';
    } on TypeError {
      return 'tu cuenta';
    }
  }

  Future<void> _enableNotifications() async {
    final token = await ApiService.getToken();
    if (token == null || token.isEmpty) {
      _showMessage('INICIA SESION EN EL CELULAR PRIMERO');
      return;
    }

    setState(() => _busy = true);
    final result = await WearService.link(
      jwt: token,
      username: _usernameFromJwt(token),
    );
    if (!mounted) return;

    setState(() => _busy = false);
    _showMessage(result.message);
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message, style: const TextStyle(fontSize: 10)),
        duration: const Duration(seconds: 4),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('NOTIFICACIONES')),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(18),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(18),
              decoration: WinBorders.panel(borderColor: AppColors.accent),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.notifications_active,
                    color: AppColors.accent,
                    size: 32,
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'AVISOS DE PUBLICACIONES',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: AppColors.accent,
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Activa las notificaciones para recibir en tu reloj un aviso cuando alguien publique algo en Rooms4ums.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 10,
                      height: 1.5,
                    ),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton.icon(
                    onPressed: _busy ? null : _enableNotifications,
                    icon: _busy
                        ? const SizedBox(
                            width: 14,
                            height: 14,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.black,
                            ),
                          )
                        : const Icon(Icons.notifications_active, size: 16),
                    label: const Text('ACTIVAR AVISOS EN EL RELOJ'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.accent,
                      foregroundColor: Colors.black,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 13,
                      ),
                      shape: const RoundedRectangleBorder(),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
