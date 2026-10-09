import { Injectable, signal, effect, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export interface SeasonalTheme {
  season: Season;
  label: string;
  icon: string;
  accentColor: string;
  accentHover: string;
  bgSecondary: string;
  decorationEmoji: string;
}

@Injectable({
  providedIn: 'root'
})
export class SeasonalThemeService {
  private platformId = inject(PLATFORM_ID);
  private _currentSeason = signal<Season>(this.detectSeason());
  private _overrideActive = signal(false);

  readonly currentSeason = this._currentSeason.asReadonly();
  readonly overrideActive = this._overrideActive.asReadonly();

  readonly themes: Record<Season, SeasonalTheme> = {
    spring: {
      season: 'spring',
      label: 'PRIMAVERA',
      icon: '🌸',
      accentColor: '#e8a87c',
      accentHover: '#d4896a',
      bgSecondary: '#1a1410',
      decorationEmoji: '🌸'
    },
    summer: {
      season: 'summer',
      label: 'VERANO',
      icon: '☀️',
      accentColor: '#ff8c00',
      accentHover: '#ff4500',
      bgSecondary: '#0a0a0a',
      decorationEmoji: '☀️'
    },
    autumn: {
      season: 'autumn',
      label: 'OTOÑO',
      icon: '🍂',
      accentColor: '#d4731a',
      accentHover: '#b85e12',
      bgSecondary: '#120e0a',
      decorationEmoji: '🍂'
    },
    winter: {
      season: 'winter',
      label: 'INVIERNO',
      icon: '❄️',
      accentColor: '#7bb8d4',
      accentHover: '#5a9bbf',
      bgSecondary: '#0a0e12',
      decorationEmoji: '❄️'
    }
  };

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.initAutoUpdate();
    }
  }

  private detectSeason(): Season {
    const now = new Date();
    const month = now.getMonth() + 1;
    if (month >= 3 && month <= 5) return 'spring';
    if (month >= 6 && month <= 8) return 'summer';
    if (month >= 9 && month <= 11) return 'autumn';
    return 'winter';
  }

  private initAutoUpdate(): void {
    this.applyTheme(this._currentSeason());

    effect(() => {
      const season = this._currentSeason();
      this.applyTheme(season);
      if (isPlatformBrowser(this.platformId)) {
        localStorage.setItem('rooms4ums-season', season);
      }
    });

    setInterval(() => {
      if (!this._overrideActive()) {
        const detected = this.detectSeason();
        if (detected !== this._currentSeason()) {
          this._currentSeason.set(detected);
          this.dispatchSeasonChangeEvent(detected);
        }
      }
    }, 3600000);
  }

  private dispatchSeasonChangeEvent(season: Season): void {
    if (isPlatformBrowser(this.platformId)) {
      const event = new CustomEvent('rooms4ums-season-change', {
        detail: { season, theme: this.themes[season], timestamp: new Date().toISOString() }
      });
      window.dispatchEvent(event);
    }
  }

  private applyTheme(season: Season): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const theme = this.themes[season];
    const root = document.documentElement;
    root.style.setProperty('--accent-color', theme.accentColor);
    root.style.setProperty('--accent-hover', theme.accentHover);
    root.style.setProperty('--bg-secondary', theme.bgSecondary);
    root.setAttribute('data-season', season);
  }

  setSeason(season: Season): void {
    this._overrideActive.set(true);
    this._currentSeason.set(season);
    this.dispatchSeasonChangeEvent(season);
  }

  resetToAuto(): void {
    this._overrideActive.set(false);
    const detected = this.detectSeason();
    this._currentSeason.set(detected);
    this.dispatchSeasonChangeEvent(detected);
  }

  getTheme(): SeasonalTheme {
    return this.themes[this._currentSeason()];
  }

  listenSeasonChanges(callback: (detail: { season: Season; theme: SeasonalTheme; timestamp: string }) => void): () => void {
    if (!isPlatformBrowser(this.platformId)) return () => {};
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent;
      callback(customEvent.detail);
    };
    window.addEventListener('rooms4ums-season-change', handler);
    return () => window.removeEventListener('rooms4ums-season-change', handler);
  }
}
