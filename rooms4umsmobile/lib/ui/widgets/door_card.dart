import 'package:flutter/material.dart';

import 'package:rooms4ums_mobile/core/theme/app_colors.dart';

/// Réplica de la "puerta" del home web: marco naranja, borde interior claro,
/// pomo a la derecha y etiqueta interactiva inferior.
class DoorCard extends StatefulWidget {
  final String title;
  final String subtitle;
  final bool isInteractive;
  final VoidCallback onTap;

  const DoorCard({
    super.key,
    required this.title,
    required this.subtitle,
    required this.isInteractive,
    required this.onTap,
  });

  @override
  State<DoorCard> createState() => _DoorCardState();
}

class _DoorCardState extends State<DoorCard> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: widget.onTap,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 120),
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          border: Border.all(
            color: _pressed ? AppColors.accentHover : AppColors.accent,
            width: 3,
          ),
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [AppColors.bgSecondary, AppColors.bg],
          ),
          boxShadow: [
            BoxShadow(
              color: AppColors.accent.withValues(alpha: _pressed ? 0.05 : 0.22),
              blurRadius: _pressed ? 4 : 12,
              offset: Offset(0, _pressed ? 1 : 4),
            ),
          ],
        ),
        child: Stack(
          children: [
            // Borde interior claro (equivale a .door::before en CSS).
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(border: Border.all(color: AppColors.winBorder)),
              ),
            ),

            // Pomo de la puerta.
            Positioned(
              right: 6,
              top: 0,
              bottom: 0,
              child: Center(
                child: Container(
                  width: 11,
                  height: 11,
                  decoration: BoxDecoration(
                    color: AppColors.accent,
                    borderRadius: BorderRadius.circular(2),
                    border: Border.all(color: Colors.black),
                  ),
                ),
              ),
            ),

            // Título de la sala.
            Positioned(
              top: 18,
              left: 12,
              right: 24,
              child: Text(
                widget.title.toUpperCase(),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: AppColors.accent,
                  fontWeight: FontWeight.bold,
                  fontSize: 15,
                  letterSpacing: 1,
                  height: 1.2,
                ),
              ),
            ),

            // Etiqueta inferior (interactive-tag).
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: Container(
                color: widget.isInteractive ? AppColors.accent : AppColors.bgPanel,
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Text(
                  widget.isInteractive ? 'FORO' : 'SOLO LECTURA',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: widget.isInteractive ? Colors.black : AppColors.textSecondary,
                    fontWeight: FontWeight.bold,
                    fontSize: 9,
                    letterSpacing: 1,
                  ),
                ),
              ),
            ),

            if (widget.subtitle.isNotEmpty)
              Positioned(
                left: 12,
                right: 24,
                bottom: 30,
                child: Text(
                  widget.subtitle,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 10,
                    height: 1.35,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}