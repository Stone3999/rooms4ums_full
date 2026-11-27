import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';
import { SoundService } from './core/services/sound.service';
import { SeasonalThemeService } from './core/services/seasonal-theme.service';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: SoundService, useValue: { playClick: () => undefined } },
        { provide: SeasonalThemeService, useValue: {} },
      ],
    })
      // Se aísla el shell de sus componentes hijos (header, sidebar, avisos)
      // para probar solo la lógica de navegación del componente raíz.
      .overrideComponent(AppComponent, { set: { imports: [], template: '' } })
      .compileComponents();
  });

  it('crea el componente raíz', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('toggleSidebar alterna el estado de la barra lateral', () => {
    const app = TestBed.createComponent(AppComponent).componentInstance;
    expect(app.isSidebarOpen).toBeTrue();
    app.toggleSidebar();
    expect(app.isSidebarOpen).toBeFalse();
  });

  it('muestra el armazón por defecto (ruta raíz)', () => {
    const app = TestBed.createComponent(AppComponent).componentInstance;
    expect(app.showShell()).toBeTrue();
    expect(app.isHomeRoute()).toBeFalse();
  });
});
