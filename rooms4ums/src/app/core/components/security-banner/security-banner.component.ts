import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { LanguageService } from '../../services/language.service';

@Component({
  selector: 'app-security-banner',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="showBanner()" class="security-banner win-panel">
      <div class="banner-content">
        <i class="pixelart-icons-font-shield-off alert-icon"></i>
        <div class="text-group">
          <span class="main-text">{{ langService.translate('BANNER_TEXT') }}</span>
          <span class="sub-text">{{ langService.translate('CONFIG_ACCOUNT') }}</span>
        </div>
      </div>
      <div class="banner-actions">
        <button (click)="goToSettings()" class="win-button primary mini-btn">
          {{ langService.translate('BANNER_BTN') }}
        </button>
        <button (click)="closeBanner()" class="close-btn">
          <i class="pixelart-icons-font-close"></i>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .security-banner {
      background-color: #000;
      border: 2px solid #ff0000 !important;
      color: #ff0000;
      padding: 15px 25px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 15px;
      box-shadow: 0 0 15px rgba(255, 0, 0, 0.2);
      animation: slideIn 0.5s ease, blink border 2s infinite;
    }

    .banner-content {
      display: flex;
      align-items: center;
      gap: 20px;
    }

    .alert-icon {
      font-size: 2rem;
      animation: blink 1s infinite;
    }

    .text-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .main-text {
      font-weight: bold;
      font-size: 0.9rem;
      letter-spacing: 1px;
    }

    .sub-text {
      font-size: 0.65rem;
      color: #ff5555;
    }

    .banner-actions {
      display: flex;
      align-items: center;
      gap: 15px;
    }

    .mini-btn {
      font-size: 0.7rem !important;
      padding: 8px 15px !important;
      background: #ff0000 !important;
      color: #000 !important;
      border-color: #ff0000 !important;
    }

    .close-btn {
      background: none;
      border: none;
      cursor: pointer;
      color: #ff0000;
      font-size: 1rem;
      display: flex;
      align-items: center;
      opacity: 0.7;
    }

    .close-btn:hover { opacity: 1; }

    @keyframes slideIn { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    @keyframes blink { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }
  `]
})
export class SecurityBannerComponent {
  private router = inject(Router);
  public langService = inject(LanguageService);
  
  showBanner = signal(true);

  goToSettings() {
    this.router.navigate(['/perfil']);
  }

  closeBanner() {
    this.showBanner.set(false);
  }
}
