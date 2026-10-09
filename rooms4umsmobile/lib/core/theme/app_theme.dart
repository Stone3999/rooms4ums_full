import 'package:flutter/material.dart';

import 'package:rooms4ums_mobile/core/theme/app_colors.dart';

class AppTheme {
  const AppTheme._();

  static ThemeData get darkRetroTheme {
    const scheme = ColorScheme.dark(
      primary: AppColors.accent,
      secondary: AppColors.bgSecondary,
      surface: AppColors.bg,
      onPrimary: Colors.black,
      onSurface: AppColors.textPrimary,
      error: Color(0xFFFF5555),
      onError: Colors.black,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: AppColors.bg,
      colorScheme: scheme,
      primaryColor: AppColors.accent,
      fontFamily: 'Courier',

      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.bgSecondary,
        foregroundColor: AppColors.accent,
        elevation: 0,
        centerTitle: true,
        titleTextStyle: TextStyle(
          color: AppColors.accent,
          fontWeight: FontWeight.bold,
          letterSpacing: 2,
          fontSize: 16,
        ),
      ),

      iconTheme: const IconThemeData(color: AppColors.accent, size: 20),

      textTheme: const TextTheme(
        bodyMedium: TextStyle(color: AppColors.textBody, fontSize: 13, height: 1.45),
        titleMedium: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.bold),
        labelSmall: TextStyle(color: AppColors.textSecondary, fontSize: 10, letterSpacing: 1),
      ),

      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.bgSecondary,
          foregroundColor: AppColors.accent,
          shape: const BeveledRectangleBorder(),
          side: const BorderSide(color: AppColors.winBorder, width: 2),
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
          textStyle: const TextStyle(
            fontWeight: FontWeight.bold,
            letterSpacing: 1.2,
            fontSize: 12,
          ),
        ),
      ),

      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.accent,
          side: const BorderSide(color: AppColors.accent, width: 2),
          shape: const BeveledRectangleBorder(),
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
          textStyle: const TextStyle(
            fontWeight: FontWeight.bold,
            letterSpacing: 1.2,
            fontSize: 12,
          ),
        ),
      ),

      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(foregroundColor: AppColors.accent),
      ),

      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.bg,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        labelStyle: const TextStyle(color: AppColors.textSecondary, fontSize: 12, letterSpacing: 1),
        floatingLabelStyle: const TextStyle(color: AppColors.accent, fontSize: 12, letterSpacing: 1),
        hintStyle: const TextStyle(color: AppColors.textSecondary),
        enabledBorder: const OutlineInputBorder(
          borderSide: BorderSide(color: AppColors.winBorder),
          borderRadius: BorderRadius.zero,
        ),
        focusedBorder: const OutlineInputBorder(
          borderSide: BorderSide(color: AppColors.accent, width: 2),
          borderRadius: BorderRadius.zero,
        ),
        errorBorder: const OutlineInputBorder(
          borderSide: BorderSide(color: Color(0xFFFF5555)),
          borderRadius: BorderRadius.zero,
        ),
        focusedErrorBorder: const OutlineInputBorder(
          borderSide: BorderSide(color: Color(0xFFFF5555), width: 2),
          borderRadius: BorderRadius.zero,
        ),
      ),

      dialogTheme: const DialogThemeData(
        backgroundColor: AppColors.bgSecondary,
        shape: BeveledRectangleBorder(
          side: BorderSide(color: AppColors.accent, width: 2),
        ),
        titleTextStyle: TextStyle(
          color: AppColors.accent,
          fontWeight: FontWeight.bold,
          letterSpacing: 1.5,
          fontSize: 15,
        ),
        contentTextStyle: TextStyle(color: AppColors.textBody, fontSize: 13),
      ),

      snackBarTheme: const SnackBarThemeData(
        backgroundColor: AppColors.bgPanel,
        contentTextStyle: TextStyle(color: AppColors.textPrimary, fontSize: 12),
        behavior: SnackBarBehavior.floating,
        shape: BeveledRectangleBorder(
          side: BorderSide(color: AppColors.winBorder),
        ),
      ),

      dividerColor: AppColors.winBorder,
      splashColor: AppColors.accent.withValues(alpha: 0.08),
      highlightColor: AppColors.accent.withValues(alpha: 0.05),
    );
  }
}