import 'dart:async';
import 'dart:convert';

import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:material_ui/material_ui.dart';

import 'package:rooms4ums_mobile/core/services/api_service.dart';
import 'package:rooms4ums_mobile/core/services/voice_service.dart';
import 'package:rooms4ums_mobile/core/theme/app_colors.dart';

class VoiceScreen extends StatefulWidget {
  const VoiceScreen({super.key});

  @override
  State<VoiceScreen> createState() => _VoiceScreenState();
}

class _VoiceScreenState extends State<VoiceScreen> {
  final VoiceService _voice = VoiceService.instance;
  final TextEditingController _messageController = TextEditingController();
  String _username = 'Usuario';
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _messageController.dispose();
    if (_voice.activeRoomId != null) unawaited(_voice.leaveRoom());
    super.dispose();
  }

  Future<void> _load() async {
    final token = await ApiService.getToken();
    if (token != null && token.isNotEmpty) {
      try {
        final payload = jsonDecode(
          utf8.decode(base64Url.decode(base64Url.normalize(token.split('.')[1]))),
        ) as Map<String, dynamic>;
        _username = payload['username']?.toString() ?? 'Usuario';
      } catch (_) {
        _username = 'Usuario';
      }
    }

    try {
      await _voice.loadChannels();
    } catch (error) {
      _showMessage(_voice.error ?? 'No se pudieron cargar los canales de voz.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _refresh() async {
    try {
      await _voice.loadChannels();
    } catch (_) {
      _showMessage(_voice.error ?? 'No se pudieron actualizar los canales.');
    }
  }

  Future<void> _createChannel() async {
    final categoryController = TextEditingController(text: 'general');
    final topicController = TextEditingController();
    final channelData = await showDialog<(String, String)>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: AppColors.bgSecondary,
        title: const Text('CREAR CHAT DE VOZ'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: categoryController,
              maxLength: 64,
              decoration: const InputDecoration(labelText: 'SALA / CATEGORÍA'),
            ),
            TextField(
              controller: topicController,
              maxLength: 30,
              decoration: const InputDecoration(labelText: 'TEMA'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('CANCELAR'),
          ),
          FilledButton(
            onPressed: () {
              final category = categoryController.text.trim();
              final topic = topicController.text.trim();
              if (category.isEmpty || topic.isEmpty) return;
              Navigator.pop(dialogContext, (category, topic));
            },
            child: const Text('CREAR'),
          ),
        ],
      ),
    );
    categoryController.dispose();
    topicController.dispose();
    if (channelData == null) return;

    try {
      final channelId = await _voice.createChannel(
        category: channelData.$1,
        topic: channelData.$2,
        username: _username,
      );
      await _join(channelId);
    } catch (_) {
      _showMessage(_voice.error ?? 'No se pudo crear el canal de voz.');
    }
  }

  Future<void> _join(String channelId) async {
    try {
      await _voice.joinRoom(channelId, _username);
    } catch (_) {
      _showMessage(_voice.error ?? 'No se pudo entrar al canal.');
    }
  }

  Future<void> _sendMessage() async {
    final content = _messageController.text.trim();
    if (content.isEmpty) return;
    try {
      await _voice.sendMessage(content);
      _messageController.clear();
    } catch (_) {
      _showMessage(_voice.error ?? 'No se pudo enviar el mensaje.');
    }
  }

  Future<void> _toggleScreenShare() async {
    try {
      await _voice.toggleScreenShare();
    } catch (_) {
      _showMessage(_voice.error ?? 'No se pudo compartir la pantalla.');
    }
  }

  void _showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _voice,
      builder: (context, _) {
        final activeRoomId = _voice.activeRoomId;
        if (activeRoomId != null) return _buildActiveRoom(activeRoomId);
        return _buildChannelList();
      },
    );
  }

  Widget _buildChannelList() {
    return Scaffold(
      appBar: AppBar(
        title: const Text('CHATS DE VOZ'),
        actions: [
          IconButton(
            tooltip: 'Actualizar',
            onPressed: _loading ? null : _refresh,
            icon: const Icon(Icons.refresh),
          ),
          IconButton(
            tooltip: 'Crear canal',
            onPressed: _createChannel,
            icon: const Icon(Icons.add),
          ),
        ],
      ),
      body: SafeArea(
        child: _loading
            ? const Center(child: CircularProgressIndicator(color: AppColors.accent))
            : _voice.channels.isEmpty
                ? const Center(
                    child: Padding(
                      padding: EdgeInsets.all(24),
                      child: Text(
                        'NO HAY CANALES ACTIVOS.\nCREA UNO PARA INICIAR UN CHAT DE VOZ.',
                        textAlign: TextAlign.center,
                      ),
                    ),
                  )
                : RefreshIndicator(
                    onRefresh: _refresh,
                    child: ListView.separated(
                      padding: const EdgeInsets.all(12),
                      itemCount: _voice.channels.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 10),
                      itemBuilder: (context, index) {
                        final channel = _voice.channels[index];
                        return Card(
                          child: ListTile(
                            leading: const Icon(Icons.headset_mic, color: AppColors.accent),
                            title: Text(
                              (channel['topic'] ?? 'CHAT DE VOZ').toString(),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            subtitle: Text(
                              '#${channel['category'] ?? 'general'} · '
                              '${channel['userCount'] ?? 0} conectados',
                            ),
                            trailing: const Icon(Icons.arrow_forward),
                            onTap: () => _join(channel['id'].toString()),
                          ),
                        );
                      },
                    ),
                  ),
      ),
    );
  }

  Widget _buildActiveRoom(String roomId) {
    final channel = _voice.channels.cast<Map<String, dynamic>?>().firstWhere(
          (item) => item?['id'] == roomId,
          orElse: () => null,
        );
    return Scaffold(
      appBar: AppBar(
        title: Text((channel?['topic'] ?? 'CHAT DE VOZ').toString()),
        leading: IconButton(
          tooltip: 'Salir del canal',
          onPressed: _voice.leaveRoom,
          icon: const Icon(Icons.arrow_back),
        ),
        actions: [
          IconButton(
            tooltip: _voice.isMuted ? 'Activar micrófono' : 'Silenciar micrófono',
            onPressed: _voice.toggleMute,
            icon: Icon(_voice.isMuted ? Icons.mic_off : Icons.mic),
          ),
          IconButton(
            tooltip: _voice.isSharingScreen ? 'Dejar de compartir' : 'Compartir pantalla',
            onPressed: _toggleScreenShare,
            icon: Icon(_voice.isSharingScreen ? Icons.stop_screen_share : Icons.screen_share),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              color: AppColors.bgSecondary,
              child: Text(
                'CONECTADO A #${channel?['category'] ?? 'general'} · '
                '${_voice.participants.length + 1} PARTICIPANTES',
              ),
            ),
            if (_voice.error != null)
              Padding(
                padding: const EdgeInsets.all(8),
                child: Text(_voice.error!, style: const TextStyle(color: Colors.redAccent)),
              ),
            Expanded(
              flex: 2,
              child: ListView(
                padding: const EdgeInsets.all(12),
                children: [
                  ListTile(
                    leading: Icon(
                      _voice.isMuted ? Icons.mic_off : Icons.mic,
                      color: AppColors.accent,
                    ),
                    title: Text('$_username (TÚ)'),
                    subtitle: Text(_voice.isMuted ? 'MICRÓFONO SILENCIADO' : 'MICRÓFONO ACTIVO'),
                  ),
                  for (final participant in _voice.participants) ...[
                    ListTile(
                      leading: Icon(
                        participant.isMuted ? Icons.mic_off : Icons.person,
                        color: participant.isMuted ? Colors.redAccent : AppColors.accent,
                      ),
                      title: Text(participant.username),
                      subtitle: Text(participant.isSharingScreen ? 'COMPARTIENDO PANTALLA' : 'CONECTADO'),
                    ),
                    if (participant.stream != null)
                      VoiceStreamPreview(
                        stream: participant.stream!,
                        showVideo: participant.isSharingScreen,
                      ),
                  ],
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              flex: 3,
              child: ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                itemCount: _voice.messages.length,
                itemBuilder: (context, index) {
                  final message = _voice.messages[index];
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: RichText(
                      text: TextSpan(
                        style: DefaultTextStyle.of(context).style,
                        children: [
                          TextSpan(
                            text: '${message['sender'] ?? 'Usuario'}: ',
                            style: const TextStyle(
                              color: AppColors.accent,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          TextSpan(text: message['content']?.toString() ?? ''),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _messageController,
                      maxLength: 200,
                      onSubmitted: (_) => _sendMessage(),
                      decoration: const InputDecoration(
                        hintText: 'ESCRIBE UN MENSAJE',
                        counterText: '',
                      ),
                    ),
                  ),
                  IconButton(
                    tooltip: 'Enviar',
                    onPressed: _sendMessage,
                    icon: const Icon(Icons.send, color: AppColors.accent),
                  ),
                  IconButton(
                    tooltip: 'Salir del canal',
                    onPressed: _voice.leaveRoom,
                    icon: const Icon(Icons.call_end, color: Colors.redAccent),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class VoiceStreamPreview extends StatefulWidget {
  final MediaStream stream;
  final bool showVideo;

  const VoiceStreamPreview({
    super.key,
    required this.stream,
    this.showVideo = true,
  });

  @override
  State<VoiceStreamPreview> createState() => _VoiceStreamPreviewState();
}

class _VoiceStreamPreviewState extends State<VoiceStreamPreview> {
  final RTCVideoRenderer _renderer = RTCVideoRenderer();
  bool _initialized = false;

  @override
  void initState() {
    super.initState();
    _initialize();
  }

  Future<void> _initialize() async {
    await _renderer.initialize();
    _renderer.srcObject = widget.stream;
    if (mounted) setState(() => _initialized = true);
  }

  @override
  void didUpdateWidget(covariant VoiceStreamPreview oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.stream != widget.stream && _initialized) {
      _renderer.srcObject = widget.stream;
    }
  }

  @override
  void dispose() {
    _renderer.srcObject = null;
    unawaited(_renderer.dispose());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_initialized) {
      if (!widget.showVideo) return const SizedBox(width: 1, height: 1);
      return const SizedBox(
        height: 180,
        child: Center(child: CircularProgressIndicator(color: AppColors.accent)),
      );
    }
    if (!widget.showVideo) {
      return SizedBox(
        width: 1,
        height: 1,
        child: RTCVideoView(_renderer),
      );
    }
    return SizedBox(
      height: 180,
      child: RTCVideoView(
        _renderer,
        objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitContain,
      ),
    );
  }
}
