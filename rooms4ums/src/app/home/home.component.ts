import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { LanguageService } from '../core/services/language.service';
import { RoomService, Room } from '../core/services/room.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="home-container">
      <h1 class="win-title">{{ langService.translate('SELECTOR_ROOMS') }}</h1>
      
      <div class="doors-grid">
        <!-- PUERTAS DINÁMICAS -->
        <div *ngFor="let room of rooms()" 
             class="door" 
             [class.maintenance]="room.status === 'MAINTENANCE'"
             [class.construction]="room.status === 'CONSTRUCTION'"
             (click)="enterRoom(room)">
          
          <div class="door-inner">
            <div class="door-knob"></div>
            <i class="door-icon" [class]="room.icon || 'pixelart-icons-font-door'"></i>
            <div class="door-label">{{ room.name }}</div>
            
            <div class="status-overlay" *ngIf="room.status !== 'ACTIVE'">
              <i [class]="room.status === 'MAINTENANCE' ? 'pixelart-icons-font-gear' : 'pixelart-icons-font-flask'" class="status-icon"></i>
              <span class="status-text">{{ room.status }}</span>
            </div>

            <div class="interactive-tag" *ngIf="room.is_interactive && room.status === 'ACTIVE'">
              {{ langService.translate('INTERACTIVE_PROTOCOL') }}
            </div>
          </div>
        </div>

        <!-- Mensaje si no hay rooms -->
        <div *ngIf="rooms().length === 0" class="no-data win-panel">
          <p>ERROR: NO SE ENCONTRARON CLÚSTERS DE DATOS ACTIVOS.</p>
          <p>SISTEMA EN ESPERA DE INICIALIZACIÓN.</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .home-container { display: flex; flex-direction: column; align-items: center; padding: 40px 20px; }
    .doors-grid { display: flex; flex-wrap: wrap; justify-content: center; gap: 40px; width: 100%; max-width: 1200px; margin-top: 20px; }
    
    .door { min-width: 180px; height: 280px; border: 3px solid var(--accent-color); position: relative; cursor: pointer; transition: all 0.2s; background: linear-gradient(135deg, #0a0a0a 0%, #000 100%); padding: 5px; }
    .door-inner { height: 100%; border: 1px solid var(--win-border-light); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; position: relative; }
    .door-knob { position: absolute; right: 15px; top: 50%; width: 12px; height: 12px; background-color: var(--accent-color); border-radius: 2px; border: 1px solid black; }
    .door-icon { font-size: 4rem; color: var(--accent-color); }
    .door-label { color: var(--accent-color); font-weight: bold; text-align: center; font-size: 1.1rem; text-transform: uppercase; letter-spacing: 1px; }
    .door:hover:not(.maintenance):not(.construction) { background-color: #1a0a00; box-shadow: 0 0 20px var(--accent-color); transform: translateY(-5px); }

    .maintenance, .construction { border-color: #555; cursor: not-allowed; filter: grayscale(0.8); opacity: 0.7; }
    .status-overlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 10; gap: 10px; }
    .status-icon { font-size: 2.5rem; color: #fff; }
    .status-text { background: #ff0000; color: white; font-size: 0.7rem; padding: 4px 10px; font-weight: bold; transform: rotate(-15deg); border: 2px solid white; }
    .construction .status-text { background: #ff8c00; }
    .interactive-tag { background-color: var(--accent-color); color: #000; font-size: 0.5rem; padding: 2px 4px; font-weight: bold; position: absolute; bottom: 15px; width: 90%; text-align: center; }
    
    .no-data { padding: 30px; text-align: center; color: #ff0000; border-color: #ff0000; }
  `]
})
export class HomeComponent implements OnInit {
  public langService = inject(LanguageService);
  private roomService = inject(RoomService);
  private router = inject(Router);

  rooms = signal<Room[]>([]);

  async ngOnInit() {
    try {
      const data = await this.roomService.getActiveRooms();
      this.rooms.set(data);
    } catch (error) {
      console.error('Error loading rooms:', error);
    }
  }

  enterRoom(room: Room) {
    if (room.status !== 'ACTIVE') return;
    this.router.navigate(['/foro', room.slug]);
  }
}
