import { Component, inject, OnInit, signal, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { LanguageService } from '../../core/services/language.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="search-page win-panel">
      <div class="win-title-bar">
        <div class="win-title">{{ langService.translate('ADVANCED_SEARCH') }}</div>
      </div>

      <div class="search-content">
        <!-- BARRA DE BUSQUEDA INTERNA -->
        <div class="search-input-group">
          <input 
            type="text" 
            [(ngModel)]="searchQuery" 
            (keyup.enter)="performSearch()"
            class="win-input" 
            [placeholder]="langService.translate('SEARCH_PLACEHOLDER') || 'Buscar...'"
          >
          <button (click)="performSearch()" class="win-button accent">
            <i class="pixelart-icons-font-search"></i> {{ langService.translate('SEARCH') }}
          </button>
        </div>

        <!-- FILTROS (TABS) -->
        <div class="search-tabs">
          <div 
            class="tab" 
            [class.active]="activeType === 'all'" 
            (click)="setType('all')"
          >
            TODOS
          </div>
          <div 
            class="tab" 
            [class.active]="activeType === 'rooms'" 
            (click)="setType('rooms')"
          >
            ROOMS
          </div>
          <div 
            class="tab" 
            [class.active]="activeType === 'posts'" 
            (click)="setType('posts')"
          >
            POSTS
          </div>
          <div 
            class="tab" 
            [class.active]="activeType === 'voice_chats'" 
            (click)="setType('voice_chats')"
          >
            VOZ
          </div>
        </div>

        <div class="results-container" *ngIf="!isLoading(); else loadingTpl">
          <!-- RESULTADOS DE ROOMS -->
          <section *ngIf="results().rooms.length > 0 && (activeType === 'all' || activeType === 'rooms')">
            <h3 class="section-title">ROOMS ({{ results().rooms.length }})</h3>
            <div class="rooms-grid">
              <div *ngFor="let room of results().rooms" class="room-card win-panel" [routerLink]="['/foro', room.slug]">
                <i [class]="room.icon || 'pixelart-icons-font-door'"></i>
                <div class="room-info">
                  <strong>{{ room.name }}</strong>
                  <p>{{ room.description }}</p>
                </div>
              </div>
            </div>
          </section>

          <!-- RESULTADOS DE POSTS -->
          <section *ngIf="results().posts.length > 0 && (activeType === 'all' || activeType === 'posts')">
            <h3 class="section-title">POSTS ({{ results().posts.length }})</h3>
            <ul class="posts-list">
              <li *ngFor="let post of results().posts" [routerLink]="['/foro', post.roomId, 'post', post._id]">
                <div class="post-header">
                  <strong>{{ post.title }}</strong>
                  <span class="author">{{ '@' }}{{ post.authorName }}</span>
                </div>
                <p class="excerpt">{{ post.content | slice:0:100 }}...</p>
              </li>
            </ul>
          </section>

          <!-- RESULTADOS DE VOZ -->
          <section *ngIf="results().voiceChannels.length > 0 && (activeType === 'all' || activeType === 'voice_chats')">
            <h3 class="section-title">CHATS DE VOZ ({{ results().voiceChannels.length }})</h3>
            <div class="voice-grid">
              <div *ngFor="let vc of results().voiceChannels" class="voice-card win-panel" routerLink="/chats-voz">
                <i class="pixelart-icons-font-audio-device"></i>
                <div class="voice-info">
                  <strong>{{ vc.topic }}</strong>
                  <span class="category">{{ vc.category }}</span>
                </div>
              </div>
            </div>
          </section>

          <!-- SIN RESULTADOS -->
          <div *ngIf="noResults() && !isLoading()" class="no-results win-panel">
            <i class="pixelart-icons-font-info-box"></i>
            <p>No se encontraron resultados para "{{ searchQuery }}"</p>
          </div>
        </div>
      </div>
    </div>

    <ng-template #loadingTpl>
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Buscando en los archivos del sistema...</p>
      </div>
    </ng-template>
  `,
  styles: [`
    .search-page { margin: 20px; min-height: 80vh; display: flex; flex-direction: column; }
    .search-content { padding: 20px; flex-grow: 1; }

    .search-input-group { display: flex; gap: 10px; margin-bottom: 20px; }
    .search-input-group input { flex-grow: 1; font-size: 1.1rem; }

    .search-tabs { display: flex; gap: 5px; border-bottom: 2px solid var(--win-border-dark); margin-bottom: 20px; }
    .tab {
      padding: 8px 16px; cursor: pointer; border: 1px solid var(--win-border-dark);
      border-bottom: none; background: #111; font-size: 0.8rem;
    }
    .tab.active { background: var(--accent-color); color: black; font-weight: bold; }

    .section-title { font-size: 0.9rem; color: var(--accent-color); border-bottom: 1px solid #333; padding-bottom: 5px; margin: 20px 0 10px; }

    .rooms-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
    .room-card { padding: 10px; display: flex; align-items: center; gap: 10px; cursor: pointer; }
    .room-card:hover { background: #1a1a1a; }
    .room-card i { font-size: 2rem; color: var(--accent-color); }
    .room-card p { font-size: 0.7rem; margin: 0; opacity: 0.7; }

    .posts-list { list-style: none; padding: 0; }
    .posts-list li {
      padding: 10px; border: 1px solid #222; margin-bottom: 10px; cursor: pointer; transition: 0.2s;
    }
    .posts-list li:hover { background: #1a0a00; border-color: var(--accent-color); }
    .post-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; }
    .author { font-size: 0.7rem; color: var(--accent-color); }
    .excerpt { font-size: 0.8rem; opacity: 0.8; margin: 0; }

    .voice-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
    .voice-card { padding: 10px; display: flex; align-items: center; gap: 10px; cursor: pointer; }
    .voice-card i { font-size: 1.5rem; color: #00ff00; }
    .category { font-size: 0.6rem; display: block; opacity: 0.6; }

    .no-results { text-align: center; padding: 40px; }
    .loading-state { text-align: center; padding: 40px; }
  `]
})
export class SearchComponent implements OnInit {
  langService = inject(LanguageService);
  route = inject(ActivatedRoute);
  http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);

  searchQuery = '';
  activeType = 'all';
  results = signal<any>({ rooms: [], posts: [], voiceChannels: [], activities: [] });
  isLoading = signal(false);
  private apiUrl = '';

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      // Forzamos el uso del backend en Render
      const baseUrl = 'https://rooms4ums.onrender.com';
      this.apiUrl = `${baseUrl}/api/search`;
    }
  }

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.searchQuery = params['q'] || '';
      if (this.searchQuery) {
        this.performSearch();
      }
    });
  }

  performSearch() {
    if (!this.searchQuery.trim()) return;
    
    this.isLoading.set(true);
    const typeParam = this.activeType === 'all' ? '' : `&type=${this.activeType}`;
    
    this.http.get<any>(`${this.apiUrl}?q=${this.searchQuery}${typeParam}`)
      .subscribe({
        next: (res) => {
          this.results.set(res);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false)
      });
  }

  setType(type: string) {
    this.activeType = type;
    this.performSearch();
  }

  noResults() {
    const res = this.results();
    return res.rooms.length === 0 && res.posts.length === 0 && res.voiceChannels.length === 0;
  }
}
