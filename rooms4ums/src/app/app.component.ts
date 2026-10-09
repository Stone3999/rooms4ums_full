import { Component, HostListener, inject } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { HeaderComponent } from './core/components/header/header.component';
import { SidebarComponent } from './core/components/sidebar/sidebar.component';
import { ActivityBarComponent } from './core/components/activity-bar/activity-bar.component';
import { NotificationsComponent } from './core/components/notifications/notifications.component';
import { CommonModule } from '@angular/common';
import { SoundService } from './core/services/sound.service';
import { SeasonalThemeService } from './core/services/seasonal-theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, SidebarComponent, ActivityBarComponent, NotificationsComponent, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  private soundService = inject(SoundService);
  private router = inject(Router);
  private seasonalTheme = inject(SeasonalThemeService);
  
  isSidebarOpen = true;
  isActivityBarOpen = false;

  @HostListener('click', ['$event'])
  onClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.closest('button') || target.closest('.win-button') || target.closest('a') || target.closest('.door')) {
      this.soundService.playClick();
    }
  }

  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  isHomeRoute() {
    return this.router.url === '/inicio';
  }

  showShell() {
    const hiddenRoutes = ['/', '/login', '/register'];
    return !hiddenRoutes.includes(this.router.url);
  }
}
