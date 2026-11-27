import 'dart:async';
import 'dart:convert';

import 'package:material_ui/material_ui.dart';

import 'package:rooms4ums_mobile/core/services/api_service.dart';
import 'package:rooms4ums_mobile/core/services/voice_service.dart';
import 'package:rooms4ums_mobile/core/services/wear_service.dart';
import 'package:rooms4ums_mobile/core/theme/app_colors.dart';

/// PRÁCTICA 2 - Apartado para conectar el reloj desde el celular.
///
/// Usa el Data Layer de Google Play Services. Al vincular, el reloj
/// recibe el JWT del celular y registra su propio token FCM: desde ese momento
/// las notificaciones del foro llegan también a la muñeca.
class WearableScreen extends StatefulWidget {
  const WearableScreen({super.key});

  @override
  State<WearableScreen> createState() => _WearableScreenState();
}

class _WearableScreenState extends State<WearableScreen> {
  WearStatus? _status;
  WearTelemetry? _telemetry;
  Timer? _timer;
  bool _refreshing = false;

  bool _loading = true;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _refresh();
    _timer = Timer.periodic(const Duration(seconds: 3), (_) => _refresh(silent: true));
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _refresh({bool silent = false}) async {
    if (_refreshing) return;
    _refreshing = true;
    if (!silent) setState(() => _loading = true);

    try {
      final results = await Future.wait<Object?>([
        WearService.status(),
        WearService.telemetry(),
      ]);
      if (!mounted) return;

      final status = results[0] as WearStatus;
      setState(() {
        _status = status;
        _telemetry = results[1] as WearTelemetry?;
        _loading = false;
      });

    } finally {
      _refreshing = false;
      if (mounted && _loading) setState(() => _loading = false);
    }
  }

  String _usernameFromJwt(String? token) {
    if (token == null || token.isEmpty) return 'tu cuenta';
    final parts = token.split('.');
    if (parts.length < 2) return 'tu cuenta';

    try {
      final normalized = base64Url.normalize(parts[1]);
      final payload = utf8.decode(base64Url.decode(normalized));
      final map = jsonDecode(payload) as Map<String, dynamic>;
      return (map['username'] ?? 'tu cuenta').toString();
    } catch (_) {
      return 'tu cuenta';
    }
  }

  Future<void> _link() async {
    final token = await ApiService.getToken();
    if (token == null || token.isEmpty) {
      _snack('INICIA SESION EN EL CELULAR PRIMERO');
      return;
    }

    setState(() => _busy = true);
    final result = await WearService.link(
      jwt: token,
      username: _usernameFromJwt(token),
    );
    if (!mounted) return;

    setState(() => _busy = false);
    _snack(result.message);
    if (result.ok) _refresh();
  }

  Future<void> _testNotification() async {
    setState(() => _busy = true);
    final result = await WearService.testNotification();
    if (!mounted) return;

    setState(() => _busy = false);
    _snack(result.message);
  }

  void _snack(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message, style: const TextStyle(fontSize: 10)),
        duration: const Duration(seconds: 4),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final status = _status;
    final connected = status?.connected == true;

