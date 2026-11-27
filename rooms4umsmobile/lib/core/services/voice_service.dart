import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_background/flutter_background.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import 'package:rooms4ums_mobile/core/services/wear_service.dart';

class VoiceParticipant {
  final String id;
  final String username;
  final bool isMuted;
  final bool isSharingScreen;
  final MediaStream? stream;

  const VoiceParticipant({
    required this.id,
    required this.username,
    this.isMuted = false,
    this.isSharingScreen = false,
    this.stream,
  });

  VoiceParticipant copyWith({
    String? username,
    bool? isMuted,
    bool? isSharingScreen,
    MediaStream? stream,
    bool clearStream = false,
  }) {
    return VoiceParticipant(
      id: id,
      username: username ?? this.username,
      isMuted: isMuted ?? this.isMuted,
      isSharingScreen: isSharingScreen ?? this.isSharingScreen,
      stream: clearStream ? null : stream ?? this.stream,
    );
  }
}

class VoiceService extends ChangeNotifier {
  VoiceService._();

  static final VoiceService instance = VoiceService._();

  static const String _serverUrl = 'https://rooms4ums.onrender.com';
  static const Map<String, dynamic> _rtcConfiguration = {
    'iceServers': [
      {'urls': 'stun:stun.l.google.com:19302'},
      {'urls': 'stun:stun1.l.google.com:19302'},
    ],
  };

  io.Socket? _socket;
  Completer<void>? _connectCompleter;
  final Map<String, RTCPeerConnection> _peerConnections = {};
  final Map<String, MediaStream> _remoteStreams = {};
  final Map<String, List<RTCIceCandidate>> _pendingCandidates = {};
  final List<Map<String, dynamic>> channels = [];
  final List<VoiceParticipant> participants = [];
  final List<Map<String, dynamic>> messages = [];

  MediaStream? localAudioStream;
  MediaStream? localScreenStream;
  String? activeRoomId;
  String? error;
  bool isConnected = false;
  bool isMuted = false;
  bool isSharingScreen = false;
  bool microphoneUnavailable = false;
  bool _backgroundExecutionEnabled = false;
  bool _isStoppingScreenShare = false;
  Timer? _wearCallBridgeTimer;
  bool _readingWearCallActions = false;
  bool _wearCallErrorLogged = false;
  int _wearCallStatusTicks = 0;
  String _activeWearCallId = '';
  String _callUsername = '';

