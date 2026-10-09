import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { LanguageService } from '../../services/language.service';

@Component({
  selector: 'app-activity-bar',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="activity-container">
      
      <!-- MENSAJE PARA INVITADOS -->
      <div class="guest-msg win-panel" *ngIf="!authService.isLoggedIn()">
        <p><i class="pixelart-icons-font-info-box"></i> {{ langService.translate('GUEST_PROMPT') }}</p>
        <button class="win-button small full-width" routerLink="/login">{{ langService.translate('LOGIN') }}</button>
      </div>

      <!-- SECCION VOZ -->
      <div class="activity-section" *ngIf="authService.isLoggedIn()">
        <div class="section-header" (click)="toggleSection('voice')">
          <i [className]="sections.voice ? 'pixelart-icons-font-chevron-down' : 'pixelart-icons-font-chevron-right'"></i>
          <span class="section-title">{{ langService.translate('VOICE_CHANNELS') }}</span>
        </div>
        
        <div class="section-content" *ngIf="sections.voice">
          <button class="win-button full-width" (click)="showCreateForm = !showCreateForm">
            <i class="pixelart-icons-font-plus"></i> {{ langService.translate('NEW') }}
          </button>

          <div class="create-form win-panel" *ngIf="showCreateForm">
            <input type="text" placeholder="NOMBRE..." class="win-input" />
            <button class="win-button small" (click)="showCreateForm = false">CREAR</button>
          </div>

          <div class="channel-card active win-panel" routerLink="/voz/lectura">
            <div class="channel-info">
              <span class="channel-name"><i class="pixelart-icons-font-volume-2"></i> CLUB DE LECTURA</span>
              <span class="user-count"><i class="pixelart-icons-font-users"></i> 14 PERSONAS</span>
            </div>
            <button class="win-button small">UNIRSE</button>
          </div>
        </div>
      </div>

      <!-- SECCION PARTIDAS -->
      <div class="activity-section" *ngIf="authService.isLoggedIn()">
        <div class="section-header" (click)="toggleSection('games')">
          <i [className]="sections.games ? 'pixelart-icons-font-chevron-down' : 'pixelart-icons-font-chevron-right'"></i>
          <span class="section-title">{{ langService.translate('ACTIVE_GAMES') }}</span>
        </div>

        <div class="section-content" *ngIf="sections.games">
          <div class="game-card win-panel" routerLink="/juego/ajedrez-01">
            <div class="players">
              <span><i class="pixelart-icons-font-user"></i> KASPAROV</span>
              <span class="vs">VS</span>
              <span><i class="pixelart-icons-font-user"></i> DEEPBLUE</span>
            </div>
            <div class="game-status"><i class="pixelart-icons-font-clock"></i> MOV: 24</div>
            <button class="win-button small">OBSERVAR</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .activity-container { padding: 10px; }
    .activity-section { margin-bottom: 10px; }
    .section-header {
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      padding: 8px;
      background-color: var(--bg-color);
      border: 1px solid var(--win-border-dark);
      margin-bottom: 5px;
    }
    .section-title {
      font-size: 0.75rem;
      font-weight: bold;
      color: var(--accent-color);
      letter-spacing: 1px;
    }
    .section-header i { color: var(--accent-color); }
    .section-content { padding: 10px 5px; }
    .full-width { width: 100%; margin-bottom: 10px; }
    .create-form { margin-bottom: 10px; padding: 5px; display: flex; flex-direction: column; gap: 5px; }
    .win-input { background: black; border: 1px solid var(--win-border-light); color: var(--accent-color); padding: 5px; font-size: 0.7rem; }
    .channel-card, .game-card { padding: 10px; margin-bottom: 8px; cursor: pointer; }
    .channel-card:hover, .game-card:hover { background-color: #1a0a00; }
    .channel-info, .players { display: flex; flex-direction: column; margin-bottom: 8px; gap: 3px; font-size: 0.75rem; }
    .channel-name { font-weight: bold; color: var(--accent-color); }
    .user-count, .game-status { font-size: 0.7rem; color: var(--text-secondary); }
    .vs { font-size: 0.6rem; color: var(--accent-color); align-self: center; font-weight: bold; }
    .small { font-size: 0.65rem; padding: 4px; }
    .guest-msg { padding: 15px; text-align: center; border-color: var(--accent-color); margin-bottom: 20px; }
    .guest-msg p { font-size: 0.7rem; color: var(--accent-color); margin-bottom: 10px; font-weight: bold; }
  `]
})
export class ActivityBarComponent {
  authService = inject(AuthService);
  langService = inject(LanguageService);
  sections: any = { voice: true, games: true };
  showCreateForm = false;

  toggleSection(name: string) {
    this.sections[name] = !this.sections[name];
  }
}
