import 'package:flutter/material.dart';

import 'package:rooms4ums_mobile/core/theme/app_colors.dart';
import 'package:rooms4ums_mobile/ui/screens/home_screen.dart';
import 'package:rooms4ums_mobile/ui/screens/popular_screen.dart';
import 'package:rooms4ums_mobile/ui/screens/wearable_screen.dart';

/// Contenedor principal con barra de navegación inferior.
/// Mantiene viva cada pestaña con IndexedStack para no recargar al cambiar.
class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _index = 0;

  static const List<Widget> _tabs = <Widget>[
    HomeScreen(),
    PopularScreen(),
    WearableScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _index, children: _tabs),
      bottomNavigationBar: _buildBar(),
    );
  }

  Widget _buildBar() {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.bgSecondary,
        border: Border(top: BorderSide(color: AppColors.winBorder, width: 2)),
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 58,
          child: Row(
            children: [
              _item(0, Icons.door_front_door_outlined, 'SALAS'),
              _item(1, Icons.local_fire_department, 'POPULARES'),
              _item(2, Icons.watch, 'RELOJ'),
            ],
          ),
        ),
      ),
    );
  }

  Widget _item(int index, IconData icon, String label) {
    final selected = _index == index;
    final color = selected ? AppColors.accent : AppColors.textSecondary;

    return Expanded(
      child: InkWell(
        onTap: () => setState(() => _index = index),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 20, color: color),
            const SizedBox(height: 3),
            Text(
              label,
              style: TextStyle(
                color: color,
                fontSize: 8,
                letterSpacing: 0.6,
                fontWeight: selected ? FontWeight.bold : FontWeight.normal,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
