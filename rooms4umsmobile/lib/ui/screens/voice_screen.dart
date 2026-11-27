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
  final ScrollController _chatController = ScrollController();
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
    _chatController.dispose();
    if (_voice.activeRoomId != null) unawaited(_voice.leaveRoom());
    super.dispose();
  }

  Future<void> _load() async {
    final token = await ApiService.getToken();
    if (token != null && token.isNotEmpty) {
      try {
        final payload = jsonDecode(
          utf8.decode(
            base64Url.decode(base64Url.normalize(token.split('.')[1])),
          ),
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
        title: const Text('Crear canal de voz'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: categoryController,
              maxLength: 64,
              decoration: const InputDecoration(labelText: 'Sala o categoría'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: topicController,
              maxLength: 30,
              decoration: const InputDecoration(labelText: 'Tema'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            onPressed: () {
              final category = categoryController.text.trim();
              final topic = topicController.text.trim();
              if (category.isEmpty || topic.isEmpty) return;
              Navigator.pop(dialogContext, (category, topic));
            },
            child: const Text('Crear'),
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
      if (_chatController.hasClients) {
        await _chatController.animateTo(
          0,
          duration: const Duration(milliseconds: 220),
          curve: Curves.easeOut,
        );
      }
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
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
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
            tooltip: 'Actualizar canales',
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
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 18, 20, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'VOZ EN TIEMPO REAL',
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      color: AppColors.textPrimary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'ENTRA A UNA SALA O CREA UNA NUEVA. EL CHAT DE TEXTO ESTÁ DENTRO DE CADA CANAL.',
                    style: Theme.of(context).textTheme.bodyMedium
                        ?.copyWith(color: AppColors.textSecondary),
                  ),
                ],
              ),
            ),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _voice.channels.isEmpty
                  ? _emptyChannels()
                  : RefreshIndicator(
                      onRefresh: _refresh,
                      child: ListView.separated(
                        padding: const EdgeInsets.fromLTRB(18, 4, 18, 24),
                        itemCount: _voice.channels.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 10),
                        itemBuilder: (context, index) {
                          final channel = _voice.channels[index];
                          final count = channel['userCount'] ?? 0;
                          return Card(
                            child: ListTile(
                              contentPadding: const EdgeInsets.symmetric(
                                horizontal: 16,
                                vertical: 8,
                              ),
                              leading: Container(
                                width: 44,
                                height: 44,
                                decoration: BoxDecoration(
                                  color: AppColors.bgPanel,
                                  border: Border.all(
                                    color: AppColors.winBorder,
                                    width: 2,
                                  ),
                                  borderRadius: BorderRadius.zero,
                                ),
                                child: const Icon(
                                  Icons.graphic_eq,
                                  color: AppColors.accent,
                                ),
                              ),
                              title: Text(
                                (channel['topic'] ?? 'CHAT DE VOZ').toString(),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              subtitle: Padding(
                                padding: const EdgeInsets.only(top: 5),
                                child: Text(
                                  '#${channel['category'] ?? 'general'}  ·  $count conectados',
                                ),
                              ),
                              trailing: const Icon(Icons.arrow_forward_rounded),
                              onTap: () => _join(channel['id'].toString()),
                            ),
                          );
                        },
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _emptyChannels() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: AppColors.bgPanel,
                border: Border.all(color: AppColors.winBorder, width: 2),
                borderRadius: BorderRadius.zero,
              ),
              child: const Icon(
                Icons.headset_mic_outlined,
                color: AppColors.accent,
                size: 30,
              ),
            ),
            const SizedBox(height: 18),
            Text(
              'NO HAY CANALES ACTIVOS',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            Text(
              'CREA UN CANAL PARA EMPEZAR A HABLAR. EL CHAT DE TEXTO APARECERÁ DENTRO DE LA SALA.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium
                  ?.copyWith(color: AppColors.textSecondary),
            ),
            const SizedBox(height: 20),
            ElevatedButton.icon(
              onPressed: _createChannel,
              icon: const Icon(Icons.add),
              label: const Text('Crear canal'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActiveRoom(String roomId) {
    final channel = _voice.channels.cast<Map<String, dynamic>?>().firstWhere(
      (item) => item?['id'] == roomId,
      orElse: () => null,
    );

    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          toolbarHeight: 72,
          leading: IconButton(
            tooltip: 'Salir del canal',
            onPressed: _voice.leaveRoom,
            icon: const Icon(Icons.arrow_back_rounded),
          ),
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                (channel?['topic'] ?? 'CHAT DE VOZ').toString(),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 2),
              Text(
                '#${channel?['category'] ?? 'general'}  ·  '
                '${_voice.participants.length + 1} participantes',
                style: Theme.of(context).textTheme.bodySmall
                    ?.copyWith(color: AppColors.textSecondary),
              ),
            ],
          ),
        ),
        body: SafeArea(
          child: Column(
            children: [
              if (_voice.error != null)
                Container(
                  width: double.infinity,
                  margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.bgSecondary,
                    border: Border.all(color: AppColors.accent, width: 2),
                    borderRadius: BorderRadius.zero,
                  ),
                  child: Text(
                    _voice.error!,
                    style: const TextStyle(
                      color: AppColors.accent,
                      fontSize: 12,
                    ),
                  ),
                ),
              if (MediaQuery.viewInsetsOf(context).bottom == 0)
                _buildScreenShares(),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
                child: Container(
                  decoration: WinBorders.panel(),
                  child: const TabBar(
                    tabs: [
                      Tab(
                        icon: Icon(Icons.chat_bubble_outline, size: 18),
                        text: 'CHAT DE TEXTO',
                      ),
                      Tab(
                        icon: Icon(Icons.people_outline, size: 18),
                        text: 'PARTICIPANTES',
                      ),
                    ],
                  ),
                ),
              ),
              Expanded(
                child: TabBarView(
                  children: [_buildChatTab(), _buildParticipantsTab()],
                ),
              ),
              _voiceControls(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildScreenShares() {
    final cards = <Widget>[];
    final localStream = _voice.localScreenStream;
    if (_voice.isSharingScreen && localStream != null) {
      cards.add(
        _screenCard(label: 'Tu pantalla', stream: localStream, isLocal: true),
      );
    }

    for (final participant in _voice.participants) {
      final stream = participant.stream;
      final isSharing =
          participant.isSharingScreen ||
          (stream?.getVideoTracks().isNotEmpty ?? false);
      if (!isSharing) continue;
      cards.add(_screenCard(label: participant.username, stream: stream));
    }
    if (cards.isEmpty) return const SizedBox.shrink();

    return SizedBox(
      height: 184,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
        scrollDirection: Axis.horizontal,
        children: cards,
      ),
    );
  }

  Widget _screenCard({
    required String label,
    required MediaStream? stream,
    bool isLocal = false,
  }) {
    return Container(
      width: MediaQuery.sizeOf(context).width * 0.78,
      margin: const EdgeInsets.only(right: 10),
      padding: const EdgeInsets.all(10),
      decoration: WinBorders.panel(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                isLocal ? Icons.screen_share_outlined : Icons.cast_connected,
                size: 16,
                color: AppColors.accent,
              ),
              const SizedBox(width: 7),
              Expanded(
                child: Text(
                  isLocal
                      ? 'Compartiendo · $label'
                      : '$label está compartiendo',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Expanded(
            child: stream != null && stream.getVideoTracks().isNotEmpty
                ? VoiceStreamPreview(
                    key: ValueKey(stream.id),
                    stream: stream,
                    height: 130,
                  )
                : Container(
                    width: double.infinity,
                    alignment: Alignment.center,
                    decoration: WinBorders.panel(color: AppColors.bg),
                    child: const Text(
                      'CONECTANDO VIDEO...',
                      style: TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 12,
                      ),
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildChatTab() {
    return Column(
      children: [
        Expanded(
          child: _voice.messages.isEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.forum_outlined,
                          color: AppColors.textSecondary,
                          size: 32,
                        ),
                        const SizedBox(height: 10),
                        Text(
                          'EL CHAT DE TEXTO ESTÁ AQUÍ',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'ENVÍA UN MENSAJE PARA INICIAR LA CONVERSACIÓN.',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                  ),
                )
              : ListView.builder(
                  controller: _chatController,
                  reverse: true,
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                  itemCount: _voice.messages.length,
                  itemBuilder: (context, index) {
                    final message =
                        _voice.messages[_voice.messages.length - 1 - index];
                    return _messageBubble(message);
                  },
                ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(14, 8, 14, 12),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _messageController,
                  maxLength: 200,
                  textInputAction: TextInputAction.send,
                  onSubmitted: (_) => _sendMessage(),
                  decoration: const InputDecoration(
                    hintText: 'ESCRIBE UN MENSAJE',
                    counterText: '',
                    isDense: true,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              IconButton(
                tooltip: 'Enviar mensaje',
                onPressed: _sendMessage,
                icon: const Icon(Icons.send_rounded),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _messageBubble(Map<String, dynamic> message) {
    final sender = (message['sender'] ?? 'Usuario').toString();
    final isMine = sender == _username;
    final content = message['content']?.toString() ?? '';

    return Align(
      alignment: isMine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: BoxConstraints(
          maxWidth: MediaQuery.sizeOf(context).width * 0.78,
        ),
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: isMine ? AppColors.bgPanel : AppColors.bgSecondary,
          border: Border.all(color: AppColors.winBorder),
          borderRadius: BorderRadius.zero,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              isMine ? 'TÚ' : sender,
              style: const TextStyle(
                color: AppColors.accent,
                fontSize: 11,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 3),
            Text(
              content,
              style: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 13,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildParticipantsTab() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
      children: [
        _participantTile(
          username: '$_username (tú)',
          icon: _voice.isMuted ? Icons.mic_off_outlined : Icons.mic_none,
          subtitle: _voice.microphoneUnavailable
              ? 'SIN MICRÓFONO · SOLO ESCUCHA'
              : _voice.isMuted
              ? 'MICRÓFONO SILENCIADO'
              : 'MICRÓFONO ACTIVO',
          color: _voice.isMuted ? AppColors.textSecondary : AppColors.accent,
        ),
        for (final participant in _voice.participants) ...[
          _participantTile(
            username: participant.username,
            icon: participant.isMuted
                ? Icons.mic_off_outlined
                : Icons.person_outline,
            subtitle: participant.isSharingScreen
                ? 'COMPARTIENDO PANTALLA'
                : 'EN EL CANAL',
            color: participant.isMuted
                ? AppColors.textSecondary
                : AppColors.accent,
          ),
          if (participant.stream != null &&
              participant.stream!.getAudioTracks().isNotEmpty &&
              participant.stream!.getVideoTracks().isEmpty)
            VoiceStreamPreview(
              key: ValueKey('audio-${participant.stream!.id}'),
              stream: participant.stream!,
              showVideo: false,
              height: 1,
            ),
        ],
      ],
    );
  }

  Widget _participantTile({
    required String username,
    required IconData icon,
    required String subtitle,
    required Color color,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: WinBorders.panel(),
      child: ListTile(
        leading: Icon(icon, color: color, size: 20),
        title: Text(username, maxLines: 1, overflow: TextOverflow.ellipsis),
        subtitle: Text(subtitle),
      ),
    );
  }

  Widget _voiceControls() {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
      decoration: const BoxDecoration(
        color: AppColors.bgSecondary,
        border: Border(top: BorderSide(color: AppColors.winBorder)),
      ),
      child: Row(
        children: [
          Expanded(
            child: _controlButton(
              icon: _voice.isMuted ? Icons.mic_off_rounded : Icons.mic_rounded,
              label: _voice.isMuted ? 'ACTIVAR MIC' : 'SILENCIAR',
              onPressed: _voice.toggleMute,
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: _controlButton(
              icon: _voice.isSharingScreen
                  ? Icons.stop_screen_share
                  : Icons.screen_share_outlined,
              label: _voice.isSharingScreen
                  ? 'DETENER PANTALLA'
                  : 'COMPARTIR PANTALLA',
              onPressed: _toggleScreenShare,
            ),
          ),
          const SizedBox(width: 8),
          _controlButton(
            icon: Icons.call_end_rounded,
            label: 'SALIR',
            onPressed: _voice.leaveRoom,
            isDestructive: true,
          ),
        ],
      ),
    );
  }

  Widget _controlButton({
    required IconData icon,
    required String label,
    required VoidCallback onPressed,
    bool isDestructive = false,
  }) {
    final color = isDestructive
        ? const Color(0xFFFF5555)
        : AppColors.accent;
    return Material(
      color: isDestructive ? AppColors.bgPanel : AppColors.bgSecondary,
      borderRadius: BorderRadius.zero,
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.zero,
        child: Container(
          height: 58,
          decoration: BoxDecoration(
            border: Border.all(
              color: isDestructive ? const Color(0xFFFF5555) : AppColors.winBorder,
              width: 2,
            ),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 20, color: color),
              const SizedBox(height: 3),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: color,
                  fontSize: 9,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class VoiceStreamPreview extends StatefulWidget {
  final MediaStream stream;
  final bool showVideo;
  final double height;

  const VoiceStreamPreview({
    super.key,
    required this.stream,
    this.showVideo = true,
    this.height = 180,
  });

  @override
  State<VoiceStreamPreview> createState() => _VoiceStreamPreviewState();
}

class _VoiceStreamPreviewState extends State<VoiceStreamPreview> {
  final RTCVideoRenderer _renderer = RTCVideoRenderer();
  bool _initialized = false;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _initialize();
  }

  Future<void> _initialize() async {
    try {
      await _renderer.initialize();
      _renderer.srcObject = widget.stream;
      if (mounted) setState(() => _initialized = true);
    } catch (_) {
      if (mounted) setState(() => _failed = true);
    }
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
    if (!widget.showVideo) {
      return SizedBox(
        width: 1,
        height: 1,
        child: _initialized ? RTCVideoView(_renderer) : null,
      );
    }
    if (_failed) {
      return SizedBox(
        height: widget.height,
        child: const Center(
          child: Text(
            'No se pudo mostrar el video',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
          ),
        ),
      );
    }
    if (!_initialized) {
      return SizedBox(
        height: widget.height,
        child: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
      );
    }
    return SizedBox(
      height: widget.height,
      width: double.infinity,
      child: ClipRRect(
        borderRadius: BorderRadius.zero,
        child: RTCVideoView(
          _renderer,
          objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitContain,
        ),
      ),
    );
  }
}
