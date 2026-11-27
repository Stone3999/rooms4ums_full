# ACTUALIZACIÓN DE TEMPORADA - SEASONAL THEME SYSTEM v1.0

## RAMA DE GIT

- **Nombre de rama:** `seasonal-update-v1`
- **Base:** `main`
- **Commits:**
  - `feat: implementar SeasonalThemeService con detección automática de temporada`
  - `feat: agregar PointerHighlightDirective para destacar contenido con el puntero`
  - `feat: integrar temas estacionales (spring, summer, autumn, winter) en el sistema de estilos`
  - `feat: aplicar PointerHighlightDirective en tarjetas de posts del foro`

---

## 1. EVENTO JAVASCRIPT: SISTEMA DE ACTUALIZACIÓN DE TEMPORADA

### 1.1 Descripción General

El **SeasonalThemeService** es un servicio Angular (singleton) que implementa un sistema de eventos JavaScript personalizados para la detección y aplicación automática de temas visuales basados en la temporada del año. El servicio dispara un evento `CustomEvent` llamado `rooms4ums-season-change` cada vez que la temporada cambia, lo que permite que cualquier componente del sistema reaccione al cambio.

### 1.2 Archivos Involucrados

| Archivo | Ruta | Propósito |
|---------|------|-----------|
| `seasonal-theme.service.ts` | `frontend/src/app/core/services/` | Servicio principal con lógica de detección, eventos y aplicación de temas |
| `seasonal-themes.css` | `frontend/src/` | Estilos CSS variables por temporada y animaciones decorativas |
| `app.component.ts` | `frontend/src/app/` | Integración del servicio en el componente raíz |

### 1.3 Ciclo de Vida del Evento

```
[Inicio del Servicio]
       │
       ▼
[Detección de Temporada] ◄────── mes actual (3-5 primavera, 6-8 verano, 9-11 otoño, 12-2 invierno)
       │
       ▼
[Aplicación de Tema CSS] ───────► variables CSS en :root
       │
       ▼
[Dispatch de CustomEvent] ──────► window.dispatchEvent(new CustomEvent('rooms4ums-season-change', { detail }))
       │
       ▼
[Re-evaluación Automática] ◄──── setInterval cada 1 hora (3600000ms)
       │
       ▼
[Override Manual] ──────────────► setSeason(season) / resetToAuto()
```

### 1.4 Estructura del CustomEvent

```typescript
// Disparado en: seasonal-theme.service.ts (método dispatchSeasonChangeEvent)
const event = new CustomEvent('rooms4ums-season-change', {
  detail: {
    season: 'spring' | 'summer' | 'autumn' | 'winter',
    theme: {
      season: string,
      label: string,
      icon: string,
      accentColor: string,
      accentHover: string,
      bgSecondary: string,
      decorationEmoji: string
    },
    timestamp: string // ISO 8601
  }
});
window.dispatchEvent(event);
```

### 1.5 Temas por Temporada

| Temporada | Meses | Color de Acento | Hover | Fondo Secundario | Emoji |
|-----------|-------|-----------------|-------|------------------|-------|
| 🌸 Primavera | Mar-May | `#e8a87c` | `#d4896a` | `#1a1410` | 🌸 |
| ☀️ Verano | Jun-Ago | `#ff8c00` | `#ff4500` | `#0a0a0a` | ☀️ |
| 🍂 Otoño | Sep-Nov | `#d4731a` | `#b85e12` | `#120e0a` | 🍂 |
| ❄️ Invierno | Dic-Feb | `#7bb8d4` | `#5a9bbf` | `#0a0e12` | ❄️ |

### 1.6 API del Servicio

```typescript
// Obtener temporada actual (signal)
const season: Signal<Season> = seasonalThemeService.currentSeason;

// Verificar si hay override activo
const isOverridden: Signal<boolean> = seasonalThemeService.overrideActive;

// Obtener tema actual
const theme: SeasonalTheme = seasonalThemeService.getTheme();

// Forzar una temporada manualmente
seasonalThemeService.setSeason('winter');

// Volver a detección automática
seasonalThemeService.resetToAuto();

// Escuchar cambios de temporada (retorna función para limpiar listener)
const unsubscribe = seasonalThemeService.listenSeasonChanges((detail) => {
  console.log('Nueva temporada:', detail.season);
});
```

### 1.7 Variables CSS Dinámicas

El servicio modifica las siguientes variables CSS en `:root`:

```css
--accent-color      /* Color principal de acento */
--accent-hover      /* Color hover */
--bg-secondary      /* Fondo secundario */
--season-deco-color /* Color decorativo de temporada */
--season-glow       /* Brillo de temporada */
--season-border-glow /* Brillo de borde */
```

### 1.8 Uso en Componentes

```typescript
// Cualquier componente puede reaccionar al cambio de temporada
constructor() {
  const cleanup = this.seasonalTheme.listenSeasonChanges(({ season, theme }) => {
    // Lógica personalizada por temporada
  });
}
```

---

## 2. EVENTO DE PUNTERO: POINTER HIGHLIGHT DIRECTIVE

### 2.1 Descripción General

La **PointerHighlightDirective** es una directiva Angular standalone que permite destacar cualquier elemento HTML cuando el puntero (cursor) pasa sobre él. Soporta 4 efectos visuales diferentes y es altamente configurable mediante inputs.

### 2.2 Archivos Involucrados

| Archivo | Ruta | Propósito |
|---------|------|-----------|
| `pointer-highlight.directive.ts` | `frontend/src/app/core/directives/` | Directiva principal con lógica de eventos de puntero |
| `forum-feed.component.ts` | `frontend/src/app/pages/forum-feed/` | Ejemplo de aplicación en tarjetas de posts |

