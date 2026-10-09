import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LanguageService } from '../../core/services/language.service';
import { TranslationService } from '../../core/services/translation.service';
import { ForumService, Post, Comment } from '../../core/services/forum.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-post-details',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="post-details-container" *ngIf="post()">
      <div class="top-nav">
        <button class="win-button" (click)="goBack()">
          <i class="pixelart-icons-font-arrow-left"></i> {{ langService.translate('BACK_TO_FORUM') }}
        </button>
      </div>
      
      <div class="post-main win-panel">
        <!-- CABECERA DEL POST -->
        <div class="post-header">
          <span class="author"><i class="pixelart-icons-font-user"></i> {{ langService.translate('USER') }}: {{post()?.authorName}}</span>
          <span class="date"><i class="pixelart-icons-font-calendar"></i> {{ langService.translate('DATE') }}: {{post()?.createdAt | date:'short'}}</span>
        </div>
        <h1 class="win-title">{{post()?.title}}</h1>

        <!-- IMAGEN DESTACADA (SI EXISTE) -->
        <div class="featured-image" *ngIf="getMainImage()">
          <img [src]="getMainImage()" alt="Featured Image">
        </div>

        <p class="post-content">{{post()?.content}}</p>

        <!-- OTROS ADJUNTOS -->
        <div class="attachments-list" *ngIf="getOtherAttachments().length > 0">
          <h4 class="win-title mini">{{ langService.translate('ATTACHMENTS') }}</h4>
          <div class="attachment-items">
            <a *ngFor="let file of getOtherAttachments()" [href]="file.url" target="_blank" class="file-link win-panel">
              <i [class]="getFileIcon(file.type)"></i> {{ file.name }}
            </a>
          </div>
        </div>
        
        <div class="post-actions-row">
          <div class="reactions-left">
            <button class="win-button small"><i class="pixelart-icons-font-arrow-up"></i> {{post()?.viewCount}} VIEWS</button>
          </div>
          <div class="translate-right">
            <select class="win-select mini" (change)="translatePost(post(), $event)">
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
      </div>

      <div class="comments-section">
        <h3 class="win-title">{{ langService.translate('COMMENTS') }} ({{comments().length}})</h3>
        
        <!-- INPUT DE COMENTARIO -->
        <div class="comment-input win-panel" *ngIf="authService.isLoggedIn(); else loginPrompt">
          <textarea class="win-input" [(ngModel)]="newCommentContent" [placeholder]="langService.translate('WRITE_COMMENT_PLACEHOLDER')"></textarea>
          <div class="input-actions">
            <button class="win-button" [disabled]="!newCommentContent.trim() || isSubmittingComment" (click)="submitComment()">
              <i class="pixelart-icons-font-message"></i> {{ isSubmittingComment ? '...' : langService.translate('PUBLISH') }}
            </button>
          </div>
        </div>

        <ng-template #loginPrompt>
          <div class="login-prompt win-panel">
            <p>DEBES <a routerLink="/login">INICIAR SESIÓN</a> PARA COMENTAR.</p>
          </div>
        </ng-template>

        <!-- LISTA DE COMENTARIOS -->
        <div class="comment-card win-panel" *ngFor="let comment of comments()">
          <div class="comment-header">
            <span><i class="pixelart-icons-font-user"></i> {{comment.authorName}}</span>
            <span>{{comment.createdAt | date:'short'}}</span>
          </div>
          <p>{{comment.content}}</p>
          <div class="comment-actions-row">
            <div class="reactions-left">
              <!-- Placeholder para reacciones en comentarios -->
            </div>
            <div class="translate-right">
              <select class="win-select mini" (change)="translatePost(comment, $event)">
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
        </div>
      </div>
    </div>
  `,
  styles: [`
    .post-details-container { max-width: 900px; margin: 0 auto; padding: 10px; }
    .top-nav { height: 45px; display: flex; align-items: center; margin-bottom: 10px; }
    .post-main { padding: 20px; margin-bottom: 30px; }
    .post-header { display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 15px; }
    .post-header i { margin-right: 5px; }
    
    .featured-image { margin: 20px 0; border: 1px solid #333; max-height: 500px; overflow: hidden; display: flex; justify-content: center; background: #000; }
    .featured-image img { max-width: 100%; height: auto; object-fit: contain; }

    .post-content { margin: 20px 0; line-height: 1.6; white-space: pre-wrap; font-size: 0.95rem; }

    .attachments-list { margin: 20px 0; padding: 15px; background: rgba(0,0,0,0.2); border: 1px solid #222; }
    .win-title.mini { font-size: 0.7rem; margin-bottom: 10px; border-bottom: 1px solid #333; }
    .attachment-items { display: flex; flex-wrap: wrap; gap: 10px; }
    .file-link { padding: 8px 12px; display: flex; align-items: center; gap: 8px; font-size: 0.75rem; color: var(--accent-color); text-decoration: none; }
    .file-link:hover { background: #1a0a00; }

    .comments-section { margin-top: 40px; }
    
    .post-actions-row, .comment-actions-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 15px;
      padding-top: 10px;
      border-top: 1px solid rgba(255,255,255,0.1);
    }

    .reactions-left { display: flex; gap: 10px; }
    
    .comment-input { margin-bottom: 20px; display: flex; flex-direction: column; gap: 10px; padding: 15px; }
    .input-actions { display: flex; justify-content: flex-end; }
    textarea { background: black; border: 1px solid var(--win-border-light); color: var(--accent-color); min-height: 80px; padding: 10px; outline: none; resize: vertical; }
    .comment-card { padding: 15px; margin-bottom: 10px; }
    .comment-header { display: flex; justify-content: space-between; font-size: 0.7rem; color: var(--accent-color); margin-bottom: 10px; font-weight: bold; }
    .comment-header i { margin-right: 5px; }
    .small-text { font-size: 0.7rem; margin-right: 15px; }

    .login-prompt { padding: 20px; text-align: center; font-size: 0.8rem; }
    .login-prompt a { color: var(--accent-color); font-weight: bold; }
    
    .win-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      height: 32px;
      padding: 0 15px;
      font-size: 0.75rem;
    }

    .win-button.small { height: 26px; padding: 0 10px; font-size: 0.65rem; }

    .win-select.mini {
      font-size: 0.7rem;
      padding: 2px 5px;
      height: 22px;
      background-color: var(--win-bg-dark);
      color: var(--accent-color);
      border: 1px solid var(--win-border-light);
    }
  `]
})
export class PostDetailsComponent implements OnInit {
  private location = inject(Location);
  public langService = inject(LanguageService);
  private transService = inject(TranslationService);
  private forumService = inject(ForumService);
  public authService = inject(AuthService);
  private route = inject(ActivatedRoute);

  postId: string = '';
  post = signal<Post | null>(null);
  comments = signal<Comment[]>([]);
  newCommentContent: string = '';
  isSubmittingComment = false;

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.postId = params['postId'];
      if (this.postId) {
        this.loadPost();
        this.loadComments();
      }
    });
  }

  async loadPost() {
    try {
      const data = await this.forumService.getPostById(this.postId);
      this.post.set(data);
    } catch (error) {
      console.error('Error loading post:', error);
    }
  }

  async loadComments() {
    try {
      const res = await this.forumService.getComments(this.postId);
      this.comments.set(res.data);
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  }

  async submitComment() {
    if (!this.newCommentContent.trim()) return;

    this.isSubmittingComment = true;
    try {
      const comment = await this.forumService.createComment(this.postId, this.newCommentContent);
      this.comments.update(prev => [...prev, comment]);
      this.newCommentContent = '';
    } catch (error) {
      console.error('Error creating comment:', error);
    } finally {
      this.isSubmittingComment = false;
    }
  }

  getMainImage(): string | null {
    const img = this.post()?.attachments?.find(a => a.type.startsWith('image/'));
    return img ? img.url : null;
  }

  getOtherAttachments() {
    return this.post()?.attachments?.filter(a => !a.type.startsWith('image/')) || [];
  }

  getFileIcon(type: string): string {
    if (type.includes('pdf')) return 'pixelart-icons-font-file-flash';
    if (type.includes('zip')) return 'pixelart-icons-font-briefcase';
    return 'pixelart-icons-font-file';
  }

  goBack() {
    this.location.back();
  }

  async translatePost(item: any, event: any) {
    const targetLang = event.target.value;
    if (!targetLang) return;

    const originalOptionText = event.target.options[event.target.selectedIndex].text;
    event.target.options[event.target.selectedIndex].text = '...';

    try {
      const currentLang = this.langService.currentLang();
      if (item.content !== undefined) {
        if (!item.originalTitle) item.originalTitle = item.title;
        if (!item.originalContent) item.originalContent = item.content;
        
        item.title = await this.transService.translateText(item.originalTitle, targetLang, currentLang);
        item.content = await this.transService.translateText(item.originalContent, targetLang, currentLang);
      } 
      else if (item.text !== undefined) {
        if (!item.originalText) item.originalText = item.text;
        item.text = await this.transService.translateText(item.originalText, targetLang, currentLang);
      }
    } finally {
      event.target.options[event.target.selectedIndex].text = originalOptionText;
      event.target.value = '';
    }
  }
}
