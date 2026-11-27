import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'foro/:id',
    renderMode: RenderMode.Server
  },
  {
    path: 'foro/:id/post/:postId',
    renderMode: RenderMode.Server
  },
  {
    path: 'foro/:id/voz',
    renderMode: RenderMode.Server
  },
  {
    path: 'foro/:id/actividades',
    renderMode: RenderMode.Server
  },
  {
    // El catálogo y las pantallas públicas se renderizan en el cliente: el
    // build no depende de que la API de producción esté disponible y la PWA
    // puede precachear el shell. Las rutas con :id sí usan SSR.
    path: '**',
    renderMode: RenderMode.Client
  }
];
