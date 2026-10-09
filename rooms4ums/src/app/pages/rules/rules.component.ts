import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LanguageService } from '../../core/services/language.service';

@Component({
  selector: 'app-rules',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="rules-container">
      <div class="warning-banner win-panel">
        <i class="pixelart-icons-font-alert"></i>
        <span>{{ langService.translate('RULES_BANNER') }}</span>
        <i class="pixelart-icons-font-alert"></i>
      </div>

      <h1 class="win-title main-title">{{ langService.translate('RULES_TITLE') }} V1.0</h1>

      <div class="rules-grid">
        <div class="rule-card win-panel" *ngFor="let rule of rulesList">
          <div class="rule-header">
            <span class="rule-id">{{rule.id}}</span>
            <span class="rule-name">{{rule.name}}</span>
          </div>
          <div class="rule-body">
            <p>{{rule.description}}</p>
            <div class="rule-consequence" *ngIf="rule.consequence">
              <span class="label">{{ langService.translate('RULE_SANCTION') }}:</span> {{rule.consequence}}
            </div>
          </div>
        </div>
      </div>

      <div class="footer-note win-panel">
        {{ langService.translate('RULES_FOOTER') }}
      </div>
    </div>
  `,
  styles: [`
    .rules-container { max-width: 1000px; margin: 0 auto; padding: 20px; animation: scanline 5s linear infinite; }
    .warning-banner { background-color: #ff0000; color: white; padding: 10px; text-align: center; font-weight: bold; display: flex; justify-content: center; align-items: center; gap: 20px; margin-bottom: 30px; border: 3px solid white; }
    .main-title { font-size: 2rem; text-align: center; display: block; margin: 0 auto 40px; width: fit-content; }
    .rules-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 25px; }
    .rule-card { transition: all 0.3s; border-color: var(--win-border-light); }
    .rule-card:hover { border-color: var(--accent-color); transform: scale(1.02); box-shadow: 0 0 15px rgba(255, 140, 0, 0.2); }
    .rule-header { background-color: var(--bg-secondary); padding: 8px 15px; display: flex; align-items: center; gap: 15px; border-bottom: 2px solid var(--win-border-dark); }
    .rule-id { color: var(--accent-color); font-family: monospace; font-weight: bold; font-size: 1.2rem; }
    .rule-name { font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
    .rule-body { padding: 20px; }
    .rule-body p { color: var(--text-secondary); font-size: 0.9rem; line-height: 1.6; margin-bottom: 15px; }
    .rule-consequence { background-color: #1a0000; padding: 8px; border-left: 3px solid #ff0000; font-size: 0.75rem; color: #ffaaaa; }
    .rule-consequence .label { font-weight: bold; color: #ff0000; }
    .footer-note { margin-top: 50px; text-align: center; padding: 15px; color: var(--accent-color); font-size: 0.8rem; border-style: dashed; }
  `]
})
export class RulesComponent {
  public langService = inject(LanguageService);

  get rulesList() {
    return [
      { id: '0x01', name: this.langService.translate('RULE_1_NAME'), description: this.langService.translate('RULE_1_DESC'), consequence: this.langService.translate('RULE_1_CONS') },
      { id: '0x02', name: this.langService.translate('RULE_2_NAME'), description: this.langService.translate('RULE_2_DESC'), consequence: this.langService.translate('RULE_2_CONS') },
      { id: '0x03', name: this.langService.translate('RULE_3_NAME'), description: this.langService.translate('RULE_3_DESC'), consequence: this.langService.translate('RULE_3_CONS') },
      { id: '0x04', name: this.langService.translate('RULE_4_NAME'), description: this.langService.translate('RULE_4_DESC'), consequence: this.langService.translate('RULE_4_CONS') }
    ];
  }
}
