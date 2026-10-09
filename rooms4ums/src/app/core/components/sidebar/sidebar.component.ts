import { Component, inject, OnInit, signal, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { LanguageService } from '../../services/language.service';
import { RoomService, Room } from '../../services/room.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <nav class="sidebar-nav" [class.collapsed]="isCollapsed">
      <!-- BOTON INICIO -->
      <div class="nav-item-standalone" routerLink="/inicio" routerLinkActive="active" [title]="langService.translate('HOME')">
        <i class="pixelart-icons-font-home"></i>
        <span class="section-title" *ngIf="!isCollapsed">INICIO</span>
      </div>

      <!-- SECCION FEEDS -->
      <div class="nav-section">
        <div class="section-header" (click)="toggleSection('feeds')" *ngIf="!isCollapsed">
          <i [className]="sections['feeds'] ? 'pixelart-icons-font-chevron-down' : 'pixelart-icons-font-chevron-right'"></i>
          <span class="section-title">FEEDS</span>
        </div>
        
        <ul *ngIf="sections['feeds'] || isCollapsed">
          <li routerLink="/popular" routerLinkActive="active" [title]="langService.translate('POPULAR')">
            <i class="pixelart-icons-font-trending-up"></i> 
            <span *ngIf="!isCollapsed">{{ langService.translate('POPULAR') }}</span>
          </li>
          <li routerLink="/recientes" routerLinkActive="active" [title]="langService.translate('RECIENTES')">
            <i class="pixelart-icons-font-clock"></i> 
            <span *ngIf="!isCollapsed">{{ langService.translate('RECIENTES') }}</span>
          </li>
          <li routerLink="/chats-voz" routerLinkActive="active" [title]="langService.translate('VOICE_CHATS')">
            <i class="pixelart-icons-font-audio-device"></i> 
            <span *ngIf="!isCollapsed">{{ langService.translate('VOICE_CHATS') }}</span>
          </li>
        </ul>
      </div>

      <!-- SECCION MIS COMUNIDADES -->
      <div class="nav-section" *ngIf="!isCollapsed">
        <div class="section-header" (click)="toggleSection('communities')">
          <i [className]="sections['communities'] ? 'pixelart-icons-font-chevron-down' : 'pixelart-icons-font-chevron-right'"></i>
          <span class="section-title">MIS COMUNIDADES</span>
        </div>
        <ul *ngIf="sections['communities']">
          <li *ngFor="let room of rooms()" [routerLink]="['/foro', room.slug]" routerLinkActive="active">
            <i [class]="room.icon || 'pixelart-icons-font-door'"></i> {{ room.name | uppercase }}
          </li>
        </ul>
      </div>

      <!-- SECCION SISTEMA -->
      <div class="nav-section">
        <div class="section-header" (click)="toggleSection('system')" *ngIf="!isCollapsed">
          <i [className]="sections['system'] ? 'pixelart-icons-font-chevron-down' : 'pixelart-icons-font-chevron-right'"></i>
          <span class="section-title">SISTEMA</span>
        </div>
        <ul *ngIf="sections['system'] || isCollapsed">
          <li routerLink="/help" routerLinkActive="active" [title]="langService.translate('HELP')">
            <i class="pixelart-icons-font-info-box"></i> 
            <span *ngIf="!isCollapsed">{{ langService.translate('HELP') }}</span>
          </li>
          <li routerLink="/rules" routerLinkActive="active" [title]="langService.translate('RULES')">
            <i class="pixelart-icons-font-file"></i> 
            <span *ngIf="!isCollapsed">{{ langService.translate('RULES') }}</span>
          </li>
        </ul>
      </div>
    </nav>
  `,
  styles: [`
    .sidebar-nav { padding: 15px; transition: all 0.3s ease; }
    .sidebar-nav.collapsed { padding: 15px 5px; display: flex; flex-direction: column; align-items: center; }
    
    .nav-section { margin-bottom: 20px; width: 100%; }
    
    .nav-item-standalone, .section-header {
      display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 10px;
      background-color: #050505; border: 1px solid var(--win-border-dark); margin-bottom: 8px;
    }
    .collapsed .nav-item-standalone { justify-content: center; padding: 10px 0; }

    .section-title { font-size: 0.7rem; font-weight: bold; color: var(--accent-color); letter-spacing: 2px; }
    
    ul { list-style: none; padding-left: 10px; }
    .collapsed ul { padding-left: 0; width: 100%; }

    li {
      padding: 10px 12px; cursor: pointer; color: var(--text-primary);
      display: flex; align-items: center; gap: 12px; font-size: 0.75rem;
      border-left: 2px solid transparent; margin-bottom: 2px;
    }
    .collapsed li { justify-content: center; padding: 12px 0; border-left: none; border-bottom: 2px solid transparent; }
    .collapsed li.active { border-left: none; border-bottom: 2px solid var(--accent-color); background: #1a0a00; }

    li i { color: var(--accent-color); width: 16px; text-align: center; font-size: 1.1rem; }
    li.active { border-left: 2px solid var(--accent-color); background-color: #1a0a00; color: var(--accent-color); }
  `]
})
export class SidebarComponent implements OnInit {
  @Input() isCollapsed = false;
  authService = inject(AuthService);
  langService = inject(LanguageService);
  roomService = inject(RoomService);
  
  rooms = signal<Room[]>([]);
  sections: Record<string, boolean> = {
    feeds: true,
    communities: true,
    system: true
  };

  async ngOnInit() {
    try {
      const data = await this.roomService.getActiveRooms();
      this.rooms.set(data);
    } catch (error) {
      console.error('Error loading rooms for sidebar:', error);
    }
  }

  toggleSection(name: string) {
    this.sections[name] = !this.sections[name];
  }
}
