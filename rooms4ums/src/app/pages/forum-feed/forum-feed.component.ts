import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { LanguageService } from '../../core/services/language.service';
import { TranslationService } from '../../core/services/translation.service';
import { RoomService, Room } from '../../core/services/room.service';
import { ForumService, Post } from '../../core/services/forum.service';
import { PostCreateComponent } from './post-create.component';
import { PointerHighlightDirective } from '../../core/directives/pointer-highlight.directive';

@Component({
  selector: 'app-forum-feed',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterOutlet, PostCreateComponent, PointerHighlightDirective],
  template: `
    <div class="feed-container">
      <h1 class="win-title">
        <i [class]="room()?.icon || 'pixelart-icons-font-message'"></i>
        {{ langService.translate('ROOM_ACTUAL') }}: {{ room()?.name || roomId | uppercase }}
      </h1>
      
      <div class="feed-actions win-panel">
        <div class="left-actions">
          <button class="win-button" (click)="createNewPost()">
            <i class="pixelart-icons-font-plus"></i> {{ langService.translate('NEW_POST') }}
          </button>
          <button class="win-button" (click)="refreshFeed()">
            <i class="pixelart-icons-font-refresh"></i> {{ langService.translate('UPDATE') }}
          </button>
        </div>

        <div class="right-actions">
          <button class="win-button accent" [routerLink]="['/foro', roomId, 'voz']" routerLinkActive="active-btn">
            <i class="pixelart-icons-font-volume-up"></i> {{ langService.translate('VOICE_CHAT') }}
          </button>
          
          <button class="win-button accent" 
                  [routerLink]="room()?.is_interactive ? ['/foro', roomId, 'actividades'] : null" 
                  routerLinkActive="active-btn"
                  [class.disabled-btn]="!room()?.is_interactive"
                  [attr.title]="!room()?.is_interactive ? 'SALA NO INTERACTIVA' : ''">
            <i class="pixelart-icons-font-zap"></i> {{ langService.translate('ACTIVITIES') }}
          </button>
        </div>
      </div>

      <!-- EDITOR DE POSTS -->
      <div class="post-editor-overlay" *ngIf="isEditing">
        <app-post-create 
          [roomId]="roomId" 
          (onCreated)="onPostCreated($event)" 
          (onCancel)="isEditing = false"
        ></app-post-create>
      </div>

      <!-- Contenido dinámico (Voz, Actividades, Post) -->
      <router-outlet></router-outlet>

      <!-- REDDIT-LIKE FEED -->
      @if (isFeedActive()) {
        <div class="reddit-feed" *ngIf="!isLoading(); else loadingTpl">
          @for (post of posts(); track post._id) {
            <div class="post-card win-panel" appPointerHighlight="lift">
              <!-- Sidebar de votación (Placeholder) -->
              <div class="vote-sidebar">
                <button class="vote-btn up"><i class="pixelart-icons-font-arrow-up"></i></button>
                <span class="score">0</span>
                <button class="vote-btn down"><i class="pixelart-icons-font-arrow-down"></i></button>
              </div>

              <!-- Contenido principal -->
              <div class="post-main">
                <div class="post-meta">
                  <span class="author"><i class="pixelart-icons-font-user"></i> {{ post.authorName }}</span>
                  <span class="dot">•</span>
                  <span class="date">{{ post.createdAt | date:'short' }}</span>
                </div>
                
                <h2 class="post-title">{{ post.title }}</h2>
                
                <!-- Vista previa de imagen si existe -->
                <div class="post-preview-img" *ngIf="getFirstImage(post)">
                  <img [src]="getFirstImage(post)" alt="Preview">
                </div>

                <p class="post-excerpt">{{ post.content | slice:0:200 }}...</p>

                <div class="post-footer">
                  <div class="footer-left">
                    <button class="footer-action">
                      <i class="pixelart-icons-font-message"></i> {{ post.commentCount || 0 }} {{ langService.translate('COMMENTS') }}
                    </button>
                    <div class="translate-container">
                      <select class="win-select mini" (change)="translatePost(post, $event)" (click)="$event.stopPropagation()">
                        <option value="" selected disabled>{{ langService.translate('TRANSLATE_TO') }}...</option>
                        <option value="es">ESPAÑOL</option>
                        <option value="en">ENGLISH</option>
                        <option value="fr">FRANÇAIS</option>
                        <option value="jp">日本語</option>
                        <option value="it">ITALIANO</option>
                        <option value="pt">PORTUGUÊS</option>
                      </select>
                    </div>
                  </div>

                  <button class="win-button mini view-btn" (click)="goToPost(post._id)">
                    {{ langService.translate('VIEW_POST') }} <i class="pixelart-icons-font-arrow-right"></i>
                  </button>
                </div>
              </div>
            </div>
          }
          @if (posts().length === 0) {
            <div class="no-posts win-panel">
              <p>AÚN NO HAY MENSAJES EN ESTA SALA. ¡SÉ EL PRIMERO!</p>
            </div>
          }
        </div>
      }

      <ng-template #loadingTpl>
        <div class="loading-tpl">
          <div class="spinner"></div>
          <p>CARGANDO FEED...</p>
        </div>
      </ng-template>

      <!-- MODAL/PROMPT DE LOGIN -->
      <div class="login-prompt-overlay" *ngIf="showLoginPrompt">
        <div class="login-prompt win-panel">
          <h3 class="win-title">ACCESO REQUERIDO</h3>
          <p>DEBES INICIAR SESIÓN O REGISTRARTE PARA PODER CREAR NUEVOS MENSAJES EN ESTA SALA.</p>
          <div class="prompt-actions">
            <button class="win-button" routerLink="/login">{{ langService.translate('LOGIN') }}</button>
            <button class="win-button" routerLink="/register">{{ langService.translate('REGISTER') }}</button>
            <button class="win-button" (click)="showLoginPrompt = false">CANCELAR</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .feed-container { padding: 10px; position: relative; }
    .feed-actions { 
      margin-bottom: 20px; 
      display: flex; 
      justify-content: space-between; 
      align-items: center;
      gap: 10px;
      min-height: 45px;
    }
    /* ... (rest of the styles) ... */
    .post-editor-overlay {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.8); z-index: 1000;
      display: flex; justify-content: center; align-items: center; padding: 20px;
    }

    .post-preview-img { margin: 10px 0; max-height: 300px; overflow: hidden; border: 1px solid #333; }
    .post-preview-img img { width: 100%; height: auto; object-fit: cover; }

    .no-posts { padding: 40px; text-align: center; }
    .loading-tpl { padding: 40px; text-align: center; }

    .left-actions, .right-actions { 
      display: flex; 
      gap: 10px; 
      align-items: center; 
      height: 100%;
    }
    
    .win-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      height: 32px;
      padding: 0 15px;
      vertical-align: middle;
    }

    .win-button.accent {
      border-color: var(--accent-color);
      background-color: rgba(255, 140, 0, 0.05);
    }
    .win-button.active-btn {
      background-color: var(--accent-color);
      color: #000;
    }

    .win-button.disabled-btn {
      border-color: #444;
      color: #444;
      background-color: #111;
      cursor: not-allowed;
      opacity: 0.6;
    }

    .win-button i { 
      font-size: 1rem;
      display: flex;
      align-items: center;
    }

    .win-select.mini {
      font-size: 0.7rem;
      padding: 2px 5px;
      height: 22px;
      background-color: #000;
      color: var(--accent-color);
      border: 1px solid var(--win-border-light);
    }

    .login-prompt-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background-color: rgba(0,0,0,0.8);
      display: flex; justify-content: center; align-items: center; z-index: 1000;
    }
    .login-prompt { width: 400px; padding: 30px; text-align: center; }
    .login-prompt p { font-size: 0.8rem; margin-bottom: 25px; line-height: 1.5; }
    .prompt-actions { display: flex; flex-direction: column; gap: 10px; }

    /* REDDIT FEED */
    .reddit-feed { display: flex; flex-direction: column; gap: 15px; }
    .post-card { display: flex; background: #050505; transition: all 0.2s; border-color: #222; }
    .post-card:hover { border-color: var(--accent-color); background: #0a0a0a; }

    .vote-sidebar {
      width: 40px;
      background: rgba(255,255,255,0.02);
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 10px 0;
      gap: 5px;
      border-right: 1px solid #111;
    }
    .vote-btn { background: none; border: none; color: #555; cursor: pointer; font-size: 1.2rem; }
    .vote-btn:hover { color: var(--accent-color); }
    .score { font-size: 0.75rem; font-weight: bold; color: var(--text-primary); }

    .post-main { flex: 1; padding: 12px 15px; display: flex; flex-direction: column; gap: 8px; }
    .post-meta { font-size: 0.65rem; color: var(--text-secondary); display: flex; align-items: center; gap: 8px; }
    .post-meta .author { color: var(--accent-color); font-weight: bold; }
    
    .post-title { font-size: 1.1rem; color: var(--text-primary); margin: 0; }
    .post-excerpt { font-size: 0.85rem; color: var(--text-secondary); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }

    .post-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding-top: 10px; border-top: 1px solid #111; }
    .footer-left { display: flex; align-items: center; gap: 15px; }
    .footer-action { background: none; border: none; color: var(--text-secondary); font-size: 0.7rem; cursor: pointer; display: flex; align-items: center; gap: 5px; }
    .footer-action:hover { color: var(--accent-color); }

    .view-btn { border-color: var(--accent-color); }
  `]
})
export class ForumFeedComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private roomService = inject(RoomService);
  private forumService = inject(ForumService);
  public authService = inject(AuthService);
  public langService = inject(LanguageService);
  private transService = inject(TranslationService);

  roomId: string = '';
  room = signal<Room | null>(null);
  posts = signal<Post[]>([]);
  isLoading = signal(false);
  isEditing = false;
  showLoginPrompt: boolean = false;

  ngOnInit() {
    this.route.params.subscribe(async params => {
      this.roomId = params['id'] || this.route.snapshot.parent?.params['id'];
      if (this.roomId) {
        await this.loadRoomDetails();
        await this.loadPosts();
      }
    });
  }

  async loadRoomDetails() {
    try {
      const data = await this.roomService.getRoomBySlug(this.roomId);
      this.room.set(data);
    } catch (error) {
      console.error('Error loading room details:', error);
    }
  }

  async loadPosts() {
    this.isLoading.set(true);
    try {
      const res = await this.forumService.getPostsByRoom(this.roomId);
      this.posts.set(res.data);
    } catch (error) {
      console.error('Error loading posts:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  isFeedActive(): boolean {
    return this.route.children.length === 0;
  }

  refreshFeed() {
    this.loadPosts();
  }

  createNewPost() {
    if (this.authService.isLoggedIn()) {
      this.isEditing = true;
    } else {
      this.showLoginPrompt = true;
    }
  }

  onPostCreated(post: Post) {
    this.isEditing = false;
    this.posts.update(prev => [post, ...prev]);
  }

  getFirstImage(post: Post): string | null {
    const img = post.attachments?.find(a => a.type.startsWith('image/'));
    return img ? img.url : null;
  }

  async translatePost(post: any, event: any) {
    const targetLang = event.target.value;
    if (!targetLang) return;

    if (!post.originalTitle) post.originalTitle = post.title;
    if (!post.originalContent) post.originalContent = post.content;

    const originalOptionText = event.target.options[event.target.selectedIndex].text;
    event.target.options[event.target.selectedIndex].text = '...';
    
    try {
      const currentLang = this.langService.currentLang();
      post.title = await this.transService.translateText(post.originalTitle, targetLang, currentLang);
      post.content = await this.transService.translateText(post.originalContent, targetLang, currentLang);
    } finally {
      event.target.options[event.target.selectedIndex].text = originalOptionText;
      event.target.value = '';
    }
  }

  goToPost(postId: string) {
    this.router.navigate(['post', postId], { relativeTo: this.route });
  }
}
