import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject } from 'rxjs';

export function isRecoverableMicrophoneError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return [
    'NotFoundError',
    'DevicesNotFoundError',
    'NotAllowedError',
    'PermissionDeniedError',
    'NotReadableError',
    'OverconstrainedError'
  ].includes(error.name);
}

export interface VoiceUser {
  id: string;
  username: string;
  stream?: MediaStream;
  isMuted?: boolean;
  isSpeaking?: boolean;
  isSharingVideo?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class VoiceService {
  private platformId = inject(PLATFORM_ID);
  private socket!: Socket;
  private localStream: MediaStream | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private remoteStreams: Map<string, MediaStream> = new Map();
  private pendingIceCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
  private negotiatingPeers = new WeakSet<RTCPeerConnection>();
  
  private _users = new BehaviorSubject<VoiceUser[]>([]);
  users$ = this._users.asObservable();

  private _channels = new BehaviorSubject<any[]>([]);
  channels$ = this._channels.asObservable();

  private iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]
  };

  private _messages = new BehaviorSubject<any[]>([]);
  messages$ = this._messages.asObservable();

  private _localScreenStream = new BehaviorSubject<MediaStream | null>(null);
  localScreenStream$ = this._localScreenStream.asObservable();

  private screenStream: MediaStream | null = null;
  private isSharingScreen = false;
  microphoneAvailable = true;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      // Forzamos el uso del backend en Render
      const backendUrl = 'https://rooms4ums.onrender.com';

      console.log('[VOICE] Connecting to:', backendUrl);
      this.socket = io(backendUrl, {
        transports: ['websocket'],
        upgrade: false
      });
      this.setupSocketListeners();
    }
  }
  private setupSocketListeners() {
    this.socket.on('connect', () => console.log('[VOICE] Socket connected:', this.socket.id));

    this.socket.on('user-joined', (user: { id: string; username: string }) => {
      this.addUserToList(user.id, user.username);
      if (this.shouldInitiate(user.id)) {
        this.callUser(user.id, user.username).catch(error =>
          console.error('[VOICE] Could not start peer connection:', error)
        );
      }
    });

    this.socket.on('signal', async (data: { from: string; signal: any }) => {
      try {
        await this.handleSignal(data.from, data.signal);
      } catch (error) {
        console.error('[VOICE] Signaling failed:', error);
      }
    });

    this.socket.on('user-left', (userId: string) => {
      this.removeUser(userId);
      this.pendingIceCandidates.delete(userId);
    });

    this.socket.on('user-mute-toggled', (data: { id: string; isMuted: boolean }) => {
      this.updateUserInList(data.id, { isMuted: data.isMuted });
    });

    this.socket.on('user-video-toggled', (data: { id: string; isSharing: boolean }) => {
      if (data.isSharing) {
        this.updateUserInList(data.id, { isSharingVideo: true });
      } else {
        this.removeRemoteVideoTracks(data.id);
      }
    });

    this.socket.on('new-voice-message', (msg: any) => {
      this._messages.next([...this._messages.value, msg]);
    });

    this.socket.on('voice-channel-created', (channel: any) => {
      this._channels.next([...this._channels.value, channel]);
    });

    this.socket.on('voice-channel-updated', (data: { id: string; userCount: number }) => {
      const updated = this._channels.value.map(c => 
        c.id === data.id ? { ...c, userCount: data.userCount } : c
      );
      this._channels.next(updated);
    });

    this.socket.on('voice-channel-deleted', (channelId: string) => {
      this._channels.next(this._channels.value.filter(c => c.id !== channelId));
    });
  }

  async getChannels(): Promise<any[]> {
    return new Promise((resolve) => {
      if (!this.socket) return resolve([]);
      this.socket.emit('get-voice-channels', {}, (channels: any[]) => {
        this._channels.next(channels);
        resolve(channels);
      });
    });
  }

  async createChannel(category: string, topic: string, username: string): Promise<string> {
    return new Promise((resolve) => {
      if (!this.socket) return resolve('');
      this.socket.emit('create-voice-channel', { category, topic, username }, (res: any) => {
        resolve(res.channelId);
      });
    });
  }

  async joinRoom(roomId: string, username: string): Promise<boolean> {
    if (!isPlatformBrowser(this.platformId)) return false;

    try {
      this.microphoneAvailable = true;
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (this.localStream.getAudioTracks().length === 0) {
          this.localStream.getTracks().forEach(track => track.stop());
          this.localStream = null;
          this.microphoneAvailable = false;
        }
      } catch (error) {
        if (!isRecoverableMicrophoneError(error)) throw error;
        this.localStream = null;
        this.microphoneAvailable = false;
        console.warn('[VOICE] Joining in listen-only mode: no usable microphone.', error);
      }

      const response: any = await new Promise((resolve) => {
        this.socket.emit('join-room', { roomId, username }, (res: any) => resolve(res));
      });

      if (response?.error) {
        throw new Error(response.error === 'CHANNEL_NOT_FOUND'
          ? 'Este canal de voz ya no está disponible.'
          : 'Este canal de voz expiró.');
      }
      if (!this.microphoneAvailable) {
        this.socket.emit('toggle-mute', { roomId, isMuted: true });
      }

      if (response && response.users) {
        for (const user of response.users) {
          this.addUserToList(user.id, user.username);
          if (this.shouldInitiate(user.id)) {
            await this.callUser(user.id, user.username);
          }
        }
      }
      return this.microphoneAvailable;
    } catch (error) {
      this.localStream?.getTracks().forEach(track => track.stop());
      this.localStream = null;
      this.microphoneAvailable = true;
      console.error('[VOICE] Error joining room:', error);
      throw error;
    }
  }

  async enableMicrophone(roomId: string): Promise<void> {
    if (this.localStream) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (stream.getAudioTracks().length === 0) {
      stream.getTracks().forEach(track => track.stop());
      throw new Error('No se encontró un micrófono disponible.');
    }

    this.localStream = stream;
    this.microphoneAvailable = true;
    for (const pc of this.peerConnections.values()) {
      const audioTransceiver = this.getTransceiver(pc, 'audio');
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTransceiver && audioTrack) {
        await audioTransceiver.sender.replaceTrack(audioTrack);
      }
    }
    this.toggleMute(roomId, false);
  }

  private async callUser(userId: string, username: string) {
    if (this.peerConnections.has(userId)) return;
    const pc = this.createPeerConnection(userId, username);
    this.negotiatingPeers.add(pc);
    try {
      const audioTransceiver = pc.addTransceiver('audio', { direction: 'sendrecv' });
      const videoTransceiver = pc.addTransceiver('video', { direction: 'sendrecv' });
      const audioTrack = this.localStream?.getAudioTracks()[0];
      const videoTrack = this.screenStream?.getVideoTracks()[0];

      if (audioTrack) await audioTransceiver.sender.replaceTrack(audioTrack);
      if (this.isSharingScreen && videoTrack) {
        await videoTransceiver.sender.replaceTrack(videoTrack);
      }

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.socket.emit('signal', {
        to: userId,
        signal: { type: 'offer', sdp: offer.sdp }
      });
    } finally {
      this.negotiatingPeers.delete(pc);
    }
  }

  private createPeerConnection(userId: string, username: string): RTCPeerConnection {
    const pc = new RTCPeerConnection(this.iceServers);
    this.peerConnections.set(userId, pc);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('signal', {
          to: userId,
          signal: { type: 'candidate', candidate: event.candidate }
        });
      }
    };

    pc.onnegotiationneeded = async () => {
      if (this.negotiatingPeers.has(pc) || pc.signalingState !== 'stable') return;
      this.negotiatingPeers.add(pc);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        this.socket.emit('signal', {
          to: userId,
          signal: { type: 'offer', sdp: offer.sdp }
        });
      } catch (err) {
        console.error('[VOICE] Negotiation error:', err);
      } finally {
        this.negotiatingPeers.delete(pc);
      }
    };

    pc.ontrack = (event) => {
      this.attachRemoteTrack(userId, event);
    };

    return pc;
  }

  private shouldInitiate(userId: string): boolean {
    const localId = this.socket?.id;
    return !!localId && localId < userId;
  }

  private getTransceiver(pc: RTCPeerConnection, kind: 'audio' | 'video') {
    return pc.getTransceivers().find(transceiver => transceiver.receiver.track.kind === kind);
  }

  private attachRemoteTrack(userId: string, event: RTCTrackEvent) {
    let stream = this.remoteStreams.get(userId);
    if (!stream) {
      stream = new MediaStream();
      this.remoteStreams.set(userId, stream);
    }

    for (const source of event.streams) {
      for (const track of source.getTracks()) {
        if (!stream.getTracks().some(existing => existing.id === track.id)) {
          stream.addTrack(track);
        }
      }
    }
    if (!stream.getTracks().some(existing => existing.id === event.track.id)) {
      stream.addTrack(event.track);
    }

    this.updateUserInList(userId, {
      stream,
      isSharingVideo: stream.getVideoTracks().length > 0
    });

    event.track.onended = () => {
      stream?.removeTrack(event.track);
      this.updateUserInList(userId, {
        stream,
        isSharingVideo: !!stream?.getVideoTracks().length
      });
    };
  }

  private removeRemoteVideoTracks(userId: string) {
    const stream = this.remoteStreams.get(userId);
    if (stream) {
      stream.getVideoTracks().forEach(track => stream.removeTrack(track));
    }
    this.updateUserInList(userId, { stream, isSharingVideo: false });
  }

  private async flushIceCandidates(userId: string, pc: RTCPeerConnection) {
    const candidates = this.pendingIceCandidates.get(userId) ?? [];
    this.pendingIceCandidates.delete(userId);
    for (const candidate of candidates) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  private async handleSignal(from: string, signal: any) {
    let pc = this.peerConnections.get(from);

    if (signal.type === 'offer') {
      if (!pc) pc = this.createPeerConnection(from, 'Remote User');
      if (pc.signalingState !== 'stable') {
        throw new Error(`Unexpected offer while signaling state is ${pc.signalingState}`);
      }
      this.negotiatingPeers.add(pc);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(signal));
        await this.flushIceCandidates(from, pc);

        const audioTrack = this.localStream?.getAudioTracks()[0];
        const audioTransceiver = this.getTransceiver(pc, 'audio');
        if (audioTrack && audioTransceiver) {
          await audioTransceiver.sender.replaceTrack(audioTrack);
        }

        const videoTrack = this.screenStream?.getVideoTracks()[0];
        const videoTransceiver = this.getTransceiver(pc, 'video');
        if (this.isSharingScreen && videoTrack && videoTransceiver) {
          await videoTransceiver.sender.replaceTrack(videoTrack);
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.socket.emit('signal', { to: from, signal: answer });
      } finally {
        this.negotiatingPeers.delete(pc);
      }
    } 
    else if (signal.type === 'answer') {
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(signal));
      await this.flushIceCandidates(from, pc);
    } 
    else if (signal.type === 'candidate') {
      if (!pc || !pc.remoteDescription) {
        const pending = this.pendingIceCandidates.get(from) ?? [];
        pending.push(signal.candidate);
        this.pendingIceCandidates.set(from, pending);
        return;
      }
      await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
    }
  }

  private addUserToList(id: string, username: string) {
    const currentUsers = this._users.value;
    if (!currentUsers.find(u => u.id === id)) {
      this._users.next([...currentUsers, {
        id, username, isMuted: false, isSpeaking: false, isSharingVideo: false
      }]);
    }
  }

  private updateUserInList(id: string, data: Partial<VoiceUser>) {
    const currentUsers = this._users.value.map(u => 
      u.id === id ? { ...u, ...data } : u
    );
    this._users.next(currentUsers);
  }

  private removeUser(userId: string) {
    const pc = this.peerConnections.get(userId);
    pc?.close();
    this.peerConnections.delete(userId);
    this.remoteStreams.delete(userId);
    this.pendingIceCandidates.delete(userId);
    const filteredUsers = this._users.value.filter(u => u.id !== userId);
    this._users.next(filteredUsers);
  }

  toggleMute(roomId: string, isMuted: boolean) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
      });
      this.socket.emit('toggle-mute', { roomId, isMuted });
    }
  }

  leaveRoom() {
    this.localStream?.getTracks().forEach(track => track.stop());
    this.screenStream?.getTracks().forEach(track => track.stop());
    this.peerConnections.forEach(pc => pc.close());
    this.peerConnections.clear();
    this.remoteStreams.clear();
    this.pendingIceCandidates.clear();
    
    if (this.socket) {
      this.socket.emit('leave-room');
    }

    // RESETEAR ESTADOS
    this.isSharingScreen = false;
    this.microphoneAvailable = true;
    this.screenStream = null;
    this._localScreenStream.next(null);
    this._users.next([]);
    this._messages.next([]);
  }

  async sendVoiceMessage(roomId: string, content: string) {
    return new Promise((resolve) => {
      this.socket.emit('send-voice-message', { roomId, content }, (res: any) => {
        resolve(res);
      });
    });
  }

  async toggleScreenShare(roomId: string): Promise<boolean> {
    if (this.isSharingScreen) {
      await this.stopScreenShare(roomId);
      return false;
    }

    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const videoTrack = this.screenStream.getVideoTracks()[0];
      if (!videoTrack) throw new Error('No se pudo obtener el video de la pantalla compartida.');

      for (const pc of this.peerConnections.values()) {
        const videoTransceiver = this.getTransceiver(pc, 'video');
        if (videoTransceiver) await videoTransceiver.sender.replaceTrack(videoTrack);
      }

      this.isSharingScreen = true;
      videoTrack.onended = () => {
        void this.stopScreenShare(roomId).catch(error =>
          console.error('[VOICE] Could not stop screen sharing:', error)
        );
      };
      this._localScreenStream.next(this.screenStream);
      this.socket.emit('toggle-video', { roomId, isSharing: true });
      
      return true;
    } catch (err) {
      this.screenStream?.getTracks().forEach(track => track.stop());
      this.screenStream = null;
      this.isSharingScreen = false;
      this._localScreenStream.next(null);
      console.error('Error sharing screen:', err);
      return false;
    }
  }

  private async stopScreenShare(roomId: string) {
    const stream = this.screenStream;
    this.screenStream = null;
    this.isSharingScreen = false;
    this._localScreenStream.next(null);

    const videoTrack = stream?.getVideoTracks()[0];
    if (videoTrack) videoTrack.onended = null;
    for (const pc of this.peerConnections.values()) {
      const videoTransceiver = this.getTransceiver(pc, 'video');
      if (videoTransceiver) await videoTransceiver.sender.replaceTrack(null);
    }
    stream?.getTracks().forEach(track => track.stop());

    this.socket.emit('toggle-video', { roomId, isSharing: false });
  }
}
