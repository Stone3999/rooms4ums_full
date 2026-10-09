import 'package:flutter/material.dart';

class AppTheme {
  // Paleta de colores basada en el CSS web
  static const Color bgColor = Color(0xFF000000);
  static const Color bgSecondary = Color(0xFF0A0A0A);
  static const Color accentColor = Color(0xFFFF8C00);
  static const Color accentHover = Color(0xFFFF4500);
  static const Color textPrimary = Color(0xFFFFFFFF);
  static const Color textSecondary = Color(0xFF888888);
  static const Color winBorderLight = Color(0xFF444444);
  static const Color winBorderDark = Color(0xFF111111);

  static ThemeData get darkRetroTheme {
    return ThemeData(
      brightness: Brightness.dark,
      scaffoldBackgroundColor: bgColor,
      primaryColor: accentColor,
      colorScheme: const ColorScheme.dark(
        primary: accentColor,
        secondary: bgSecondary,
        surface: bgColor,
        onPrimary: Colors.black,
        onSurface: textPrimary,
      ),
      // Tipografía base (usaremos Courier New por defecto en móvil para simular el monospace/retro, 
      // a menos que luego importemos una fuente pixelart)
      fontFamily: 'Courier', 
      
      appBarTheme: const AppBarTheme(
        backgroundColor: bgSecondary,
        foregroundColor: accentColor,
        elevation: 0,
        centerTitle: true,
        titleTextStyle: TextStyle(
          color: accentColor,
          fontWeight: FontWeight.bold,
          letterSpacing: 1.0,
          fontSize: 20,
          fontFamily: 'Courier',
        ),
      ),

      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: bgColor,
          foregroundColor: accentColor,
          shape: const BeveledRectangleBorder(),
          side: const BorderSide(color: winBorderLight, width: 2),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          textStyle: const TextStyle(
            fontWeight: FontWeight.bold,
            letterSpacing: 1.0,
            fontSize: 12,
            fontFamily: 'Courier',
          ),
        ),
      ),
      
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: accentColor,
          side: const BorderSide(color: accentColor, width: 2),
          shape: const BeveledRectangleBorder(),
        ),
      ),

      cardTheme: CardTheme(
        color: bgColor,
        shape: const BeveledRectangleBorder(),
        side: const BorderSide(color: winBorderLight, width: 2),
        margin: const EdgeInsets.all(8),
      ),
    );
  }
}
