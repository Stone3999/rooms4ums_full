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
    });

    this.socket.on('signal', async (data: { from: string; signal: any }) => {
      await this.handleSignal(data.from, data.signal);
    });

    this.socket.on('user-left', (userId: string) => {
      this.removeUser(userId);
    });

    this.socket.on('user-mute-toggled', (data: { id: string; isMuted: boolean }) => {
      this.updateUserInList(data.id, { isMuted: data.isMuted });
    });

    this.socket.on('user-video-toggled', (data: { id: string; isSharing: boolean }) => {
      this.updateUserInList(data.id, { isSharingVideo: data.isSharing });
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
          await this.callUser(user.id, user.username);
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
      stream.getAudioTracks().forEach(track => pc.addTrack(track, stream));
    }
    this.toggleMute(roomId, false);
  }

  private async callUser(userId: string, username: string) {
    const pc = this.createPeerConnection(userId, username);
    
    // Añadir audio
    this.localStream?.getTracks().forEach(track => {
      pc.addTrack(track, this.localStream!);
    });
    if (!this.localStream) {
      pc.addTransceiver('audio', { direction: 'recvonly' });
    }

    // ¡CLAVE! Si ya estamos compartiendo pantalla, añadir el video a la nueva conexión
    if (this.isSharingScreen && this.screenStream) {
      this.screenStream.getTracks().forEach(track => {
        pc.addTrack(track, this.screenStream!);
      });
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
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        this.socket.emit('signal', {
          to: userId,
          signal: { type: 'offer', sdp: offer.sdp }
        });
      } catch (err) {
        console.error('[VOICE] Negotiation error:', err);
      }
    };

    pc.ontrack = (event) => {
      const hasVideo = event.streams[0].getVideoTracks().length > 0;
      this.updateUserInList(userId, { 
        stream: event.streams[0],
        isSharingVideo: hasVideo
      });
    };

    return pc;
  }

  private async handleSignal(from: string, signal: any) {
    let pc = this.peerConnections.get(from);

    if (signal.type === 'offer') {
      if (!pc) pc = this.createPeerConnection(from, 'Remote User');
      await pc.setRemoteDescription(new RTCSessionDescription(signal));
      
      const senders = pc.getSenders();
      
      // Añadir audio si no está
      this.localStream?.getTracks().forEach(track => {
        if (!senders.find(s => s.track === track)) {
          pc!.addTrack(track, this.localStream!);
        }
      });

      // ¡CLAVE! Si estamos compartiendo pantalla, responder también con video
      if (this.isSharingScreen && this.screenStream) {
        this.screenStream.getTracks().forEach(track => {
          if (!senders.find(s => s.track === track)) {
            pc!.addTrack(track, this.screenStream!);
          }
        });
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.socket.emit('signal', { to: from, signal: answer });
    } 
    else if (signal.type === 'answer') {
      await pc?.setRemoteDescription(new RTCSessionDescription(signal));
    } 
    else if (signal.type === 'candidate') {
      await pc?.addIceCandidate(new RTCIceCandidate(signal.candidate));
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
      this.stopScreenShare(roomId);
      return false;
    }

    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      this.isSharingScreen = true;

      const videoTrack = this.screenStream.getVideoTracks()[0];

      // Añadir track de video a todas las conexiones existentes
      this.peerConnections.forEach(pc => {
        pc.addTrack(videoTrack, this.screenStream!);
      });

      videoTrack.onended = () => this.stopScreenShare(roomId);
      this._localScreenStream.next(this.screenStream);
      this.socket.emit('toggle-video', { roomId, isSharing: true });
      
      return true;
    } catch (err) {
      console.error('Error sharing screen:', err);
      return false;
    }
  }

  private stopScreenShare(roomId: string) {
    this.screenStream?.getTracks().forEach(track => track.stop());
    this.screenStream = null;
    this.isSharingScreen = false;
    this._localScreenStream.next(null);

    // Quitar track de video en todas las conexiones
    this.peerConnections.forEach(pc => {
      const senders = pc.getSenders();
      const videoSender = senders.find(s => s.track?.kind === 'video');
      if (videoSender) pc.removeTrack(videoSender);
    });

    this.socket.emit('toggle-video', { roomId, isSharing: false });
  }
}
