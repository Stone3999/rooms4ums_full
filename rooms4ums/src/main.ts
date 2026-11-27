import { bootstrapApplication } from '@angular/platform-browser';
import { isDevMode } from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

// PWA: el service worker solo existe en el build de producción. Se registra
// cuando la aplicación está estable (o a los 30 s) para no competir con la
// primera carga. El servidor SSR no ejecuta este archivo.
bootstrapApplication(AppComponent, {
  ...appConfig,
  providers: [
    ...appConfig.providers,
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
}).catch((err) => console.error(err));
