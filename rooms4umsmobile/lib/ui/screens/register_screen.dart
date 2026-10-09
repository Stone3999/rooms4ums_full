import 'package:flutter/material.dart';

import 'package:rooms4ums_mobile/core/services/api_service.dart';
import 'package:rooms4ums_mobile/core/theme/app_colors.dart';
import 'package:rooms4ums_mobile/ui/screens/home_screen.dart';
import 'package:rooms4ums_mobile/ui/widgets/auth_form_scaffold.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();

  final _usernameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _birthDateController = TextEditingController();
  final _countryController = TextEditingController(text: 'México');

  bool _isLoading = false;
  bool _obscurePassword = true;
  String? _errorMessage;

  @override
  void dispose() {
    _usernameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _birthDateController.dispose();
    _countryController.dispose();
    super.dispose();
  }

  Future<void> _pickBirthDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime(now.year - 18, now.month, now.day),
      firstDate: DateTime(now.year - 100),
      lastDate: DateTime(now.year - 13),
      helpText: 'FECHA DE NACIMIENTO',
    );
    if (picked == null) return;
    _birthDateController.text =
        '${picked.year}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
  }

  Future<void> _handleRegister() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    FocusScope.of(context).unfocus();
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final username = _usernameController.text.trim();
    final password = _passwordController.text.trim();

    try {
      await ApiService.register(
        username: username,
        email: _emailController.text.trim(),
        password: password,
        birthDate: _birthDateController.text.trim(),
        country: _countryController.text.trim(),
      );

      // El registro no devuelve token, así que iniciamos sesión automáticamente.
      await ApiService.login(identifier: username, password: password);

      if (!mounted) return;
      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(builder: (_) => const HomeScreen()),
        (route) => false,
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _errorMessage = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  String? _validateEmail(String? value) {
    final email = value?.trim() ?? '';
    if (email.isEmpty) return 'Escribe tu correo';
    if (!email.contains('@') || !email.contains('.')) return 'Correo no válido';
    return null;
  }

  String? _validatePassword(String? value) {
    final password = value ?? '';
    if (password.isEmpty) return 'Escribe una contraseña';
    if (password.length < 6) return 'Mínimo 6 caracteres';
    return null;
  }

  @override
  Widget build(BuildContext context) {
    return AuthFormScaffold(
      appBarTitle: 'REGISTRO',
      title: 'NUEVO USUARIO',
      subtitle: 'CREA TU CUENTA EN ROOMS4UMS',
      formKey: _formKey,
      isLoading: _isLoading,
      errorMessage: _errorMessage,
      submitLabel: 'REGISTRARSE',
      submitIcon: Icons.person_add_alt,
      onSubmit: _handleRegister,
      fields: [
        TextFormField(
          controller: _usernameController,
          textInputAction: TextInputAction.next,
          autocorrect: false,
          decoration: const InputDecoration(labelText: 'USUARIO'),
          validator: (value) =>
              (value == null || value.trim().isEmpty) ? 'Elige un nombre de usuario' : null,
        ),
        TextFormField(
          controller: _emailController,
          keyboardType: TextInputType.emailAddress,
          textInputAction: TextInputAction.next,
          autocorrect: false,
          decoration: const InputDecoration(labelText: 'CORREO ELECTRÓNICO'),
          validator: _validateEmail,
        ),
        TextFormField(
          controller: _passwordController,
          obscureText: _obscurePassword,
          textInputAction: TextInputAction.next,
          decoration: InputDecoration(
            labelText: 'CONTRASEÑA',
            suffixIcon: IconButton(
              icon: Icon(_obscurePassword ? Icons.visibility : Icons.visibility_off, size: 18),
              color: AppColors.textSecondary,
              onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
            ),
          ),
          validator: _validatePassword,
        ),
        TextFormField(
          controller: _birthDateController,
          readOnly: true,
          onTap: _pickBirthDate,
          decoration: const InputDecoration(
            labelText: 'FECHA DE NACIMIENTO',
            suffixIcon: Icon(Icons.calendar_today, size: 16),
          ),
          validator: (value) =>
              (value == null || value.trim().isEmpty) ? 'Selecciona tu fecha de nacimiento' : null,
        ),
        TextFormField(
          controller: _countryController,
          textInputAction: TextInputAction.done,
          decoration: const InputDecoration(labelText: 'PAÍS'),
          validator: (value) =>
              (value == null || value.trim().isEmpty) ? 'Escribe tu país' : null,
        ),
      ],
      footer: const Text(
        'AL REGISTRARTE, EL BACKEND TE ASIGNA UNA SESIÓN ACTIVA.',
        textAlign: TextAlign.center,
        style: TextStyle(color: AppColors.textSecondary, fontSize: 10, letterSpacing: 0.8),
      ),
    );
  }
}