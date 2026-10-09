import { Component, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { LanguageService, Language } from '../../services/language.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <header class="header win-panel">
      <div class="left-section">
        <button class="win-button menu-btn" (click)="toggleSidebar()">
          <i class="pixelart-icons-font-menu"></i>
        </button>
        <span class="logo-text" routerLink="/inicio">ROOMS<span class="accent">4</span>UMS</span>
      </div>
      
      <div class="center-section">
        <div class="search-bar">
          <i class="pixelart-icons-font-search"></i>
          <input 
            type="text" 
            [placeholder]="langService.translate('SEARCH_PLACEHOLDER') || 'BUSCAR...'" 
            class="win-input" 
            (keyup.enter)="onSearch($event)"
          />
        </div>

        <!-- SELECTOR DE IDIOMA RETRO -->
        <div class="lang-selector">
          <i class="pixelart-icons-font-world"></i>
          <select class="win-select" (change)="changeLang($event)">
            <option value="es" [selected]="langService.currentLang() === 'es'">ES</option>
            <option value="en" [selected]="langService.currentLang() === 'en'">EN</option>
            <option value="fr" [selected]="langService.currentLang() === 'fr'">FR</option>
            <option value="jp" [selected]="langService.currentLang() === 'jp'">JP</option>
            <option value="it" [selected]="langService.currentLang() === 'it'">IT</option>
            <option value="pt" [selected]="langService.currentLang() === 'pt'">PT</option>
          </select>
        </div>
      </div>

      <div class="user-actions">
        <!-- LOGGED IN -->
        <ng-container *ngIf="authService.isLoggedIn()">
          <button class="win-button" routerLink="/perfil">
            <i class="pixelart-icons-font-user"></i> {{ langService.translate('PROFILE') }}
          </button>
          <button class="win-button" routerLink="/admin" *ngIf="authService.isAdmin()">
            <i class="pixelart-icons-font-command"></i> {{ langService.translate('ADMIN') }}
          </button>
          <button class="win-button" (click)="logout()">
            <i class="pixelart-icons-font-logout"></i> {{ langService.translate('LOGOUT') }}
          </button>
        </ng-container>

        <!-- LOGGED OUT -->
        <ng-container *ngIf="!authService.isLoggedIn()">
          <button class="win-button" routerLink="/login">
            <i class="pixelart-icons-font-user"></i> {{ langService.translate('LOGIN') }}
          </button>
          <button class="win-button" routerLink="/register">
            <i class="pixelart-icons-font-user-plus"></i> {{ langService.translate('REGISTER') }}
          </button>
        </ng-container>
      </div>
    </header>
  `,
  styles: [`
    .header {
      height: var(--header-height);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 10px;
    }
    .left-section {
      display: flex;
      align-items: center;
      gap: 15px;
    }
    .logo-text {
      font-size: 1.5rem;
      font-weight: bold;
      color: var(--accent-color);
      cursor: pointer;
    }
    .accent { color: var(--text-primary); }
    
    .center-section {
      display: flex;
      align-items: center;
      gap: 20px;
    }

    .search-bar {
      display: flex;
      align-items: center;
      gap: 10px;
      background-color: #000;
      border: 1px solid var(--win-border-light);
      padding: 0 10px;
    }
    .search-bar i { color: var(--accent-color); }
    
    .win-input {
      background-color: transparent;
      border: none;
      color: var(--accent-color);
      padding: 8px 5px;
      width: 180px;
      outline: none;
    }

    /* Select retro */
    .lang-selector {
      display: flex;
      align-items: center;
      gap: 5px;
      color: var(--accent-color);
    }
    .win-select {
      background-color: #000;
      color: var(--accent-color);
      border: 1px solid var(--win-border-light);
      font-family: inherit;
      font-size: 0.75rem;
      padding: 4px;
      outline: none;
      cursor: pointer;
    }

    .user-actions {
      display: flex;
      gap: 8px;
    }
    @media (max-width: 900px) {
      .search-bar { display: none; }
    }
  `]
})
export class HeaderComponent {
  authService = inject(AuthService);
  langService = inject(LanguageService);
  router = inject(Router);
  @Output() onToggleSidebar = new EventEmitter<void>();

  toggleSidebar() {
    this.onToggleSidebar.emit();
  }

  async logout() {
    await this.authService.logout();
    this.router.navigate(['/']);
  }

  changeLang(event: any) {
    this.langService.setLanguage(event.target.value as Language);
  }

  onSearch(event: any) {
    const query = event.target.value;
    if (query?.trim()) {
      this.router.navigate(['/buscar'], { queryParams: { q: query.trim() } });
      event.target.value = ''; // Limpiar input después de buscar
    }
  }
}
