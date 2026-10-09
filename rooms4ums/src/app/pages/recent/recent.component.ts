import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-recent',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="recent-container">
      <h1>{{ 'RECIENTES' }}</h1>
      <p>Aquí se mostrarán los posts más nuevos de la comunidad.</p>
    </div>
  `,
  styles: [`
    .recent-container {
      padding: 20px;
      color: var(--text-primary);
    }
    h1 { color: var(--accent-color); font-family: 'PixelArt', sans-serif; }
  `]
})
export class RecentComponent {}
