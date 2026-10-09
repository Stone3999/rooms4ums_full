import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { LanguageService } from '../../core/services/language.service';

@Component({
  selector: 'app-game-view',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="game-view-wrapper">
      @if (!activeGameId()) {
        <!-- MODO SELECCIÓN DE ACTIVIDADES -->
        <div class="selection-mode">
          <div class="header-row">
            <h2 class="win-title">{{ langService.translate('ACTIVITIES') }} - {{ roomId | uppercase }}</h2>
            <div class="filters">
              <button class="win-button mini" [class.active]="filter() === 'all'" (click)="filter.set('all')">TODAS</button>
              <button class="win-button mini" [class.active]="filter() === 'open'" (click)="filter.set('open')">DISPONIBLES</button>
            </div>
          </div>

          <div class="activities-grid">
            @for (act of filteredActivities(); track act.id) {
              <div class="activity-card win-panel" [class.full]="act.players >= act.maxPlayers">
                <div class="card-header">
                  <i [class]="act.icon" class="card-icon"></i>
                  <span class="card-name">{{ act.name }}</span>
                </div>
                <div class="card-body">
                  <div class="player-count">
                    <span class="label">USUARIOS:</span>
                    <span class="value">{{ act.players }} / {{ act.maxPlayers }}</span>
                  </div>
                  <div class="status-bar">
                    <div class="fill" [style.width.%]="(act.players / act.maxPlayers) * 100"></div>
                  </div>
                </div>
                <div class="card-footer">
                  @if (act.players < act.maxPlayers) {
                    <button class="win-button mini" (click)="joinGame(act.id)">UNIRSE</button>
                  } @else {
                    <span class="full-msg">SALA LLENA</span>
                  }
                </div>
              </div>
            }
          </div>

          <!-- SECCIÓN USUARIOS CONECTADOS -->
          <h2 class="win-title" style="margin-top: 40px;">USUARIOS EN ESTA SALA</h2>
          <div class="users-grid">
            @for (user of users; track user.id) {
              <div class="user-card win-panel">
                <i class="pixelart-icons-font-user"></i>
                <span>{{ user.name }}</span>
                <span class="status-dot" [class.online]="user.online"></span>
              </div>
            }
          </div>
        </div>
      } @else {
        <!-- MODO JUEGO ACTIVO -->
        <div class="game-container">
          <div class="game-header">
            <button class="win-button" (click)="activeGameId.set(null)">
              <i class="pixelart-icons-font-arrow-left"></i> VOLVER
            </button>
            <h1 class="win-title">PARTIDA: {{ activeGameId() }}</h1>
          </div>

          <div class="game-layout">
            <div class="board-area win-panel">
              <div class="chess-board-mock">
                <div class="row" *ngFor="let row of [8,7,6,5,4,3,2,1]">
                  <div class="cell" *ngFor="let col of ['A','B','C','D','E','F','G','H']" 
                       [class.dark]="isDark(row, col)"></div>
                </div>
              </div>
              <p class="chess-tip">(IMPLEMENTANDO NGX-CHESS-BOARD...)</p>
            </div>

            <div class="control-panel win-panel">
              <h3 class="win-title">CONTROLES</h3>
              <div class="game-actions">
                <button class="win-button full-width">RENDIRSE</button>
                <button class="win-button full-width">PROPONER TABLAS</button>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .game-view-wrapper { padding: 20px; }
    
    .header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .filters { display: flex; gap: 10px; }
    .win-button.mini.active { background: var(--accent-color); color: #000; }

    /* GRID */
    .activities-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 20px;
    }
    .activity-card {
      padding: 15px;
      background: #050505;
      transition: all 0.2s;
    }
    .activity-card:hover:not(.full) {
      border-color: var(--accent-color);
      transform: translateY(-3px);
    }
    .activity-card.full { opacity: 0.6; border-color: #333; }

    .card-header { display: flex; align-items: center; gap: 10px; margin-bottom: 15px; }
    .card-icon { color: var(--accent-color); font-size: 1.2rem; }
    .card-name { font-weight: bold; font-size: 0.8rem; }

    .player-count { display: flex; justify-content: space-between; font-size: 0.6rem; margin-bottom: 5px; }
    .status-bar { height: 4px; background: #222; width: 100%; border: 1px solid #333; }
    .status-bar .fill { height: 100%; background: var(--accent-color); }

    .card-footer { margin-top: 15px; display: flex; justify-content: flex-end; }
    .full-msg { font-size: 0.6rem; color: #ff0000; font-weight: bold; }

    /* USERS */
    .users-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
    .user-card { display: flex; align-items: center; gap: 10px; padding: 8px 12px; font-size: 0.7rem; background: #000; }
    .status-dot { width: 6px; height: 6px; border-radius: 50%; background: #555; margin-left: auto; }
    .status-dot.online { background: #00ff00; box-shadow: 0 0 5px #00ff00; }

    /* GAME MODE */
    .game-container { display: flex; flex-direction: column; gap: 20px; }
    .game-header { display: flex; align-items: center; gap: 20px; }
    .game-layout { display: flex; gap: 20px; min-height: 400px; }
    .board-area { flex: 2; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #111; }
    .chess-board-mock { width: 320px; height: 320px; border: 2px solid var(--accent-color); display: grid; grid-template-rows: repeat(8, 1fr); }
    .row { display: grid; grid-template-columns: repeat(8, 1fr); }
    .cell { background: #333; }
    .cell.dark { background: #1a1a1a; }
    .chess-tip { font-size: 0.6rem; color: var(--text-secondary); margin-top: 10px; }
    .control-panel { flex: 1; padding: 20px; }
    .full-width { width: 100%; }
  `]
})
export class GameViewComponent implements OnInit {
  public langService = inject(LanguageService);
  private route = inject(ActivatedRoute);

  roomId: string = '';
  activeGameId = signal<string | null>(null);
  filter = signal<'all' | 'open'>('all');

  activities = [
    { id: 'chess-1', name: 'AJEDREZ PRO', icon: 'pixelart-icons-font-gamepad', players: 1, maxPlayers: 2 },
    { id: 'chess-2', name: 'TORNEO NOOBS', icon: 'pixelart-icons-font-gamepad', players: 2, maxPlayers: 2 },
    { id: 'read-1', name: 'DEBATE FILOSÓFICO', icon: 'pixelart-icons-font-article', players: 5, maxPlayers: 10 },
    { id: 'dev-1', name: 'PAIR PROGRAMMING', icon: 'pixelart-icons-font-code', players: 0, maxPlayers: 2 }
  ];

  users = [
    { id: 1, name: 'USER_X', online: true },
    { id: 2, name: 'DEV_GURU', online: true },
    { id: 3, name: 'BOLT_99', online: false },
    { id: 4, name: 'CYBER_PUNK', online: true }
  ];

  ngOnInit() {
    this.route.parent?.params.subscribe(params => {
      this.roomId = params['id'] || 'GENERAL';
    });
  }

  filteredActivities() {
    if (this.filter() === 'open') {
      return this.activities.filter(a => a.players < a.maxPlayers);
    }
    return this.activities;
  }

  joinGame(id: string) {
    this.activeGameId.set(id);
  }

  isDark(row: number, col: string) {
    const colIdx = col.charCodeAt(0) - 65;
    return (row + colIdx) % 2 === 0;
  }
}
