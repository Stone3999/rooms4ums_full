import 'package:flutter/material.dart';
import 'package:rooms4ums_mobile/core/theme/app_theme.dart';
import 'package:rooms4ums_mobile/ui/screens/landing_screen.dart';

void main() {
  runApp(const Rooms4umsApp());
}

class Rooms4umsApp extends StatelessWidget {
  const Rooms4umsApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Rooms4ums',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.darkRetroTheme,
      home: const LandingScreen(),
    );
  }
}

