import { Component, inject, signal, OnInit, OnDestroy, PLATFORM_ID, computed, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LanguageService } from '../../core/services/language.service';
import { AuthService } from '../../core/services/auth.service';
import { VoiceService, VoiceUser } from '../../core/services/voice.service';
import { RoomService, Room } from '../../core/services/room.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-voice-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="voice-view-wrapper">
      <!-- MODO SELECCIÓN DE CANALES -->
      @if (!activeChannel()) {
        <div class="selection-mode">
          <div class="header-row">
            <div class="header-left">
              <h2 class="win-title">
                <i class="pixelart-icons-font-audio-device"></i>
                {{ isGlobal ? langService.translate('GLOBAL_VOICE_CHATS') : (langService.translate('VOICE_CHATS') + ' - ' + (roomId | uppercase)) }}
              </h2>
            </div>
            <div class="header-right">
              <div class="search-container">
                <i class="pixelart-icons-font-search"></i>
                <input type="text" class="win-input search-input" [placeholder]="langService.translate('SEARCH')" [(ngModel)]="searchQuery">
              </div>
              <button class="win-button accent header-create-btn" (click)="showCreateForm.set(true)">
                <i class="pixelart-icons-font-plus"></i> 
                <span>{{ langService.translate('NEW_TOPIC') }}</span>
              </button>
            </div>
          </div>

          <div class="channels-content-area">
            @if (filteredChannels().length > 0) {
              <div class="channels-grid">
                @for (channel of filteredChannels(); track (channel?.id || $index)) {
                  <div class="channel-card win-panel" (click)="joinChannel(channel?.id)">
                    <div class="card-top-info">
                      <div class="card-category">#{{ (channel?.category || '') | uppercase }}</div>
                      <div class="live-badge">
                        <span class="pulse-dot"></span>
                        LIVE {{ getDuration(channel?.createdAt) }}
                      </div>
                    </div>
                    <div class="card-header">
                      <i class="pixelart-icons-font-volume-up card-icon"></i>
                      <span class="card-topic">{{ (channel?.topic || '') | uppercase }}</span>
                    </div>
                    <div class="card-body">
                      <div class="user-stats">
                        <i class="pixelart-icons-font-user"></i>
                        <span>{{ channel?.userCount || 0 }} {{ langService.translate('ONLINE') }}</span>
                      </div>
                    </div>
                    <div class="card-footer">
                      <button class="win-button mini accent">{{ langService.translate('JOIN_CHANNEL') }}</button>
                    </div>
                  </div>
                }
              </div>
            } @else {
              <div class="no-results-view">
                <div class="no-results-panel win-panel">
                  <i class="pixelart-icons-font-alert alert-icon-fixed"></i>
                  <p class="no-results-text">{{ isGlobal ? langService.translate('NO_VOICE_CHATS_GLOBAL') : langService.translate('NO_VOICE_CHATS_COMMUNITY') }}</p>
                  <button class="win-button accent" (click)="showCreateForm.set(true)">
                    {{ langService.translate('NEW_TOPIC') }}
                  </button>
                </div>
              </div>
            }
          </div>
        </div>

        <!-- MODAL CREACIÓN -->
        <div class="modal-overlay" *ngIf="showCreateForm()">
          <div class="win-panel create-modal">
            <h3 class="win-title">{{ langService.translate('CREATE_NEW_VOICE_CHAT') }}</h3>
            <div class="form-group">
              <label>{{ langService.translate('CATEGORY') }}</label>
              <select class="win-input" [(ngModel)]="newChannelCategory" [disabled]="!isGlobal">
                <option *ngFor="let r of availableRooms()" [value]="r.slug">{{ r.name | uppercase }}</option>
              </select>
            </div>
            <div class="form-group">
              <label>{{ langService.translate('TOPIC_TITLE') }}</label>
              <input type="text" class="win-input" [(ngModel)]="newChannelTopic" 
                     [placeholder]="langService.translate('TOPIC_PLACEHOLDER')" maxlength="30">
              <small class="char-count">{{ (newChannelTopic || '').length }}/30</small>
            </div>
            <div class="modal-actions">
              <button class="win-button" (click)="showCreateForm.set(false)">{{ langService.translate('CANCEL') }}</button>
              <button class="win-button accent" (click)="createNewChannel()">{{ langService.translate('CREATE') }}</button>
            </div>
          </div>
        </div>
      } 
      @else {
        <!-- CANAL ACTIVO -->
        <div class="voice-container">
          <div class="voice-header-row win-panel">
            <div class="header-left-group">
              <span class="orange-badge">#{{ (activeChannelData()?.category || '...') | uppercase }}</span>
              <h2 class="active-title">{{ (activeChannelData()?.topic || 'VOICE ROOM') | uppercase }}</h2>
              <span class="conn-status" [class.online]="isConnected()">
                [{{ isConnected() ? langService.translate('CONNECTED') : langService.translate('CONNECTING') }}]
              </span>
            </div>
            <button class="win-button mini exit-btn" (click)="leave()">
              <i class="pixelart-icons-font-close"></i>
              <span>{{ langService.translate('EXIT') }}</span>
            </button>
          </div>

          <div class="voice-main-layout">
            <!-- PANEL IZQUIERDO: USUARIOS -->
            <div class="users-sidebar win-panel">
              <h3 class="panel-label">{{ langService.translate('USERS') }} ({{ (remoteUsers() || []).length + 1 }})</h3>
              <div class="users-list-scroll">
                <div class="user-box-container" [class.is-speaking]="isSpeaking()">
                  <div class="user-box-inner">
                    <div class="user-avatar-rect"><i class="pixelart-icons-font-user"></i></div>
                    <span class="user-name-text">{{ localUsername() }} ({{ langService.translate('YOU') || 'Tú' }})</span>
                    <i *ngIf="isMuted()" class="pixelart-icons-font-mic-off status-icon-red"></i>
                  </div>
                </div>
                <div class="user-box-container" *ngFor="let user of remoteUsers(); track (user?.id || $index)" [class.is-speaking]="user?.isSpeaking">
                  <div class="user-box-inner">
                    <div class="user-avatar-rect"><i class="pixelart-icons-font-user"></i></div>
                    <span class="user-name-text">{{ user?.username }}</span>
                    <i *ngIf="user?.isMuted" class="pixelart-icons-font-mic-off status-icon-red"></i>
                    <audio [srcObject]="user?.stream" autoplay *ngIf="user?.stream"></audio>
                  </div>
                </div>
              </div>
            </div>

            <!-- PANEL CENTRAL: STAGE + THUMBNAILS -->
            <div class="main-stage win-panel">
              <div class="stage-content">
                @if (activeStageStreamer()) {
                  <div class="active-video-stage">
                    <video [srcObject]="activeStageStreamer()?.stream" autoplay playsinline class="stage-video-el"></video>
                    <div class="stage-overlay">
                      <span class="streamer-label">LIVE: {{ activeStageStreamer()?.username }}</span>
                    </div>
                  </div>
                } @else {
                  <div class="audience-placeholder">
                    <i class="pixelart-icons-font-headset stage-icon pulse"></i>
                    <p class="stage-msg">{{ langService.translate('ACTIVE_AUDIENCE') }}</p>
                  </div>
                }
              </div>

              <div class="streams-thumbnails" *ngIf="allStreamers().length > 0">
                @for (s of allStreamers(); track s.id) {
                  <div class="thumb-card win-panel" 
                       [class.selected]="selectedStreamerId() === s.id"
                       (click)="selectedStreamerId.set(s.id)">
                    <div class="thumb-preview">
                      <video [srcObject]="s.stream" autoplay playsinline muted class="thumb-video-el"></video>
                    </div>
                    <span class="thumb-name">{{ s.username | uppercase }}</span>
                  </div>
                }
              </div>

              <div class="stage-footer">
                <div class="controls-row">
                  <button class="ctrl-btn" [class.active]="!isMuted()" (click)="toggleMute()">
                    <i [class]="isMuted() ? 'pixelart-icons-font-mic-off' : 'pixelart-icons-font-mic'"></i>
                    <span>{{ isMuted() ? langService.translate('UNMUTE') : langService.translate('MUTE') }}</span>
                  </button>
                  <button class="ctrl-btn" [class.active]="isSharingScreen()" (click)="toggleScreen()">
                    <i class="pixelart-icons-font-monitor"></i>
                    <span>{{ isSharingScreen() ? langService.translate('STOP') : langService.translate('SHARE') }}</span>
                  </button>
                  <button class="ctrl-btn disconnect" (click)="leave()">
                    <i class="pixelart-icons-font-close"></i>
                    <span>{{ langService.translate('LEAVE') }}</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- PANEL DERECHO: CHAT -->
            <div class="chat-sidebar win-panel">
              <h3 class="panel-label">{{ langService.translate('LIVE_CHAT') }}</h3>
              <div class="chat-messages-area" #chatScroll>
                <div class="chat-msg-row" *ngFor="let msg of messages(); track (msg?.id || $index)">
                  <span class="chat-msg-author">{{ msg?.sender }}:</span>
                  <span class="chat-msg-body">{{ msg?.content }}</span>
                </div>
              </div>
              <div class="chat-footer">
                <div class="chat-input-row">
                  <textarea #msgInput class="win-input chat-box-textarea" 
                         [placeholder]="langService.translate('WRITE_SOMETHING')" 
                         [(ngModel)]="newMessage" 
                         (keydown.enter)="handleChatEnter($event)"
                         maxlength="200"></textarea>
                  <button class="win-button mini accent send-btn" (click)="sendMessage()">
                    <i class="pixelart-icons-font-arrow-right"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .voice-view-wrapper { padding: 20px; height: 100%; display: flex; flex-direction: column; overflow: hidden; background: #000; position: relative; }
    
    /* SELECCIÓN MODE */
    .selection-mode { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
    .header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; flex-shrink: 0; }
    .header-left, .header-right { display: flex; align-items: center; gap: 15px; }
    .search-container { display: flex; align-items: center; gap: 8px; background: #000; border: 1px solid var(--win-border-light); padding: 0 10px; height: 35px; }
    .search-input { border: none !important; background: transparent !important; outline: none !important; width: 180px; font-size: 0.75rem !important; color: var(--accent-color) !important; }
    .header-create-btn { display: flex; align-items: center; gap: 8px; height: 35px; padding: 0 15px !important; }

    .channels-content-area { flex: 1; overflow-y: auto; padding-right: 10px; display: flex; flex-direction: column; }
    .channels-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; padding-bottom: 40px; }
    
    .no-results-view { flex: 1; display: flex; align-items: center; justify-content: center; padding-bottom: 100px; }
    .no-results-panel { width: 400px; padding: 40px !important; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 20px; background: #050505; border: 1px solid var(--win-border-dark); }
    .alert-icon-fixed { font-size: 2.5rem; color: var(--accent-color); }
    .no-results-text { font-size: 0.8rem; color: #888; line-height: 1.5; margin: 0; }

    .channel-card { padding: 15px; cursor: pointer; background-color: #050505; border: 1px solid var(--win-border-dark); display: flex; flex-direction: column; transition: all 0.2s ease; }
    .channel-card:hover { border-color: var(--accent-color); box-shadow: 0 0 15px var(--accent-color); transform: translateY(-2px); }
    .card-top-info { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .card-category { font-size: 0.55rem; color: var(--accent-color); font-weight: bold; }
    .live-badge { font-size: 0.5rem; background: #ff000022; color: #ff0000; padding: 2px 6px; border: 1px solid #ff0000; display: flex; align-items: center; gap: 4px; }
    .pulse-dot { width: 4px; height: 4px; background: #ff0000; border-radius: 50%; animation: blink 1s infinite; }
    .card-header { display: flex; align-items: center; gap: 10px; margin-bottom: 15px; min-height: 40px; }
    .card-topic { font-weight: bold; font-size: 0.85rem; color: #fff; line-height: 1.2; }
    .user-stats { display: flex; align-items: center; gap: 8px; font-size: 0.65rem; color: var(--text-secondary); margin-top: 10px; }
    .card-footer { margin-top: auto; padding-top: 15px; display: flex; justify-content: flex-end; }

    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 9999; backdrop-filter: blur(4px); }
    .create-modal { padding: 30px; width: 400px; background: #050505; border: 1px solid var(--win-border-light); }
    .form-group { margin-bottom: 20px; position: relative; }
    .char-count { position: absolute; right: 0; top: 0; font-size: 0.5rem; color: #666; }
    .form-group label { display: block; font-size: 0.6rem; color: var(--accent-color); margin-bottom: 8px; font-weight: bold; }
    .form-group .win-input { width: 100%; height: 35px; padding: 0 10px; background: #111; border: 1px solid #333; color: white; font-size: 0.75rem; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 30px; }

    /* ACTIVE ROOM */
    .voice-container { height: 100%; display: flex; flex-direction: column; overflow: hidden; }
    .voice-header-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 15px !important; margin-bottom: 10px; flex-shrink: 0; }
    .header-left-group { display: flex; align-items: center; gap: 15px; }
    .orange-badge { background: #ff7700; color: #000; font-weight: bold; font-size: 0.6rem; padding: 2px 6px; }
    .active-title { color: #fff; font-size: 0.85rem; margin: 0; font-weight: bold; }
    .exit-btn { border-color: #ff0000 !important; color: #ff0000 !important; display: flex; align-items: center; gap: 8px; padding: 4px 12px; height: 32px; }
    .exit-btn i { font-size: 0.8rem; }
    .exit-btn span { font-size: 0.65rem; }

    .voice-main-layout { display: grid; grid-template-columns: 220px 1fr 280px; gap: 10px; flex: 1; min-height: 0; }
    .panel-label { font-size: 0.6rem; color: var(--accent-color); padding: 8px 12px; background: #0a0a0a; border-bottom: 1px solid #111; margin: 0; }
    .users-list-scroll { flex: 1; overflow-y: auto; padding: 10px; }
    .user-box-container { padding: 2px; margin-bottom: 6px; border: 1px solid #111; }
    .user-box-container.is-speaking { border-color: #00ff00; box-shadow: 0 0 10px #00ff0044; }
    .user-box-inner { display: flex; align-items: center; gap: 10px; padding: 6px; background: #080808; }
    .user-avatar-rect { width: 22px; height: 22px; border: 1px solid var(--accent-color); display: flex; align-items: center; justify-content: center; font-size: 0.6rem; }
    .user-name-text { font-size: 0.65rem; color: #eee; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .main-stage { display: flex; flex-direction: column; overflow: hidden; }
    .stage-content { flex: 1; display: flex; align-items: center; justify-content: center; position: relative; background: #020202; overflow: hidden; }
    .active-video-stage { width: 100%; height: 100%; position: relative; display: flex; align-items: center; justify-content: center; }
    .stage-video-el { width: 100%; height: 100%; object-fit: contain; }
    .stage-overlay { position: absolute; top: 15px; left: 15px; background: rgba(0,0,0,0.7); padding: 4px 10px; border: 1px solid var(--accent-color); }
    .streamer-label { color: var(--accent-color); font-size: 0.6rem; font-weight: bold; }

    .streams-thumbnails { display: flex; gap: 10px; padding: 10px; background: #0a0a0a; border-top: 1px solid #111; flex-shrink: 0; overflow-x: auto; }
    .thumb-card { width: 140px; flex-shrink: 0; cursor: pointer; padding: 4px !important; position: relative; border-color: #333; }
    .thumb-card.selected { border-color: var(--accent-color); box-shadow: 0 0 8px var(--accent-color); }
    .thumb-preview { width: 100%; aspect-ratio: 16/9; background: #000; position: relative; overflow: hidden; }
    .thumb-video-el { width: 100%; height: 100%; object-fit: cover; }
    .thumb-name { display: block; font-size: 0.5rem; color: #fff; margin-top: 4px; text-align: center; }

    .audience-placeholder { text-align: center; color: var(--accent-color); }
    .stage-icon { font-size: 5rem; margin-bottom: 15px; }

    .stage-footer { padding: 12px; background: rgba(0,0,0,0.95); border-top: 1px solid #111; flex-shrink: 0; }
    .controls-row { display: flex; gap: 12px; justify-content: center; }
    .ctrl-btn { background: #111; border: 1px solid #333; color: #fff; padding: 8px 12px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 75px; font-size: 0.55rem; }
    .ctrl-btn.active { background: var(--accent-color); color: #000; border-color: var(--accent-color); }
    .ctrl-btn.disconnect { color: #ff0000; border-color: #ff0000; }

    /* CHAT */
    .chat-sidebar { display: flex; flex-direction: column; overflow: hidden; }
    .chat-messages-area { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px; background: #020202; }
    .chat-msg-row { font-size: 0.7rem; line-height: 1.4; border-left: 2px solid #1a1a1a; padding-left: 10px; word-break: break-word; overflow-wrap: break-word; max-width: 100%; }
    .chat-msg-author { color: var(--accent-color); font-weight: bold; margin-right: 6px; }
    .chat-msg-body { color: #ccc; white-space: pre-wrap; }
    
    .chat-footer { padding: 10px; border-top: 1px solid #111; background: #0a0a0a; flex-shrink: 0; }
    .chat-input-row { display: flex; gap: 8px; align-items: flex-end; }
    .chat-box-textarea { 
      flex: 1; 
      min-height: 32px; 
      max-height: 80px; 
      background: #000 !important; 
      border: 1px solid #333 !important; 
      color: #fff !important; 
      font-size: 0.7rem !important; 
      padding: 8px 10px !important; 
      outline: none; 
      resize: none; 
      line-height: 1.2;
      overflow-y: auto;
    }
    .chat-box-textarea:focus { border-color: var(--accent-color) !important; }
    .send-btn { height: 32px; width: 32px; padding: 0 !important; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }

    @keyframes blink { 0% { opacity: 1; } 50% { opacity: 0; } 100% { opacity: 1; } }
    .pulse { animation: pulse 2s infinite; }
    @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
  `]
})
export class VoiceViewComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('chatScroll') private chatScrollContainer!: ElementRef;
  @ViewChild('msgInput') private msgInput!: ElementRef;

  route = inject(ActivatedRoute);
  router = inject(Router);
  langService = inject(LanguageService);
  authService = inject(AuthService);
  voiceService = inject(VoiceService);
  roomService = inject(RoomService);
  platformId = inject(PLATFORM_ID);

  isGlobal = false;
  roomId: string = '';
  searchQuery: string = '';

  channels = signal<any[]>([]);
  availableRooms = signal<Room[]>([]);
  currentTime = signal<number>(Date.now());
  private timerInterval: any;

  showCreateForm = signal(false);
  newChannelCategory = '';
  newChannelTopic = '';

  activeChannel = signal<string | null>(null);
  isConnected = signal<boolean>(false);
  isMuted = signal<boolean>(false);
  isSpeaking = signal<boolean>(false);
  localUsername = signal<string>('');
  remoteUsers = signal<VoiceUser[]>([]);
  messages = signal<any[]>([]);
  newMessage = '';
  
  isSharingScreen = signal<boolean>(false);
  localScreenStream = signal<MediaStream | null>(null);
  selectedStreamerId = signal<string | null>(null);

  allStreamers = computed(() => {
    const list: any[] = [];
    if (this.isSharingScreen() && this.localScreenStream()) {
      list.push({ id: 'local', username: this.localUsername(), stream: this.localScreenStream() });
    }
    const remotes = (this.remoteUsers() || [])
      .filter(u => u?.isSharingVideo && u?.stream)
      .map(u => ({ id: u.id, username: u.username, stream: u.stream }));
    return [...list, ...remotes];
  });

  activeStageStreamer = computed(() => {
    const streamers = this.allStreamers();
    if (streamers.length === 0) return null;
    const selectedId = this.selectedStreamerId();
    if (selectedId) {
      const found = streamers.find(s => s.id === selectedId);
      if (found) return found;
    }
    return streamers[0];
  });

  anySharingVideo = computed(() => this.allStreamers().length > 0);
  userSharingVideo = computed(() => this.activeStageStreamer());
  currentStream = computed(() => this.activeStageStreamer()?.stream);

  filteredChannels = computed(() => {
    return (this.channels() || [])
      .filter(c => c && c.id)
      .filter(c => this.isGlobal ? true : c.category === this.roomId)
      .filter(c => {
        if (!this.searchQuery) return true;
        const q = this.searchQuery.toLowerCase();
        return (c.topic && c.topic.toLowerCase().includes(q)) || (c.category && c.category.toLowerCase().includes(q));
      });
  });

  activeChannelData = computed(() => {
    const id = this.activeChannel();
    return (this.channels() || []).find(c => c && c.id === id) || null;
  });

  constructor() {
    this.voiceService.users$.pipe(takeUntilDestroyed()).subscribe(users => this.remoteUsers.set(users || []));
    this.voiceService.channels$.pipe(takeUntilDestroyed()).subscribe(channels => this.channels.set(channels || []));
    this.voiceService.messages$.pipe(takeUntilDestroyed()).subscribe(msgs => {
      this.messages.set(msgs || []);
      this.shouldScrollToBottom = true;
    });
    this.voiceService.localScreenStream$.pipe(takeUntilDestroyed()).subscribe(stream => {
      this.localScreenStream.set(stream);
      if (stream && !this.selectedStreamerId()) this.selectedStreamerId.set('local');
    });
  }

  private shouldScrollToBottom = false;

  ngAfterViewChecked() {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  async ngOnInit() {
    this.isGlobal = this.router.url.includes('/chats-voz');
    if (this.isGlobal) this.roomId = 'GLOBAL';
    else {
      this.route.parent?.params.subscribe(params => {
        this.roomId = params['id'];
        this.newChannelCategory = this.roomId;
      });
    }

    try {
      const rooms = await this.roomService.getActiveRooms();
      this.availableRooms.set(rooms || []);
    } catch (e) { console.error(e); }

    if (isPlatformBrowser(this.platformId)) {
      await this.voiceService.getChannels();
      const profile: any = await this.authService.getProfile();
      if (profile) this.localUsername.set(profile.username);
      this.timerInterval = setInterval(() => this.currentTime.set(Date.now()), 1000);
    }
  }

  getDuration(createdAt: any): string {
    if (!createdAt) return '00:00';
    const startTime = typeof createdAt === 'string' ? parseInt(createdAt, 10) : createdAt;
    const now = this.currentTime();
    if (startTime > now) return '00:00';
    const diff = Math.floor((now - startTime) / 1000);
    const m = Math.floor(diff / 60);
    const s = diff % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  async createNewChannel() {
    if (!this.newChannelCategory || !this.newChannelTopic) return;
    const cleanTopic = this.newChannelTopic.replace(/[\r\n]+/gm, ' ').trim().substring(0, 30);
    const channelId = await this.voiceService.createChannel(this.newChannelCategory, cleanTopic, this.localUsername());
    this.showCreateForm.set(false);
    this.newChannelTopic = '';
    if (channelId) this.joinChannel(channelId);
  }

  async joinChannel(channelId: any) {
    if (!isPlatformBrowser(this.platformId) || !channelId) return;
    this.activeChannel.set(channelId);
    try {
      await this.voiceService.joinRoom(channelId, this.localUsername());
      this.isConnected.set(true);
    } catch (error: any) {
      this.activeChannel.set(null);
    }
  }

  handleChatEnter(event: any) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  async sendMessage() {
    const channelId = this.activeChannel();
    if (!this.newMessage.trim() || !channelId) return;
    const res: any = await this.voiceService.sendVoiceMessage(channelId, this.newMessage);
    if (res?.status === 'OK') {
      this.newMessage = '';
      setTimeout(() => { if (this.msgInput) this.msgInput.nativeElement.focus(); }, 10);
    }
  }

  async toggleScreen() {
    if (!isPlatformBrowser(this.platformId)) return;
    const channelId = this.activeChannel();
    if (!channelId) return;
    const isSharing = await this.voiceService.toggleScreenShare(channelId);
    this.isSharingScreen.set(isSharing);
  }

  private scrollToBottom() {
    if (isPlatformBrowser(this.platformId) && this.chatScrollContainer) {
      const el = this.chatScrollContainer.nativeElement;
      el.scrollTop = el.scrollHeight;
    }
  }

  toggleMute() {
    const channelId = this.activeChannel();
    if (!channelId) return;
    this.isMuted.set(!this.isMuted());
    this.voiceService.toggleMute(channelId, this.isMuted());
  }

  leave() {
    this.voiceService.leaveRoom();
    this.activeChannel.set(null);
    this.isConnected.set(false);
    this.selectedStreamerId.set(null);
    this.isSharingScreen.set(false);
  }

  ngOnDestroy() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.leave();
  }
}
