import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class SoundService {
  private platformId = inject(PLATFORM_ID);
  private clickAudio: any; // HTMLAudioElement

  constructor() {
    // Solo inicializamos si estamos en el navegador
    if (isPlatformBrowser(this.platformId)) {
      this.clickAudio = new Audio();
      this.clickAudio.src = 'https://www.winhistory.de/more/win95/sound/click.wav';
      this.clickAudio.load();
    }
  }

  playClick() {
    if (isPlatformBrowser(this.platformId) && this.clickAudio) {
      const sound = this.clickAudio.cloneNode() as HTMLAudioElement;
      sound.volume = 0.3;
      sound.play().catch(() => {
        // Silencioso si falla (políticas de navegador)
      });
    }
  }
}
