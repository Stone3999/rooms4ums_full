import 'package:flutter/material.dart';

import 'package:rooms4ums_mobile/core/theme/app_colors.dart';

/// Marco compartido por las pantallas de login y registro.
/// Centraliza el panel retro biselado, el botón de envío y el mensaje de error.
class AuthFormScaffold extends StatelessWidget {
  final String appBarTitle;
  final String title;
  final String subtitle;
  final GlobalKey<FormState> formKey;
  final List<Widget> fields;
  final String submitLabel;
  final IconData submitIcon;
  final VoidCallback onSubmit;
  final bool isLoading;
  final String? errorMessage;
  final Widget? footer;

  const AuthFormScaffold({
    super.key,
    required this.appBarTitle,
    required this.title,
    required this.subtitle,
    required this.formKey,
    required this.fields,
    required this.submitLabel,
    required this.submitIcon,
    required this.onSubmit,
    required this.isLoading,
    this.errorMessage,
    this.footer,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(appBarTitle)),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 380),
              child: Form(
                key: formKey,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      title,
                      textAlign: TextAlign.center,
                      style: kTitleStyle.copyWith(fontSize: 20),
                    ),
                    const SizedBox(height: 8),
                    Text(subtitle, textAlign: TextAlign.center, style: kLabelStyle),
                    const SizedBox(height: 28),
                    if (errorMessage != null) ...[
                      ErrorBanner(message: errorMessage!),
                      const SizedBox(height: 20),
                    ],
                    for (var i = 0; i < fields.length; i++) ...[
                      fields[i],
                      if (i != fields.length - 1) const SizedBox(height: 16),
                    ],
                    const SizedBox(height: 24),
                    SizedBox(
                      height: 52,
                      child: ElevatedButton.icon(
                        onPressed: isLoading ? null : onSubmit,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.accent,
                          foregroundColor: Colors.black,
                          disabledBackgroundColor: AppColors.accent.withValues(alpha: 0.4),
                          padding: EdgeInsets.zero,
                        ),
                        icon: isLoading
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black),
                              )
                            : Icon(submitIcon, size: 18),
                        label: Text(
                          isLoading ? 'CONECTANDO...' : submitLabel,
                          style: const TextStyle(fontWeight: FontWeight.bold, letterSpacing: 1.5),
                        ),
                      ),
                    ),
                    if (footer != null) ...[
                      const SizedBox(height: 24),
                      footer!,
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class ErrorBanner extends StatelessWidget {
  final String message;

  const ErrorBanner({super.key, required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFFF5555).withValues(alpha: 0.12),
        border: Border.all(color: const Color(0xFFFF5555)),
        borderRadius: BorderRadius.zero,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.error_outline, color: Color(0xFFFF5555), size: 16),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(color: Color(0xFFFF7777), fontSize: 12, height: 1.4),
            ),
          ),
        ],
      ),
    );
  }
}