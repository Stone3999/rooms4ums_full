import 'package:flutter/material.dart';

import 'package:rooms4ums_mobile/core/services/api_service.dart';
import 'package:rooms4ums_mobile/core/services/push_service.dart';
import 'package:rooms4ums_mobile/core/theme/app_colors.dart';
import 'package:rooms4ums_mobile/ui/screens/home_screen.dart';
import 'package:rooms4ums_mobile/ui/widgets/auth_form_scaffold.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _identifierController = TextEditingController();
  final _passwordController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  bool _isLoading = false;
  bool _obscurePassword = true;
  String? _errorMessage;

  @override
  void dispose() {
    _identifierController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    FocusScope.of(context).unfocus();
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      await ApiService.login(
        identifier: _identifierController.text.trim(),
        password: _passwordController.text.trim(),
      );
      if (!mounted) return;
      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(builder: (_) => const HomeScreen()),
        (route) => false,
      );

      // Tras iniciar sesion ya hay JWT: se registra el token FCM para
      // recibir push aunque la app se cierre.
      PushService.instance.registerAfterLogin();
    } catch (e) {
      if (!mounted) return;
      setState(() => _errorMessage = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthFormScaffold(
      appBarTitle: 'LOGIN',
      title: 'ACCESO AL SISTEMA',
      subtitle: 'INICIA SESIÓN PARA ENTRAR',
      errorMessage: _errorMessage,
      formKey: _formKey,
      isLoading: _isLoading,
      submitLabel: 'ENTRAR',
      submitIcon: Icons.login,
      onSubmit: _handleLogin,
      fields: [
        TextFormField(
          controller: _identifierController,
          textInputAction: TextInputAction.next,
          autocorrect: false,
          decoration: const InputDecoration(labelText: 'USUARIO O CORREO'),
          validator: (value) =>
              (value == null || value.trim().isEmpty) ? 'Escribe tu usuario o correo' : null,
        ),
        TextFormField(
          controller: _passwordController,
          obscureText: _obscurePassword,
          textInputAction: TextInputAction.done,
          onFieldSubmitted: (_) => _handleLogin(),
          decoration: InputDecoration(
            labelText: 'CONTRASEÑA',
            suffixIcon: IconButton(
              icon: Icon(_obscurePassword ? Icons.visibility : Icons.visibility_off, size: 18),
              color: AppColors.textSecondary,
              onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
            ),
          ),
          validator: (value) =>
              (value == null || value.isEmpty) ? 'Escribe tu contraseña' : null,
        ),
      ],
      footer: const Text(
        '¿NO TIENES CUENTA? REGÍSTRATE DESDE LA PANTALLA DE INICIO.',
        textAlign: TextAlign.center,
        style: TextStyle(color: AppColors.textSecondary, fontSize: 10, letterSpacing: 0.8),
      ),
    );
  }
}