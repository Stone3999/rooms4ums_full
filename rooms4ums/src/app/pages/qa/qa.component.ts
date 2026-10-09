import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LanguageService } from '../../core/services/language.service';

@Component({
  selector: 'app-qa',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="qa-container">
      <div class="qa-hero win-panel">
        <h1 class="hero-title">{{ langService.translate('TICKET_CENTER') }} V1.0</h1>
        <p>{{ langService.translate('QA_HERO_DESC') }}</p>
        
        <div class="search-terminal">
          <span class="prompt">></span>
          <input type="text" [placeholder]="langService.translate('QA_SEARCH_PLACEHOLDER')" class="term-input" />
          <span class="cursor">_</span>
        </div>
      </div>

      <div class="qa-content-grid">
        <div class="ticket-list">
          <div class="ticket win-panel">
            <div class="ticket-side-status">
              <span class="status-box solved">{{ langService.translate('SOLVED') }}</span>
              <span class="votes">12<br><small>{{ langService.translate('QA_VOTES') }}</small></span>
            </div>
            
            <div class="ticket-main">
              <div class="ticket-header">
                <span class="ticket-cat">GENERAL</span>
                <span class="ticket-meta">ID: #8821 | 24-03-2026 | &#64;tester_dev</span>
              </div>
              <h2 class="ticket-title">{{ langService.translate('QA_QUESTION_TITLE') }}</h2>
              
              <div class="question-body">
                <p>{{ langService.translate('QA_QUESTION_BODY') }}</p>
              </div>

              <div class="official-response win-panel">
                <div class="resp-header">
                  <i class="pixelart-icons-font-shield"></i>
                  <span>{{ langService.translate('OFFICIAL_RESP') }}</span>
                </div>
                <div class="resp-body">
                  <p>{{ langService.translate('QA_OFFICIAL_RESP_BODY') }}</p>
                  <div class="admin-tag">SYS_OP_02</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside class="qa-sidebar">
          <div class="win-panel sidebar-box">
            <div class="box-title">{{ langService.translate('RESOURCES') }}</div>
            <ul class="resource-links">
              <li><i class="pixelart-icons-font-article"></i> {{ langService.translate('DOCS') }}</li>
              <li><i class="pixelart-icons-font-attachment"></i> {{ langService.translate('USER_MANUAL') }}</li>
            </ul>
          </div>

          <button class="win-button full-width">{{ langService.translate('OPEN_TICKET') }}</button>
        </aside>
      </div>
    </div>
  `,
  styles: [`
    .qa-container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    .qa-hero { background: linear-gradient(135deg, #0a0a0a 0%, #000 100%); padding: 40px; text-align: center; margin-bottom: 40px; border-color: var(--accent-color); }
    .hero-title { font-size: 2.5rem; color: var(--accent-color); margin-bottom: 10px; letter-spacing: 4px; }
    .search-terminal { background-color: #000; border: 1px solid var(--win-border-light); margin: 30px auto 0; max-width: 600px; padding: 10px 20px; display: flex; align-items: center; gap: 10px; }
    .prompt { color: var(--accent-color); font-weight: bold; }
    .term-input { background: transparent; border: none; color: var(--accent-color); flex: 1; font-family: monospace; outline: none; font-size: 1.1rem; }
    .cursor { color: var(--accent-color); animation: blink 1s infinite; }
    @keyframes blink { 50% { opacity: 0; } }
    .qa-content-grid { display: grid; grid-template-columns: 1fr 280px; gap: 30px; }
    .ticket { display: flex; margin-bottom: 30px; background-color: var(--bg-secondary); }
    .ticket-side-status { width: 80px; padding: 15px; border-right: 1px solid var(--win-border-dark); display: flex; flex-direction: column; align-items: center; gap: 20px; }
    .status-box { font-size: 0.6rem; padding: 3px 6px; border: 1px solid; }
    .solved { border-color: #00ff00; color: #00ff00; }
    .votes { text-align: center; font-size: 1.1rem; color: var(--accent-color); }
    .votes small { font-size: 0.6rem; color: var(--text-secondary); }
    .ticket-main { padding: 20px; flex: 1; }
    .ticket-header { display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 0.7rem; }
    .ticket-cat { color: var(--accent-color); font-weight: bold; }
    .ticket-meta { color: var(--text-secondary); }
    .ticket-title { font-size: 1.3rem; margin-bottom: 15px; color: var(--text-primary); }
    .question-body { color: var(--text-secondary); font-size: 0.95rem; margin-bottom: 25px; line-height: 1.6; }
    .official-response { border-left: 3px solid var(--accent-color); background-color: #050505; padding: 20px; }
    .resp-header { display: flex; align-items: center; gap: 10px; color: var(--accent-color); font-weight: bold; font-size: 0.8rem; margin-bottom: 10px; }
    .resp-body p { font-size: 0.9rem; line-height: 1.5; }
    .admin-tag { margin-top: 15px; text-align: right; font-size: 0.7rem; color: var(--accent-color); }
    .sidebar-box { padding: 15px; margin-bottom: 20px; }
    .box-title { font-weight: bold; border-bottom: 1px solid var(--accent-color); padding-bottom: 8px; margin-bottom: 15px; font-size: 0.8rem; color: var(--accent-color); }
    .resource-links { list-style: none; }
    .resource-links li { padding: 10px 0; font-size: 0.8rem; cursor: pointer; display: flex; align-items: center; gap: 10px; }
    .resource-links li:hover { color: var(--accent-color); }
    .full-width { width: 100%; padding: 12px; }
  `]
})
export class QaComponent {
  public langService = inject(LanguageService);
}
