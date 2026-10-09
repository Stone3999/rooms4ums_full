import 'package:flutter/material.dart';

/// Paleta y estilos compartidos taken del CSS de la web (rooms4ums/src/styles).
class AppColors {
  static const Color bg = Color(0xFF000000);
  static const Color bgSecondary = Color(0xFF0A0A0A);
  static const Color bgPanel = Color(0xFF111111);

  static const Color accent = Color(0xFFFF8C00);
  static const Color accentHover = Color(0xFFFF4500);

  static const Color textPrimary = Color(0xFFFFFFFF);
  static const Color textSecondary = Color(0xFF888888);
  static const Color textBody = Color(0xFFCCCCCC);

  static const Color winBorder = Color(0xFF444444);
  static const Color winBorderDark = Color(0xFF111111);

  const AppColors._();
}

/// Bordes biselados estilo Windows 95, igual que `.win-panel` en la web.
class WinBorders {
  const WinBorders._();

  static Border get all => Border.all(color: AppColors.winBorder, width: 2);

  static BoxDecoration panel({Color? color, Color? borderColor, double borderWidth = 2}) {
    return BoxDecoration(
      color: color ?? AppColors.bgSecondary,
      border: Border.all(
        color: borderColor ?? AppColors.winBorder,
        width: borderWidth,
      ),
    );
  }

  /// Detalle del borde "elevado" (luz arriba/izquierda, sombra abajo/derecha).
  static BoxDecoration raised({Color? color, Color? borderColor}) {
    final light = borderColor ?? AppColors.winBorder;
    final dark = AppColors.winBorderDark;
    return BoxDecoration(
      color: color ?? AppColors.bgSecondary,
      border: Border(
        top: BorderSide(color: light, width: 2),
        left: BorderSide(color: light, width: 2),
        right: BorderSide(color: dark, width: 2),
        bottom: BorderSide(color: dark, width: 2),
      ),
    );
  }
}

const TextStyle kTitleStyle = TextStyle(
  color: AppColors.accent,
  fontSize: 18,
  fontWeight: FontWeight.bold,
  letterSpacing: 2,
);

const TextStyle kLabelStyle = TextStyle(
  color: AppColors.textSecondary,
  fontSize: 11,
  letterSpacing: 1.5,
);