  void _startWearCallBridge(String username) {
    if (defaultTargetPlatform != TargetPlatform.android) return;
    _wearCallBridgeTimer?.cancel();
    _activeWearCallId = DateTime.now().microsecondsSinceEpoch.toString();
    _callUsername = username;
    _wearCallErrorLogged = false;
    _wearCallStatusTicks = 0;
    unawaited(_publishWearCallStatus());
    _wearCallBridgeTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (activeRoomId == null) return;
      _wearCallStatusTicks++;
      if (_wearCallStatusTicks.isEven) unawaited(_publishWearCallStatus());
      unawaited(_processWearCallActions());
    });
  }

  Future<void> _publishWearCallStatus() async {
    final roomId = activeRoomId;
    final channel = channels.cast<Map<String, dynamic>?>().firstWhere(
      (item) => item?['id'] == roomId,
      orElse: () => null,
    );
    try {
      final result = await WearService.sendCallStatus(
        active: roomId != null,
        muted: isMuted,
        callId: _activeWearCallId,
        room: (channel?['topic'] ?? 'Canal de voz').toString(),
        username: _callUsername,
      );
      if (result.ok) {
        _wearCallErrorLogged = false;
      } else if (!_wearCallErrorLogged) {
        debugPrint('[WEAR] No se pudo actualizar el estado de llamada: ${result.message}');
        _wearCallErrorLogged = true;
      }
    } catch (error, stackTrace) {
      debugPrint('[WEAR] Error al actualizar el estado de llamada: $error');
      debugPrintStack(stackTrace: stackTrace);
    }
  }

  Future<void> _processWearCallActions() async {
    if (_readingWearCallActions || activeRoomId == null) return;
    _readingWearCallActions = true;
    try {
      final actions = await WearService.takeCallActions();
      for (final action in actions) {
        if (activeRoomId == null) break;
        if (action.callId != _activeWearCallId) continue;

        switch (action.action) {
          case WearService.actionToggleMute:
            await toggleMute();
            break;
          case WearService.actionHangUp:
            await leaveRoom();
            return;
          default:
            debugPrint('[WEAR] Acción de llamada desconocida: ${action.action}');
        }
      }
    } catch (error, stackTrace) {
      debugPrint('[WEAR] Error al procesar controles del reloj: $error');
      debugPrintStack(stackTrace: stackTrace);
    } finally {
      _readingWearCallActions = false;
    }
  }

  Future<void> _ensureConnected() async {
    if (_socket?.connected == true) {
      isConnected = true;
      return;
    }

    if (_connectCompleter == null || _connectCompleter!.isCompleted) {
      _connectCompleter = Completer<void>();
    }
    if (_socket == null) {
      _socket = io.io(
        _serverUrl,
        io.OptionBuilder()
            .setTransports(['websocket'])
            .disableAutoConnect()
            .build(),
      );
      _registerSocketListeners(_socket!);
    }
    _socket!.connect();

    try {
      await _connectCompleter!.future.timeout(const Duration(seconds: 20));
      error = null;
    } on TimeoutException {
      error = 'No se pudo conectar al servicio de voz.';
      notifyListeners();
      rethrow;
    }
  }

  void _registerSocketListeners(io.Socket socket) {
    socket.onConnect((_) {
      isConnected = true;
      if (_connectCompleter != null && !_connectCompleter!.isCompleted) {
        _connectCompleter!.complete();
      }
      error = null;
      notifyListeners();
    });
    socket.onConnectError((_) {
      isConnected = false;
      if (_connectCompleter != null && !_connectCompleter!.isCompleted) {
        _connectCompleter!.completeError(
          StateError('No se pudo conectar al servicio de voz.'),
        );
      }
      error = 'No se pudo conectar al servicio de voz.';
      notifyListeners();
    });
    socket.onDisconnect((_) {
      isConnected = false;
      notifyListeners();
    });
    socket.on('user-joined', (dynamic data) {
      if (data is Map) {
        _upsertParticipant(
          data['id']?.toString() ?? '',
          data['username']?.toString() ?? 'Usuario',
        );
      }
    });
    socket.on('user-left', (dynamic id) {
      _removeParticipant(id.toString());
    });
    socket.on('user-mute-toggled', (dynamic data) {
      if (data is Map) {
        _updateParticipant(data['id']?.toString() ?? '', (user) {
          return user.copyWith(isMuted: data['isMuted'] == true);
        });
      }
    });
    socket.on('user-video-toggled', (dynamic data) {
      if (data is Map) {
        final id = data['id']?.toString() ?? '';
        final isSharing = data['isSharing'] == true;
        if (isSharing) {
          _updateParticipant(
            id,
            (user) => user.copyWith(isSharingScreen: true),
          );
        } else {
          _removeRemoteVideoTracks(id).catchError((Object cause) {
            error = 'No se pudo actualizar la pantalla compartida.';
            notifyListeners();
          });
        }
      }
    });
    socket.on('new-voice-message', (dynamic data) {
      if (data is Map) {
        messages.add(Map<String, dynamic>.from(data));
        notifyListeners();
      }
    });
    socket.on('voice-channel-created', (dynamic data) {
      if (data is Map) _upsertChannel(Map<String, dynamic>.from(data));
    });
    socket.on('voice-channel-updated', (dynamic data) {
      if (data is Map) {
        final id = data['id']?.toString();
        final index = channels.indexWhere((channel) => channel['id'] == id);
        if (index >= 0) {
          channels[index] = {
            ...channels[index],
            'userCount': data['userCount'],
          };
          notifyListeners();
        }
      }
    });
    socket.on('voice-channel-deleted', (dynamic id) {
      channels.removeWhere((channel) => channel['id'] == id.toString());
      notifyListeners();
    });
    socket.on('signal', (dynamic data) {
      _handleSignal(data).catchError((Object cause) {
        error = 'No se pudo establecer la conexión de voz.';
        notifyListeners();
      });
    });
  }

  Future<dynamic> _emitWithAck(String event, Object data) async {
    final completer = Completer<dynamic>();
    _socket!.emitWithAck(
      event,
      data,
      ack: (dynamic response) {
        if (!completer.isCompleted) completer.complete(response);
      },
    );
    return completer.future.timeout(const Duration(seconds: 20));
  }

  Future<void> loadChannels() async {
    await _ensureConnected();
    final response = await _emitWithAck(
      'get-voice-channels',
      <String, dynamic>{},
    );
    if (response is! List) {
      throw StateError('El servidor devolvió una lista de canales inválida.');
    }
    channels
      ..clear()
      ..addAll(
        response.whereType<Map>().map(
          (channel) => Map<String, dynamic>.from(channel),
        ),
      );
    notifyListeners();
  }

  Future<String> createChannel({
    required String category,
    required String topic,
    required String username,
  }) async {
    await _ensureConnected();
    final response = await _emitWithAck('create-voice-channel', {
      'category': category,
      'topic': topic,
      'username': username,
    });
    if (response is! Map || response['channelId'] == null) {
      throw StateError('No se pudo crear el canal de voz.');
    }
    return response['channelId'].toString();
  }

  Future<void> joinRoom(String roomId, String username) async {
    if (activeRoomId != null) await leaveRoom();
    await _ensureConnected();
    error = null;
    notifyListeners();

    try {
      microphoneUnavailable = false;
      error = null;
      try {
        localAudioStream = await navigator.mediaDevices.getUserMedia({
          'audio': true,
          'video': false,
        });
        if (localAudioStream!.getAudioTracks().isEmpty) {
          await localAudioStream!.dispose();
          localAudioStream = null;
          microphoneUnavailable = true;
        }
      } on PlatformException {
        microphoneUnavailable = true;
        localAudioStream = null;
      }

      final response = await _emitWithAck('join-room', {
        'roomId': roomId,
        'username': username,
      });
      if (response is! Map || response['error'] != null) {
        throw StateError('El canal ya no está disponible.');
      }

      activeRoomId = roomId;
      isMuted = microphoneUnavailable;
      if (microphoneUnavailable) {
        error = 'MICRÓFONO NO DISPONIBLE; TE UNISTE EN MODO SOLO ESCUCHA.';
        _socket?.emit('toggle-mute', {'roomId': roomId, 'isMuted': true});
      }
      messages.clear();
      final users = response['users'];
      if (users is List) {
        for (final user in users.whereType<Map>()) {
          final id = user['id']?.toString() ?? '';
          final name = user['username']?.toString() ?? 'Usuario';
          if (id.isEmpty) continue;
          _upsertParticipant(id, name);
          await _callParticipant(id);
        }
      }
      _startWearCallBridge(username);
      notifyListeners();
    } catch (cause) {
      _socket?.emit('leave-room');
      activeRoomId = null;
      for (final peer in _peerConnections.values) {
        await peer.close();
        await peer.dispose();
      }
      _peerConnections.clear();
      _pendingCandidates.clear();
      await _disposeRemoteStreams();
      await _disposeLocalMedia();
      participants.clear();
      messages.clear();
      microphoneUnavailable = false;
      error = cause is StateError
          ? cause.message.toString()
          : 'No se pudo entrar al canal de voz.';
      notifyListeners();
      rethrow;
    }
  }

  Future<void> _callParticipant(String id) async {
    final peer = await _createPeerConnection(id);
    final audio = localAudioStream;
    if (audio != null) {
      for (final track in audio.getAudioTracks()) {
        await peer.addTrack(track, audio);
      }
    } else {
      await peer.addTransceiver(
        kind: RTCRtpMediaType.RTCRtpMediaTypeAudio,
        init: RTCRtpTransceiverInit(direction: TransceiverDirection.RecvOnly),
      );
    }
    final screen = localScreenStream;
    if (screen != null) {
      for (final track in screen.getVideoTracks()) {
        await peer.addTrack(track, screen);
      }
    }
  }

  Future<RTCPeerConnection> _createPeerConnection(String id) async {
    final existing = _peerConnections[id];
    if (existing != null) return existing;

    final peer = await createPeerConnection(_rtcConfiguration);
    _peerConnections[id] = peer;
    peer.onIceCandidate = (candidate) {
      if (candidate.candidate != null) {
        _socket?.emit('signal', {
          'to': id,
          'signal': {
            'type': 'candidate',
            'candidate': {
              'candidate': candidate.candidate,
              'sdpMid': candidate.sdpMid,
              'sdpMLineIndex': candidate.sdpMLineIndex,
            },
          },
        });
      }
    };
    peer.onRenegotiationNeeded = () {
      _negotiate(id, peer).catchError((Object cause) {
        error = 'No se pudo negociar la conexión de voz.';
        notifyListeners();
      });
    };
    peer.onTrack = (event) {
      _attachRemoteTrack(id, event.track).catchError((Object cause) {
        error = 'No se pudo mostrar el audio o la pantalla compartida.';
        notifyListeners();
      });
    };
    return peer;
  }

  Future<void> _attachRemoteTrack(String id, MediaStreamTrack track) async {
    if (!_peerConnections.containsKey(id)) return;
    if (!participants.any((participant) => participant.id == id)) {
      _upsertParticipant(id, 'Participante');
    }

    var stream = _remoteStreams[id];
    if (stream == null) {
      stream = await createLocalMediaStream('remote-$id');
      _remoteStreams[id] = stream;
    }

    if (!stream.getTracks().any((existing) => existing.id == track.id)) {
      await stream.addTrack(track);
    }
    track.onEnded = () => unawaited(_removeRemoteTrack(id, track));

    _updateParticipant(id, (participant) {
      return participant.copyWith(
        stream: stream,
        isSharingScreen: stream!.getVideoTracks().isNotEmpty,
      );
    });
  }

  Future<void> _removeRemoteVideoTracks(String id) async {
    final stream = _remoteStreams[id];
    if (stream == null) {
      _updateParticipant(
        id,
        (participant) => participant.copyWith(isSharingScreen: false),
      );
      return;
    }

    for (final track in List<MediaStreamTrack>.from(stream.getVideoTracks())) {
      await stream.removeTrack(track);
    }
    _updateParticipant(id, (participant) {
      return participant.copyWith(
        stream: stream,
        isSharingScreen: stream.getVideoTracks().isNotEmpty,
      );
    });
  }

  Future<void> _removeRemoteTrack(String id, MediaStreamTrack track) async {
    final stream = _remoteStreams[id];
    if (stream == null ||
        !stream.getTracks().any((item) => item.id == track.id)) {
      return;
    }

    await stream.removeTrack(track);
    if (stream.getTracks().isEmpty) {
      _remoteStreams.remove(id);
      await stream.dispose();
      _updateParticipant(
        id,
        (participant) =>
            participant.copyWith(clearStream: true, isSharingScreen: false),
      );
      return;
    }

    _updateParticipant(id, (participant) {
      return participant.copyWith(
        stream: stream,
        isSharingScreen: stream.getVideoTracks().isNotEmpty,
      );
    });
  }

  Future<void> _negotiate(String id, RTCPeerConnection peer) async {
    if (peer.signalingState != RTCSignalingState.RTCSignalingStateStable) {
      return;
    }
    final offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    _socket?.emit('signal', {
      'to': id,
      'signal': {'type': offer.type, 'sdp': offer.sdp},
    });
  }

  Future<void> _handleSignal(dynamic data) async {
    if (data is! Map || data['signal'] is! Map) return;
    final from = data['from']?.toString() ?? '';
    final signal = Map<String, dynamic>.from(data['signal'] as Map);
    if (from.isEmpty) return;

    var peer = _peerConnections[from];
    final type = signal['type']?.toString();
    if (type == 'offer') {
      peer ??= await _createPeerConnection(from);
      await peer.setRemoteDescription(
        RTCSessionDescription(signal['sdp']?.toString(), type),
      );
      await _addLocalTracks(peer);
      await _flushCandidates(from, peer);
      final answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      _socket?.emit('signal', {
        'to': from,
        'signal': {'type': answer.type, 'sdp': answer.sdp},
      });
    } else if (type == 'answer' && peer != null) {
      await peer.setRemoteDescription(
        RTCSessionDescription(signal['sdp']?.toString(), type),
      );
      await _flushCandidates(from, peer);
    } else if (type == 'candidate') {
      final candidateData = signal['candidate'];
      if (candidateData is! Map) return;
      final candidate = RTCIceCandidate(
        candidateData['candidate']?.toString(),
        candidateData['sdpMid']?.toString(),
        (candidateData['sdpMLineIndex'] as num?)?.toInt(),
      );
      if (peer == null || await peer.getRemoteDescription() == null) {
        _pendingCandidates.putIfAbsent(from, () => []).add(candidate);
      } else {
        await peer.addCandidate(candidate);
      }
    }
  }

  Future<void> _addLocalTracks(RTCPeerConnection peer) async {
    final senders = await peer.getSenders();
    final audio = localAudioStream;
    if (audio != null) {
      for (final track in audio.getAudioTracks()) {
        if (!senders.any((sender) => sender.track?.id == track.id)) {
          await peer.addTrack(track, audio);
        }
      }
    }
    final screen = localScreenStream;
    if (screen != null) {
      for (final track in screen.getVideoTracks()) {
        if (!senders.any((sender) => sender.track?.id == track.id)) {
          await peer.addTrack(track, screen);
        }
      }
    }
  }

  Future<void> _flushCandidates(String id, RTCPeerConnection peer) async {
    final queued = _pendingCandidates.remove(id) ?? [];
    for (final candidate in queued) {
      await peer.addCandidate(candidate);
    }
  }

  Future<void> toggleMute() async {
    final roomId = activeRoomId;
    if (roomId == null) return;

    if (localAudioStream == null) {
      try {
        final stream = await navigator.mediaDevices.getUserMedia({
          'audio': true,
          'video': false,
        });
        if (stream.getAudioTracks().isEmpty) {
          await stream.dispose();
          microphoneUnavailable = true;
          error = 'NO SE ENCONTRÓ UN MICRÓFONO DISPONIBLE.';
          notifyListeners();
          return;
        }
        localAudioStream = stream;
        microphoneUnavailable = false;
        isMuted = false;
        for (final peer in _peerConnections.values) {
          for (final track in stream.getAudioTracks()) {
            await peer.addTrack(track, stream);
          }
        }
        _socket?.emit('toggle-mute', {'roomId': roomId, 'isMuted': false});
        error = null;
        notifyListeners();
        unawaited(_publishWearCallStatus());
        return;
      } on PlatformException {
        microphoneUnavailable = true;
        error = 'NO SE PUDO ACTIVAR EL MICRÓFONO. SIGUES EN MODO SOLO ESCUCHA.';
        notifyListeners();
        return;
      }
    }

    isMuted = !isMuted;
    for (final track
        in localAudioStream?.getAudioTracks() ?? <MediaStreamTrack>[]) {
      track.enabled = !isMuted;
    }
    _socket?.emit('toggle-mute', {'roomId': roomId, 'isMuted': isMuted});
    notifyListeners();
    unawaited(_publishWearCallStatus());
  }

  Future<void> toggleScreenShare() async {
    final roomId = activeRoomId;
    if (roomId == null) return;
    if (isSharingScreen) {
      await _stopScreenShare(roomId);
      return;
    }

    try {
      if (defaultTargetPlatform == TargetPlatform.iOS) {
        throw UnsupportedError(
          'En iOS se requiere configurar una extensión Broadcast Upload para compartir pantalla.',
        );
      }
      await _enableAndroidScreenCapture();
      final stream = await navigator.mediaDevices.getDisplayMedia({
        'video': true,
        'audio': false,
      });
      if (stream.getVideoTracks().isEmpty) {
        await stream.dispose();
        throw StateError('El sistema no devolvió una captura de pantalla.');
      }
      localScreenStream = stream;
      isSharingScreen = true;
      final track = stream.getVideoTracks().first;
      track.onEnded = () {
        if (!_isStoppingScreenShare) unawaited(_stopScreenShare(roomId));
      };
      for (final peer in _peerConnections.values) {
        await peer.addTrack(track, stream);
      }
      _socket?.emit('toggle-video', {'roomId': roomId, 'isSharing': true});
      error = null;
      notifyListeners();
    } catch (cause) {
      final failedStream = localScreenStream;
      localScreenStream = null;
      isSharingScreen = false;
      for (final peer in _peerConnections.values) {
        final senders = await peer.getSenders();
        for (final sender in senders.where(
          (sender) => sender.track?.kind == 'video',
        )) {
          await peer.removeTrack(sender);
        }
      }
      for (final track in failedStream?.getTracks() ?? <MediaStreamTrack>[]) {
        await track.stop();
      }
      await failedStream?.dispose();
      await _disableAndroidScreenCapture();
      if (cause is UnsupportedError) {
        error = cause.message.toString();
      } else if (cause is StateError) {
        error = cause.message.toString();
      } else {
        error =
            'No se pudo compartir la pantalla. Revisa el permiso del sistema.';
      }
      notifyListeners();
      rethrow;
    }
  }

  Future<void> _enableAndroidScreenCapture() async {
    if (defaultTargetPlatform != TargetPlatform.android ||
        _backgroundExecutionEnabled) {
      return;
    }

    const config = FlutterBackgroundAndroidConfig(
      notificationTitle: 'Rooms4ums comparte tu pantalla',
      notificationText: 'La pantalla se transmite en tu canal de voz.',
      notificationImportance: AndroidNotificationImportance.normal,
      notificationIcon: AndroidResource(name: 'ic_launcher', defType: 'mipmap'),
    );
    if (!await FlutterBackground.initialize(androidConfig: config)) {
      throw StateError(
        'Se requieren permisos de notificación para compartir la pantalla.',
      );
    }
    if (!await FlutterBackground.enableBackgroundExecution()) {
      await FlutterBackground.disableBackgroundExecution();
      throw StateError(
        'Android no pudo iniciar el servicio de captura de pantalla.',
      );
    }
    _backgroundExecutionEnabled = true;
  }

  Future<void> _disableAndroidScreenCapture() async {
    if (!_backgroundExecutionEnabled) return;
    final disabled = await FlutterBackground.disableBackgroundExecution();
    _backgroundExecutionEnabled = false;
    if (!disabled) {
      throw StateError(
        'Android no pudo detener el servicio de captura de pantalla.',
      );
    }
  }

  Future<void> _stopScreenShare(String roomId) async {
    if (_isStoppingScreenShare) return;
    _isStoppingScreenShare = true;
    try {
      final stream = localScreenStream;
      localScreenStream = null;
      isSharingScreen = false;
      for (final peer in _peerConnections.values) {
        final senders = await peer.getSenders();
        for (final sender in senders.where(
          (sender) => sender.track?.kind == 'video',
        )) {
          await peer.removeTrack(sender);
        }
      }
      for (final track in stream?.getTracks() ?? <MediaStreamTrack>[]) {
        await track.stop();
      }
      await stream?.dispose();
      _socket?.emit('toggle-video', {'roomId': roomId, 'isSharing': false});
      notifyListeners();
      await _disableAndroidScreenCapture();
    } finally {
      _isStoppingScreenShare = false;
    }
  }

  Future<void> sendMessage(String content) async {
    final roomId = activeRoomId;
    final cleanContent = content.trim();
    if (roomId == null || cleanContent.isEmpty) return;
    final response = await _emitWithAck('send-voice-message', {
      'roomId': roomId,
      'content': cleanContent,
    });
    if (response is! Map || response['status'] != 'OK') {
      throw StateError('No se pudo enviar el mensaje de voz.');
    }
  }

  Future<void> leaveRoom() async {
    final roomId = activeRoomId;
    _wearCallBridgeTimer?.cancel();
    _wearCallBridgeTimer = null;
    if (roomId != null) _socket?.emit('leave-room');
    activeRoomId = null;
    if (isSharingScreen && roomId != null) {
      await _stopScreenShare(roomId);
    }
    for (final peer in _peerConnections.values) {
      await peer.close();
      await peer.dispose();
    }
    _peerConnections.clear();
    _pendingCandidates.clear();
    await _disposeRemoteStreams();
    await _disposeLocalMedia();
    participants.clear();
    messages.clear();
    isMuted = false;
    microphoneUnavailable = false;
    await _disableAndroidScreenCapture();
    notifyListeners();
    if (roomId != null) {
      await _publishWearCallStatus();
      _activeWearCallId = '';
      _callUsername = '';
    }
  }

  Future<void> _disposeLocalMedia() async {
    for (final track in localAudioStream?.getTracks() ?? <MediaStreamTrack>[]) {
      await track.stop();
    }
    await localAudioStream?.dispose();
    localAudioStream = null;
    final screen = localScreenStream;
    localScreenStream = null;
    isSharingScreen = false;
    for (final track in screen?.getTracks() ?? <MediaStreamTrack>[]) {
      await track.stop();
    }
    await screen?.dispose();
  }

  void _upsertParticipant(String id, String username) {
    if (id.isEmpty) return;
    final index = participants.indexWhere(
      (participant) => participant.id == id,
    );
    if (index == -1) {
      participants.add(VoiceParticipant(id: id, username: username));
    } else {
      participants[index] = participants[index].copyWith(username: username);
    }
    notifyListeners();
  }

  void _updateParticipant(
    String id,
    VoiceParticipant Function(VoiceParticipant participant) update,
  ) {
    final index = participants.indexWhere(
      (participant) => participant.id == id,
    );
    if (index < 0) return;
    participants[index] = update(participants[index]);
    notifyListeners();
  }

  void _removeParticipant(String id) {
    final peer = _peerConnections.remove(id);
    if (peer != null) {
      unawaited(_disposePeer(peer));
    }
    final stream = _remoteStreams.remove(id);
    if (stream != null) unawaited(stream.dispose());
    _pendingCandidates.remove(id);
    participants.removeWhere((participant) => participant.id == id);
    notifyListeners();
  }

  Future<void> _disposeRemoteStreams() async {
    final streams = _remoteStreams.values.toList();
    _remoteStreams.clear();
    for (final stream in streams) {
      await stream.dispose();
    }
  }

  Future<void> _disposePeer(RTCPeerConnection peer) async {
    await peer.close();
    await peer.dispose();
  }

  void _upsertChannel(Map<String, dynamic> channel) {
    final id = channel['id']?.toString();
    if (id == null) return;
    final index = channels.indexWhere((item) => item['id'] == id);
    if (index < 0) {
      channels.add(channel);
    } else {
      channels[index] = {...channels[index], ...channel};
    }
    notifyListeners();
  }
}
