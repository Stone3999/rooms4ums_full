import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class SoundService {
  private platformId = inject(PLATFORM_ID);
  private audioContext: AudioContext | null = null;

  playClick() {
    if (!isPlatformBrowser(this.platformId) || typeof AudioContext === 'undefined') return;

    try {
      this.audioContext ??= new AudioContext();
      const context = this.audioContext;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.04, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.04);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.04);
      if (context.state === 'suspended') {
        void context.resume().catch(error => console.warn('[SOUND] Could not resume audio:', error));
      }
    } catch (error) {
      console.warn('[SOUND] Could not play click feedback:', error);
    }
  }
}
