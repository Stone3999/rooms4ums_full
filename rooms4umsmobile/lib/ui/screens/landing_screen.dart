import 'package:flutter/material.dart';

import 'package:rooms4ums_mobile/core/services/api_service.dart';
import 'package:rooms4ums_mobile/core/services/deep_link_service.dart';
import 'package:rooms4ums_mobile/ui/navigation/main_shell.dart';
import 'package:rooms4ums_mobile/ui/screens/login_screen.dart';
import 'package:rooms4ums_mobile/ui/screens/register_screen.dart';

import 'package:rooms4ums_mobile/core/theme/app_colors.dart';
import 'package:rooms4ums_mobile/core/services/notification_service.dart';
import 'package:rooms4ums_mobile/core/services/new_post_watcher.dart';
import 'package:rooms4ums_mobile/ui/navigation/app_router.dart';

/// Pantalla de bienvenida. Si el usuario ya tiene una sesión válida en el
/// backend, entra directo al home; si no, ofrece registro / login / acceso
/// como invitado para poder leer los posts.
class LandingScreen extends StatefulWidget {
  /// Deep link con el que se abrió la app, si llegó por una URL.
  final DeepLink? initialLink;

  const LandingScreen({super.key, this.initialLink});

  @override
  State<LandingScreen> createState() => _LandingScreenState();
}

class _LandingScreenState extends State<LandingScreen> {
  bool _isChecking = true;

  @override
  void initState() {
    super.initState();
    _checkSession();
  }

  Future<void> _checkSession() async {
    final hasSession = await ApiService.hasValidSession();
    if (!mounted) return;

    if (hasSession) {
      _goTo(const MainShell());

      // Con sesión activa: arrancar el monitoreo de posts nuevos (push)
      // y pedir el permiso de notificaciones en Android 13+.
      NewPostWatcher.instance.start();
      NotificationService.instance.requestPermission();

      // Si además vino de una URL, enrutamos al destino real.
      final link = widget.initialLink;
      if (link != null) {
        final navigator = Navigator.of(context);
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (navigator.mounted) AppRouter.route(navigator, link);
        });
      }
      return;
    }

    setState(() => _isChecking = false);
  }

  void _goTo(Widget screen) {
    Navigator.pushAndRemoveUntil(
      context,
      MaterialPageRoute(builder: (_) => screen),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isChecking) {
      return const Scaffold(
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                width: 28,
                height: 28,
                child: CircularProgressIndicator(color: AppColors.accent, strokeWidth: 3),
              ),
              SizedBox(height: 20),
              Text(
                'VERIFICANDO SESIÓN...',
                style: TextStyle(color: AppColors.accent, letterSpacing: 2, fontSize: 12),
              ),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const _BrandHeader(),
                  const SizedBox(height: 40),
                  _PrimaryButton(
                    label: 'INICIAR SESIÓN',
                    icon: Icons.login,
                    filled: true,
                    onPressed: () => Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const LoginScreen()),
                    ),
                  ),
                  const SizedBox(height: 14),
                  _PrimaryButton(
                    label: 'REGISTRARSE',
                    icon: Icons.person_add_alt,
                    filled: false,
                    onPressed: () => Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const RegisterScreen()),
                    ),
                  ),
                  const SizedBox(height: 28),
                  const _DividerRow(),
                  const SizedBox(height: 12),
                  TextButton(
                    onPressed: () => _goTo(const MainShell()),
                    child: const Text(
                      'ENTRAR COMO INVITADO · VER POSTS',
                      style: TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 11,
                        letterSpacing: 1.2,
                        decoration: TextDecoration.underline,
                        decorationColor: AppColors.winBorder,
                      ),
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

class _BrandHeader extends StatelessWidget {
  const _BrandHeader();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          width: 84,
          height: 84,
          decoration: BoxDecoration(
            border: Border.all(color: AppColors.accent, width: 3),
            boxShadow: [
              BoxShadow(color: AppColors.accent.withValues(alpha: 0.2), blurRadius: 24),
            ],
          ),
          child: const Icon(Icons.terminal, color: AppColors.accent, size: 40),
        ),
        const SizedBox(height: 24),
        const Text(
          'ROOMS4UMS',
          textAlign: TextAlign.center,
          style: TextStyle(
            color: AppColors.accent,
            fontSize: 30,
            fontWeight: FontWeight.bold,
            letterSpacing: 4,
            height: 1.1,
          ),
        ),
        const SizedBox(height: 10),
        const Text(
          'RETRO COMMUNITY & ROOMS',
          textAlign: TextAlign.center,
          style: TextStyle(
            color: AppColors.textSecondary,
            fontSize: 11,
            letterSpacing: 2,
          ),
        ),
      ],
    );
  }
}

class _DividerRow extends StatelessWidget {
  const _DividerRow();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(child: Container(height: 1, color: AppColors.winBorder)),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 12),
          child: Text('· · ·', style: TextStyle(color: AppColors.textSecondary, fontSize: 11)),
        ),
        Expanded(child: Container(height: 1, color: AppColors.winBorder)),
      ],
    );
  }
}

class _PrimaryButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool filled;
  final VoidCallback onPressed;

  const _PrimaryButton({
    required this.label,
    required this.icon,
    required this.filled,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    final fg = filled ? Colors.black : AppColors.accent;
    return SizedBox(
      height: 52,
      child: filled
          ? ElevatedButton.icon(
              onPressed: onPressed,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.accent,
                foregroundColor: fg,
                shape: const BeveledRectangleBorder(),
                padding: EdgeInsets.zero,
              ),
              icon: Icon(icon, size: 18),
              label: Text(label, style: const TextStyle(fontWeight: FontWeight.bold, letterSpacing: 1.5)),
            )
          : OutlinedButton.icon(
              onPressed: onPressed,
              style: OutlinedButton.styleFrom(
                foregroundColor: fg,
                side: const BorderSide(color: AppColors.accent, width: 2),
                shape: const BeveledRectangleBorder(),
                padding: EdgeInsets.zero,
              ),
              icon: Icon(icon, size: 18),
              label: Text(label, style: const TextStyle(fontWeight: FontWeight.bold, letterSpacing: 1.5)),
            ),
    );
  }
}