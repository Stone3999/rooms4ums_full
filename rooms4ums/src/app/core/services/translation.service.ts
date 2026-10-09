import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { LanguageService } from './language.service';

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  private http = inject(HttpClient);
  private langService = inject(LanguageService);

  // Usaremos MyMemory API (Gratis, sin key para uso básico)
  // Formato: https://api.mymemory.translated.net/get?q=Hello%20World!&langpair=en|it
  private apiUrl = 'https://api.mymemory.translated.net/get';

  async translateText(text: string, toLanguage?: string, from: string = 'autodetect'): Promise<string> {
    const to = toLanguage || this.langService.currentLang();
    
    // MyMemory usa códigos ISO de 2 letras (jp -> ja)
    const targetLang = to === 'jp' ? 'ja' : to;

    // Evitar error: "PLEASE SELECT TWO DIFFERENT LANGUAGES"
    if (from !== 'autodetect' && from === targetLang) {
      return text;
    }

    try {
      const langPair = `${from}|${targetLang}`;
      
      const response: any = await firstValueFrom(
        this.http.get(`${this.apiUrl}?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(langPair)}`)
      );

      if (response && response.responseData) {
        return response.responseData.translatedText;
      }
      return text;
    } catch (error) {
      console.error('Error translating text:', error);
      return text;
    }
  }
}