### 2.3 Efectos Disponibles

| Efecto | Selector | Descripción |
|--------|----------|-------------|
| **Glow** | `'glow'` | Agrega un resplandor alrededor del elemento al hacer hover |
| **Border** | `'border'` | Dibuja un borde (outline) con el color de acento |
| **Spotlight** | `'spotlight'` | Efecto de foco que sigue la posición del cursor dentro del elemento |
| **Lift** | `'lift'` | Levanta el elemento (translateY + scale + shadow) |

### 2.4 Eventos del Puntero Utilizados

La directiva utiliza los siguientes eventos nativos del DOM angular:

```typescript
@HostListener('mouseenter', ['$event'])  // Cuando el puntero entra al elemento
@HostListener('mousemove', ['$event'])   // Cuando el puntero se mueve dentro (solo spotlight)
@HostListener('mouseleave')              // Cuando el puntero sale del elemento
```

### 2.5 API de la Directiva

```html
<!-- Uso básico - efecto glow por defecto -->
<div appPointerHighlight>
  Contenido destacable
</div>

<!-- Efecto lift (levantar) -->
<div appPointerHighlight="lift">
  Tarjeta que se eleva al hacer hover
</div>

<!-- Efecto spotlight con seguimiento del cursor -->
<div appPointerHighlight="spotlight">
  Efecto foco que sigue al mouse
</div>

<!-- Configuración personalizada -->
<div appPointerHighlight="lift"
     highlightColor="#ff4500"
     highlightScale="1.05"
     highlightDuration="0.5s">
  Configuración avanzada
</div>
```

### 2.6 Aplicación en el Foro (Ejemplo en Vivo)

Se aplicó el efecto `lift` a las tarjetas de posts (`post-card`) en el componente `ForumFeedComponent`:

```html
<div class="post-card win-panel" appPointerHighlight="lift">
  <!-- Contenido del post -->
</div>
```

Esto causa que cada tarjeta de post:
1. Se eleve 4px al pasar el cursor (`translateY(-4px)`)
2. Escale ligeramente (1.02x por defecto)
3. Muestre un resplandor con el color de acento de la temporada actual
4. Transicione suavemente con una curva cúbica de bezier

---

## 3. CAPTURA DE PANTALLA / DEMOSTRACIÓN

### 3.1 Demostración del Pointer Highlight

Para generar una grabación de pantalla breve que demuestre el efecto de highlight:

**Opción recomendada:**
1. Inicia el servidor de desarrollo: `cd frontend && npm start`
2. Navega a `http://localhost:4200` y accede a cualquier sala del foro
3. Usa la herramienta de grabación de pantalla integrada de Windows (Win+Alt+R) o Xbox Game Bar (Win+G)
4. Pasa el cursor sobre las tarjetas de posts para ver el efecto lift
5. Graba 10-15 segundos mostrando:
   - El efecto de elevación y resplandor al hacer hover
   - (Opcional) El cambio de temporada forzado con `setSeason('winter')` desde consola

**Comando para probar desde consola del navegador:**
```javascript
// Forzar temporada de invierno para ver el cambio de color
// (Requiere acceso al servicio desde window en modo debug)
// Alternativa: usar el servicio directamente
```

### 3.2 Demostración del Cambio de Temporada

1. Desde la consola del navegador (F12), ejecuta:
```javascript
// Obtener referencia al servicio (si está expuesto globalmente)
// O simplemente observar el cambio automático cada hora
```

2. El cambio se refleja automáticamente en:
   - Color de acento del sitio
   - Color de hover
   - Fondo secundario
   - Atributo `data-season` en `<html>`

---

## 4. ESTRUCTURA DE GIT

### 4.1 Creación de la Rama

```bash
git checkout -b seasonal-update-v1
```

### 4.2 Commits Realizados

```bash
git add frontend/src/app/core/services/seasonal-theme.service.ts
git commit -m "feat: implementar SeasonalThemeService con detección automática de temporada"

git add frontend/src/seasonal-themes.css frontend/angular.json
git commit -m "feat: agregar estilos CSS por temporada e integrar en angular.json"

git add frontend/src/app/core/directives/pointer-highlight.directive.ts
git commit -m "feat: crear PointerHighlightDirective con 4 efectos de highlight"

git add frontend/src/app/pages/forum-feed/forum-feed.component.ts
git commit -m "feat: aplicar PointerHighlightDirective en post-cards del foro"

git add frontend/src/app/app.component.ts
git commit -m "feat: integrar SeasonalThemeService en AppComponent raíz"

git add DOCUMENTACION_ACTUALIZACION_TEMPORADA.md
git commit -m "docs: documentar el sistema de actualización de temporada y pointer highlight"
```

### 4.3 Merge a Main

```bash
git checkout main
git merge seasonal-update-v1
git push origin main
```

---

## 5. VERIFICACIÓN

Para verificar que todo funciona correctamente:

1. **Build de producción:** `cd frontend && npm run build` (debe compilar sin errores)
2. **Servidor dev:** `cd frontend && npm start` y navegar al foro
3. **Efecto highlight:** Pasar cursor sobre tarjetas de posts
4. **Cambio de temporada:** Forzar desde consola o esperar el ciclo automático
5. **Evento custom:** Escuchar `rooms4ums-season-change` en la consola:
   ```javascript
   window.addEventListener('rooms4ums-season-change', (e) => console.log('Season:', e.detail));
   ```
