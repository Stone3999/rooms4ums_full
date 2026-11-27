import 'dart:async';
import 'dart:convert';

import 'package:material_ui/material_ui.dart';

import 'package:rooms4ums_mobile/core/services/api_service.dart';
import 'package:rooms4ums_mobile/core/services/wear_service.dart';
import 'package:rooms4ums_mobile/core/theme/app_colors.dart';
import 'package:rooms4ums_mobile/core/utils/security_validators.dart';

class _DeviceChatMessage {
  final String sender;
  final String body;
  final String time;

  const _DeviceChatMessage({
    required this.sender,
    required this.body,
    required this.time,
  });
}

/// PRÁCTICA 2 - Apartado para conectar el reloj desde el celular.
///
/// Usa el Data Layer API (BLE de Google Play Services). Al vincular, el reloj
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

  final _messageController = TextEditingController();
  final List<_DeviceChatMessage> _messages = <_DeviceChatMessage>[];
  bool _senderIsPhone = true;
  int _phoneSentCount = 0;
  int _watchSentCount = 0;
  String? _chatError;

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
    _messageController.dispose();
    super.dispose();
  }

  Future<void> _refresh({bool silent = false}) async {
    if (!silent) setState(() => _loading = true);

    final results = await Future.wait<Object?>([
      WearService.status(),
      WearService.telemetry(),
    ]);

    if (!mounted) return;
    setState(() {
      _status = results[0] as WearStatus;
      _telemetry = results[1] as WearTelemetry?;
      _loading = false;
    });
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

  String _formatNow() {
    final now = DateTime.now();
    final hh = now.hour.toString().padLeft(2, '0');
    final mm = now.minute.toString().padLeft(2, '0');
    final ss = now.second.toString().padLeft(2, '0');
    return '$hh:$mm:$ss';
  }

  Future<void> _sendDeviceMessage() async {
    final raw = _messageController.text;
    final validation = SecurityValidators.validateMessage(raw);
    if (validation != null) {
      setState(() => _chatError = validation.toUpperCase());
      return;
    }

    final text = raw.trim();
    final watchName = (_status?.nodes.isNotEmpty ?? false) ? _status!.nodes.first.name : 'Wear OS';
    final senderName = _senderIsPhone ? 'Smartphone (A)' : '$watchName (B)';

    setState(() {
      _chatError = null;
      _messages.insert(
        0,
        _DeviceChatMessage(sender: senderName, body: text, time: _formatNow()),
      );
      if (_senderIsPhone) {
        _phoneSentCount++;
      } else {
        _watchSentCount++;
      }
      _messageController.clear();
    });

    if (_senderIsPhone && (_status?.connected ?? false)) {
      final result = await WearService.sendChatMessage(sender: 'Smartphone', message: text);
      if (!mounted) return;
      _snack(result.ok ? 'ENVIADO POR BLE AL RELOJ' : 'GUARDADO LOCAL (${result.message})');
    } else {
      _snack('MENSAJE ENVIADO POR $senderName');
    }
  }

  void _clearChatHistory() {
    setState(() {
      _messages.clear();
      _phoneSentCount = 0;
      _watchSentCount = 0;
      _chatError = null;
    });
    _snack('HISTORIAL LIMPIADO');
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
              _deviceChatPanel(status),
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
                : connected
                    ? 'El enlace BLE está activo. Puedes vincular la sesión y probar el envío.'
                    : 'Abre la app del reloj y acércalo. Si usas emuladores, empareja el reloj desde Android Studio.',
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

  Widget _deviceChatPanel(WearStatus? status) {
    final watchName = (status?.nodes.isNotEmpty ?? false) ? status!.nodes.first.name : 'Wear OS';
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: WinBorders.panel(borderWidth: 1),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const Expanded(
                child: Text(
                  'INTERACCIÓN ENTRE DISPOSITIVOS (PRÁCTICA 6)',
                  style: TextStyle(color: AppColors.accent, fontSize: 9, letterSpacing: 1),
                ),
              ),
              if (_messages.isNotEmpty)
                TextButton(
                  onPressed: _clearChatHistory,
                  style: TextButton.styleFrom(
                    foregroundColor: const Color(0xFFFF7777),
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  child: const Text('LIMPIAR', style: TextStyle(fontSize: 9)),
                ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'A: Smartphone  |  B: $watchName',
            style: const TextStyle(color: AppColors.textPrimary, fontSize: 10),
          ),
          const SizedBox(height: 6),
          Text(
            'ENVIADOS A: $_phoneSentCount   ·   ENVIADOS B: $_watchSentCount',
            style: const TextStyle(color: AppColors.textSecondary, fontSize: 9, letterSpacing: 0.6),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => setState(() => _senderIsPhone = true),
                  style: OutlinedButton.styleFrom(
                    backgroundColor: _senderIsPhone ? AppColors.accent : Colors.transparent,
                    foregroundColor: _senderIsPhone ? Colors.black : AppColors.textSecondary,
                    side: BorderSide(color: _senderIsPhone ? AppColors.accent : AppColors.winBorder),
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    shape: const RoundedRectangleBorder(),
                  ),
                  child: const Text('EMISOR: A (TEL)', style: TextStyle(fontSize: 9)),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton(
                  onPressed: () => setState(() => _senderIsPhone = false),
                  style: OutlinedButton.styleFrom(
                    backgroundColor: !_senderIsPhone ? AppColors.accent : Colors.transparent,
                    foregroundColor: !_senderIsPhone ? Colors.black : AppColors.textSecondary,
                    side: BorderSide(color: !_senderIsPhone ? AppColors.accent : AppColors.winBorder),
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    shape: const RoundedRectangleBorder(),
                  ),
                  child: const Text('EMISOR: B (RELOJ)', style: TextStyle(fontSize: 9)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _messageController,
                  maxLength: SecurityValidators.maxMessageLength,
                  style: const TextStyle(fontSize: 11),
                  decoration: const InputDecoration(
                    hintText: 'Mensaje breve...',
                    counterText: '',
                    isDense: true,
                  ),
                  onSubmitted: (_) => _sendDeviceMessage(),
                ),
              ),
              const SizedBox(width: 8),
              ElevatedButton(
                onPressed: _sendDeviceMessage,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.accent,
                  foregroundColor: Colors.black,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                  shape: const RoundedRectangleBorder(),
                ),
                child: const Icon(Icons.send, size: 16),
              ),
            ],
          ),
          if (_chatError != null) ...[
            const SizedBox(height: 6),
            Text(_chatError!, style: const TextStyle(color: Color(0xFFFF7777), fontSize: 9)),
          ],
          if (_messages.isNotEmpty) ...[
            const SizedBox(height: 10),
            const Divider(color: AppColors.winBorder, height: 1),
            const SizedBox(height: 8),
            for (final msg in _messages.take(10))
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '[${msg.time}] ',
                      style: const TextStyle(color: AppColors.textSecondary, fontSize: 9),
                    ),
                    Expanded(
                      child: RichText(
                        text: TextSpan(
                          style: const TextStyle(fontSize: 10, color: AppColors.textPrimary),
                          children: [
                            TextSpan(
                              text: '${msg.sender}: ',
                              style: const TextStyle(color: AppColors.accent, fontWeight: FontWeight.bold),
                            ),
                            TextSpan(text: msg.body),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ],
      ),
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
            '1. Instala la app del reloj y ábrela una vez (no tiene login).\n'
            '2. Empareja el reloj desde la app Wear OS del celular. Si el reloj es un emulador, usa "Pair with emulator" en esa misma app.\n'
            '3. Vuelve aquí: el nodo aparece como CERCA.\n'
            '4. Pulsa CONECTAR WEARABLE: el reloj recibe tu sesión y registra su token FCM.\n'
            '5. Publica desde otra cuenta y el aviso llegará al celular y al reloj.',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 9, height: 1.6),
          ),
        ],
      ),
    );
  }
}