    return Scaffold(
      appBar: AppBar(
        title: const Text('WEARABLE'),
        actions: [
          IconButton(
            tooltip: 'Actualizar',
            icon: const Icon(Icons.refresh, size: 19),
            onPressed: () => _refresh(),
          ),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          color: AppColors.accent,
          backgroundColor: AppColors.bgSecondary,
          onRefresh: _refresh,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(14, 14, 14, 28),
            children: [
              _statusPanel(status, connected),
              const SizedBox(height: 12),
              if (status != null && status.nodes.isNotEmpty) ...[
                _nodesPanel(status.nodes),
                const SizedBox(height: 12),
              ],
              _telemetryPanel(),
              const SizedBox(height: 12),
              _callStatusPanel(),
              const SizedBox(height: 12),
              _actions(connected),
              const SizedBox(height: 16),
              _help(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _statusPanel(WearStatus? status, bool connected) {
    final unsupported = status?.supported == false;
    final color =
        unsupported ? AppColors.textSecondary : (connected ? AppColors.accent : const Color(0xFFFF7777));

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: WinBorders.panel(borderColor: color),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                unsupported
                    ? Icons.phone_android
                    : (connected ? Icons.watch : Icons.watch_off),
                size: 22,
                color: color,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  _loading && status == null
                      ? 'BUSCANDO RELOJ...'
                      : unsupported
                          ? 'NO DISPONIBLE EN ESTA PLATAFORMA'
                          : connected
                              ? 'RELOJ CONECTADO'
                              : 'SIN RELOJ CONECTADO',
                  style: TextStyle(
                    color: color,
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1,
                  ),
                ),
              ),
              if (_loading)
                const SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.accent),
                ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            unsupported
                ? 'El enlace Data Layer solo existe en Android.'
                : connected && status?.wearAppInstalled == true
                    ? 'La app Rooms4ums está instalada en el reloj y el enlace está activo.'
                    : connected
                        ? 'El reloj está emparejado, pero falta instalar y abrir la app Rooms4ums.'
                        : 'NO HAY VÍNCULO WEAR DATA LAYER. QUE APAREZCA EN ADB NO SIGNIFICA QUE ESTÉ EMPAREJADO.',
            style: const TextStyle(color: AppColors.textSecondary, fontSize: 10, height: 1.5),
          ),
          if (status?.error != null) ...[
            const SizedBox(height: 8),
            Text(
              status!.error!,
              style: const TextStyle(color: Color(0xFFFF7777), fontSize: 9),
            ),
          ],
        ],
      ),
    );
  }

  Widget _nodesPanel(List<WearNode> nodes) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: WinBorders.panel(borderWidth: 1),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('NODOS DEL DATA LAYER', style: TextStyle(color: AppColors.accent, fontSize: 9, letterSpacing: 1)),
          const SizedBox(height: 8),
          for (final node in nodes)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                children: [
                  Icon(
                    node.wearApp ? Icons.check_circle : Icons.help_outline,
                    size: 12,
                    color: node.wearApp ? AppColors.accent : AppColors.textSecondary,
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      node.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: AppColors.textPrimary, fontSize: 10),
                    ),
                  ),
                  Text(
                    node.nearby ? 'CERCA' : 'LEJOS',
                    style: const TextStyle(color: AppColors.textSecondary, fontSize: 8),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _telemetryPanel() {
    final t = _telemetry;
    final hasBattery = t != null && t.battery >= 0;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: WinBorders.panel(borderWidth: 1),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'TELEMETRIA DEL RELOJ (PRACTICA 1 + 2)',
            style: TextStyle(color: AppColors.accent, fontSize: 9, letterSpacing: 1),
          ),
          const SizedBox(height: 10),
          if (t == null)
            const Text(
              'Sin muestras todavía. Abre la app del reloj para que el servicio de sensores publique.',
              style: TextStyle(color: AppColors.textSecondary, fontSize: 10, height: 1.5),
            )
          else
            Row(
              children: [
                _metric(t.magnitude.toStringAsFixed(1), 'm/s2'),
                _metric(hasBattery ? '${t.battery}%' : '--', 'bateria'),
                _metric(t.rotated ? 'SI' : 'NO', 'giro'),
              ],
            ),
        ],
      ),
    );
  }

  Widget _metric(String value, String label) {
    return Expanded(
      child: Column(
        children: [
          Text(
            value,
            style: const TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: const TextStyle(color: AppColors.textSecondary, fontSize: 8, letterSpacing: 1),
          ),
        ],
      ),
    );
  }

  Widget _callStatusPanel() {
    final voice = VoiceService.instance;
    return AnimatedBuilder(
      animation: voice,
      builder: (context, _) {
        final active = voice.activeRoomId != null;
        final channel = voice.channels.cast<Map<String, dynamic>?>().firstWhere(
          (item) => item?['id'] == voice.activeRoomId,
          orElse: () => null,
        );
        final topic = channel?['topic']?.toString();
        return Container(
          width: double.infinity,
          padding: const EdgeInsets.all(14),
          decoration: WinBorders.panel(
            borderColor: active ? AppColors.accent : AppColors.winBorder,
          ),
          child: Row(
            children: [
              Icon(
                active ? Icons.call : Icons.call_end,
                color: active ? AppColors.accent : AppColors.textSecondary,
                size: 20,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      active ? 'EN LLAMADA' : 'SIN LLAMADA ACTIVA',
                      style: TextStyle(
                        color: active ? AppColors.accent : AppColors.textPrimary,
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 1,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      active
                          ? '${topic ?? 'Canal de voz'} · ${voice.isMuted ? 'MICRÓFONO SILENCIADO' : 'MICRÓFONO ACTIVO'}'
                          : 'El reloj mostrará controles al entrar a una llamada.',
                      style: const TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 9,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _actions(bool connected) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ElevatedButton.icon(
          onPressed: _busy ? null : _link,
          icon: const Icon(Icons.link, size: 16),
          label: const Text('CONECTAR WEARABLE'),
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.accent,
            foregroundColor: Colors.black,
            padding: const EdgeInsets.symmetric(vertical: 13),
            shape: const RoundedRectangleBorder(),
          ),
        ),
        const SizedBox(height: 8),
        OutlinedButton.icon(
          onPressed: _busy ? null : _testNotification,
          icon: const Icon(Icons.notifications_active, size: 16),
          label: const Text('PROBAR NOTIFICACION EN EL RELOJ'),
          style: OutlinedButton.styleFrom(
            foregroundColor: AppColors.accent,
            side: const BorderSide(color: AppColors.winBorder),
            padding: const EdgeInsets.symmetric(vertical: 13),
            shape: const RoundedRectangleBorder(),
          ),
        ),
        if (!connected) ...[
          const SizedBox(height: 8),
          const Text(
            'El botón de vincular funciona en cuanto aparezca un nodo conectado.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.textSecondary, fontSize: 9),
          ),
        ],
      ],
    );
  }

  Widget _help() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: WinBorders.panel(borderWidth: 1),
      child: const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('COMO CONECTARLO', style: TextStyle(color: AppColors.accent, fontSize: 9, letterSpacing: 1)),
          SizedBox(height: 8),
          Text(
            '1. Empareja el reloj y el teléfono desde Android Studio Device Manager.\n'
            '2. Instala Rooms4ums en ambos y abre las dos apps. El Data Layer exige el mismo package y firma en los dos dispositivos.\n'
            '3. Vuelve aquí: el nodo debe aparecer como CERCA.\n'
            '4. Pulsa CONECTAR WEARABLE para activar notificaciones del foro en el reloj.\n'
            '5. Si entras a una llamada de voz, el reloj mostrará su estado y los controles para silenciar o colgar.',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 9, height: 1.6),
          ),
        ],
      ),
    );
  }
}
