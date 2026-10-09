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
    path: '**',
    renderMode: RenderMode.Prerender
  }
];
