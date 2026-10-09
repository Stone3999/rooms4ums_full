import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LanguageService } from '../../core/services/language.service';

@Component({
  selector: 'app-help',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="help-container">
      <h1 class="win-title">{{ langService.translate('SYS_ASSIST') }} V1.0</h1>
      
      <div class="terminal-intro win-panel">
        <p>{{ langService.translate('HELP_TERM_INTRO') }}</p>
      </div>

      <div class="command-grid">
        @for (item of helpItems; track item.title) {
          <div class="command-box win-panel" 
               (click)="selectItem(item)" 
               [class.active]="selectedItem()?.title === item.title">
            <div class="cmd-icon"><i [class]="'pixelart-icons-font-' + item.icon"></i></div>
            <div class="cmd-info">
              <span class="cmd-name">{{item.title}}</span>
              <p class="cmd-desc">{{item.desc}}</p>
            </div>
          </div>
        }
      </div>

      <!-- Detalle interactivo tipo consola -->
      @if (selectedItem()) {
        <div class="command-detail win-panel">
          <div class="detail-header">
            <i class="pixelart-icons-font-terminal"></i> 
            {{ langService.translate('EXECUTING') }}: HELP_{{ selectedItem()?.title }}
          </div>
          <div class="detail-content">
            <p class="typing-text">> {{ selectedItem()?.longDesc }}</p>
            <div class="detail-actions">
              <button class="win-button small" (click)="selectedItem.set(null)">{{ langService.translate('CLOSE_PROCESS') }}</button>
            </div>
          </div>
        </div>
      }

      <div class="action-section win-panel">
        <div class="action-header">{{ langService.translate('NEED_HELP') }}</div>
        <p>{{ langService.translate('HELP_MORE_HELP_DESC') }}</p>
        <button class="win-button" routerLink="/qa">{{ langService.translate('GO_SUPPORT') }}</button>
      </div>
    </div>
  `,
  styles: [`
    .help-container { max-width: 900px; margin: 0 auto; padding: 20px; }
    .terminal-intro { background-color: #050505; padding: 15px; margin-bottom: 30px; border-left: 4px solid var(--accent-color); font-family: monospace; color: var(--accent-color); font-size: 0.9rem; }
    .command-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .command-box { display: flex; padding: 20px; gap: 20px; background-color: var(--bg-secondary); cursor: pointer; transition: transform 0.1s; }
    .command-box:hover { transform: translateY(-2px); border-color: var(--accent-color); }
    .command-box.active { background-color: #1a0a00; border-color: var(--accent-color); }
    .cmd-icon { font-size: 2rem; color: var(--accent-color); display: flex; align-items: center; }
    .cmd-name { display: block; font-weight: bold; color: var(--accent-color); margin-bottom: 5px; text-transform: uppercase; letter-spacing: 1px; }
    .cmd-desc { font-size: 0.85rem; color: var(--text-secondary); line-height: 1.4; }
    
    .command-detail { margin-top: 30px; border-color: var(--accent-color); background-color: #000; animation: fadeIn 0.3s ease-out; }
    .detail-header { background-color: var(--accent-color); color: #000; padding: 5px 15px; font-weight: bold; font-size: 0.8rem; display: flex; align-items: center; gap: 10px; }
    .detail-content { padding: 20px; font-family: 'Courier New', Courier, monospace; }
    .typing-text { color: #00ff00; font-size: 0.9rem; margin-bottom: 20px; }
    .detail-actions { display: flex; justify-content: flex-end; }

    .action-section { margin-top: 40px; padding: 30px; text-align: center; border-color: var(--accent-color); }
    .action-header { font-weight: bold; color: var(--accent-color); margin-bottom: 15px; font-size: 1.2rem; }
    
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    @media (max-width: 600px) { .command-grid { grid-template-columns: 1fr; } }
  `]
})
export class HelpComponent {
  public langService = inject(LanguageService);
  selectedItem = signal<any>(null);

  get helpItems() {
    return [
      { 
        icon: 'grid', 
        title: this.langService.translate('SELECTOR_ROOMS'), 
        desc: this.langService.translate('HELP_ROOMS_DESC'),
        longDesc: this.langService.translate('HELP_ROOMS_LONG')
      },
      { 
        icon: 'message-text', 
        title: this.langService.translate('NEW_MESSAGE'), 
        desc: this.langService.translate('HELP_POSTS_DESC'),
        longDesc: this.langService.translate('HELP_POSTS_LONG')
      },
      { 
        icon: 'volume-2', 
        title: this.langService.translate('VOICE_CHANNELS'), 
        desc: this.langService.translate('HELP_VOICE_DESC'),
        longDesc: this.langService.translate('HELP_VOICE_LONG')
      },
      { 
        icon: 'camera', 
        title: 'Multimedia', 
        desc: this.langService.translate('HELP_MEDIA_DESC'),
        longDesc: this.langService.translate('HELP_MEDIA_LONG')
      }
    ];
  }

  selectItem(item: any) {
    this.selectedItem.set(item);
  }
}
