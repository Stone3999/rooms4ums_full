import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { LanguageService, Language } from '../../core/services/language.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
  ],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css'
})
export class LandingComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  public langService = inject(LanguageService);

  constructor() {
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/inicio']);
    }
  }

  changeLang(event: any) {
    this.langService.setLanguage(event.target.value as Language);
  }

  get features() {
    return [
      {
        icon: 'pixelart-icons-font-shield',
        title: this.langService.translate('SEC_TITLE'),
        description: this.langService.translate('SEC_DESC'),
      },
      {
        icon: 'pixelart-icons-font-zap',
        title: this.langService.translate('PERF_TITLE'),
        description: this.langService.translate('PERF_DESC'),
      },
      {
        icon: 'pixelart-icons-font-users',
        title: this.langService.translate('COMM_TITLE'),
        description: this.langService.translate('COMM_DESC'),
      },
      {
        icon: 'pixelart-icons-font-cloud',
        title: this.langService.translate('CLOUD_TITLE'),
        description: this.langService.translate('CLOUD_DESC'),
      },
      {
        icon: 'pixelart-icons-font-chart-bar',
        title: this.langService.translate('ANALYTICS_TITLE'),
        description: this.langService.translate('ANALYTICS_DESC'),
      },
      {
        icon: 'pixelart-icons-font-headset',
        title: this.langService.translate('SUPPORT_TITLE'),
        description: this.langService.translate('SUPPORT_DESC'),
      },
    ];
  }
}
