import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
    { 
        path: '', 
        loadComponent: () => import('./pages/landing/landing.component').then(m => m.LandingComponent) 
    },
    { 
        path: 'inicio', 
        loadComponent: () => import('./pages/home-carousel/home-carousel.component').then(m => m.HomeCarouselComponent) 
    },
    { 
        path: 'popular', 
        loadComponent: () => import('./pages/popular/popular.component').then(m => m.PopularComponent) 
    },
    { 
        path: 'recientes', 
        loadComponent: () => import('./pages/recent/recent.component').then(m => m.RecentComponent) 
    },
    {
        path: 'chats-voz',
        loadComponent: () => import('./pages/voice-view/voice-view.component').then(m => m.VoiceViewComponent)
    },
    { 
        path: 'foro/:id', 
        loadComponent: () => import('./pages/forum-feed/forum-feed.component').then(m => m.ForumFeedComponent),
        children: [
          {
            path: 'voz',
            canActivate: [authGuard],
            loadComponent: () => import('./pages/voice-view/voice-view.component').then(m => m.VoiceViewComponent)
          },
          {
            path: 'actividades',
            canActivate: [authGuard],
            loadComponent: () => import('./pages/game-view/game-view.component').then(m => m.GameViewComponent)
          },
          {
            path: 'post/:postId',
            loadComponent: () => import('./pages/post-details/post-details.component').then(m => m.PostDetailsComponent)
          }
        ]
    },
    { 
        path: 'login', 
        loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent) 
    },
    { 
        path: 'register', 
        loadComponent: () => import('./pages/register/register.component').then(m => m.RegisterComponent) 
    },
    { 
        path: 'admin', 
        canActivate: [authGuard, adminGuard],
        loadComponent: () => import('./pages/admin/admin.component').then(m => m.AdminComponent) 
    },
    { 
        path: 'help', 
        loadComponent: () => import('./pages/help-rules/help-rules.component').then(m => m.HelpComponent) 
    },
    { 
        path: 'rules', 
        loadComponent: () => import('./pages/rules/rules.component').then(m => m.RulesComponent) 
    },
    { 
        path: 'qa', 
        loadComponent: () => import('./pages/qa/qa.component').then(m => m.QaComponent) 
    },
    { 
        path: 'perfil', 
        canActivate: [authGuard],
        loadComponent: () => import('./pages/profile/profile.component').then(m => m.ProfileComponent) 
    },
    { 
        path: 'buscar', 
        loadComponent: () => import('./pages/search/search.component').then(m => m.SearchComponent) 
    },
    { path: '**', redirectTo: '' }
];
