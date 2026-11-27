# Plan Maestro: Prácticas 5 a 14 Aplicadas a ROOMS4UMS

Documento base de implementación, auditoría y pruebas sobre el ecosistema **ROOMS4UMS** (`backendrooms4ums`, `rooms4ums`, `rooms4umsmobile`, `wearos`).

---

## Inventario de Implementación por Práctica

### Práctica 5 — Código Seguro en Aplicaciones Móviles
**Archivos objetivo:**
- `rooms4umsmobile/lib/core/utils/security_validators.dart` (validador centralizado)
- `rooms4umsmobile/lib/ui/screens/login_screen.dart`
- `rooms4umsmobile/lib/ui/screens/register_screen.dart`
- `rooms4umsmobile/lib/core/services/api_service.dart`
- `rooms4umsmobile/lib/core/services/push_service.dart`
- `wearos/app/src/main/java/com/rooms4ums/wear/WearDataLayerListener.kt`
- `wearos/app/src/main/java/com/rooms4ums/wear/PushRegistration.kt`

**Requisitos técnicos:**
1. Rechazar entradas vacías o compuestas únicamente de espacios en usuario/correo, contraseña, título y contenido.
2. Contraseña: mínimo 8 caracteres y límite máximo (ej. 64 caracteres); usuario/correo/títulos con límites máximos definidos.
3. Ocultamiento de caracteres (`obscureText: true`) con toggle explícito.
4. Mensajes de error genéricos en autenticación (evitar detallar si falló usuario o contraseña o exponer trazas técnicas del servidor).
5. Cero fugas de datos sensibles en Logcat/consola (`debugPrint`/`Log`): eliminar impresión de tokens FCM, JWT o credenciales en `PushService`, `WearDataLayerListener`, `ApiService`.

---

### Práctica 6 — Interacción entre Dispositivos
**Archivos objetivo:**
- `rooms4umsmobile/lib/ui/screens/wearable_screen.dart`
- `rooms4umsmobile/lib/core/services/wear_service.dart`
- `rooms4umsmobile/android/app/src/main/kotlin/com/stone3999/rooms4ums_mobile/MainActivity.kt`
- `wearos/app/src/main/java/com/rooms4ums/wear/MainActivity.kt`
- `wearos/app/src/main/java/com/rooms4ums/wear/WearDataLayerListener.kt`

**Requisitos técnicos:**
1. Mostrar nombres de ambos dispositivos conectados (Teléfono + Nodo Wear OS vía `NodeClient`).
2. Permitir seleccionar el dispositivo emisor y enviar mensajes breves por canal real BLE (`MessageClient` Data Layer API / simulación controlada si no hay par en alcance).
3. Validación anti-mensajes vacíos o solo espacios.
4. Historial de conversación con emisor y marca de hora (`HH:mm:ss`).
5. Contador de mensajes enviados por cada dispositivo.
6. Botón para limpiar el historial y notificación visual inmediata al enviar/recibir (`SnackBar` + `Notify.show` en Wear OS).

---

### Práctica 7 — Asignación de Roles Masivos e Interacción de Situaciones
**Archivos objetivo:**
- `backendrooms4ums/src/admin/admin.controller.ts` & `admin.service.ts`
- `backendrooms4ums/src/forum/forum.controller.ts`, `post.schema.ts`, `posts.service.ts`
- `rooms4umsmobile/lib/core/services/api_service.dart` (subida `multipart/form-data` para adjuntos)
- `rooms4umsmobile/lib/ui/screens/room_screen.dart` & `post_detail_screen.dart`
- `rooms4umsmobile/lib/core/services/deep_link_service.dart`

**Requisitos técnicos:**
1. Flujo multi-rol (4 actores): **Administrador**, **Agente de Atención**, **Usuario 1**, **Usuario 2** operando sobre sala de soporte/incidencias.
2. Envío de mensajes y adjuntos reales desde móvil (`multipart/form-data` en campo `files` compatible con `FilesInterceptor`).
3. Asignación de casos y redirección directa mediante **URLs preasignadas** (`rooms4ums://room/soporte`, `rooms4ums://post/<id>`).
4. Reasignación de casos ante desconexión de agente y solicitudes directas al administrador.
5. Matriz de pruebas ejecutada (`TC01+`) con verificación en tiempo real para Admin y Agente.

---

### Práctica 8 — Pruebas de Caja Negra (Black Box Testing)
**Requisitos técnicos:**
Documentar y ejecutar matriz de al menos **12 requisitos verificables** sobre ROOMS4UMS:
- 4 requisitos de operaciones principales (Auth, Salas/Posts, Comentarios, Wear OS).
- 3 requisitos de validaciones (vacíos/espacios, longitud de contraseña/campos, formato correo/adjuntos).
- 2 requisitos de persistencia/consistencia (SQLite TTL offline, sesión JWT).
- 2 requisitos de navegación/roles/permisos (Deep links `rooms4ums://`, permisos Invitado/Usuario/Admin).
- 1 requisito de manejo de errores (modo offline y respuestas 401/403/500).

---

### Práctica 9 — Conexiones y Pruebas de Base de Datos entre Dispositivos
**Archivos objetivo:**
- `backendrooms4ums/src/forum/forum.controller.ts` & `posts.service.ts` & `post.schema.ts`
- `rooms4umsmobile/lib/core/services/api_service.dart`
- `rooms4umsmobile/lib/ui/screens/post_detail_screen.dart`

**Requisitos técnicos:**
Adaptación de Firestore al stack real **MongoDB + PostgreSQL + SQLite**:
1. Soporte completo CRUD en posts/incidencias: `PATCH /api/forum/posts/:id` (estado: `PENDIENTE`/`EN_PROCESO`/`RESUELTO`, prioridad: `BAJA`/`MEDIA`/`ALTA`/`CRITICA`, versión `__v` o timestamp para control de concurrencia) y `DELETE /api/forum/posts/:id`.
2. Pruebas cruzadas (`DB-01` a `DB-09`) con dos dispositivos ejecutando la app contra el mismo backend:
   - Creación `PRUEBA_A_001` y `PRUEBA_B_001` y lectura cruzada.
   - Propagación de cambio de estado y prioridad.
   - Prueba de conflicto concurrente sobre el mismo registro (`__v` / política Last-Write-Wins u Optimistic Locking).
   - Persistencia tras cierre y reintento controlado ante pérdida de conectividad.

---

### Práctica 10 — Seguridad, Autenticación y Control de Acceso Compartido
**Archivos objetivo:**
- `backendrooms4ums/src/forum/forum.controller.ts` & `posts.service.ts`
- `backendrooms4ums/src/storage/storage.service.ts`
- `backendrooms4ums/src/auth/admin.guard.ts`
- `rooms4umsmobile/lib/ui/screens/home_screen.dart` (mostrar UID del usuario autenticado)

**Requisitos técnicos:**
1. Mostrar el `userId` (UID de PostgreSQL/JWT) en pantalla para distinguir cuentas A y B.
2. Validación estricta de propiedad en backend (`authorId === req.user.userId` o rol `ADMIN`) en `PATCH/DELETE /api/forum/posts/:id` y comentarios; rechazar con `401` sin JWT y `403` ante acceso/modificación/eliminación ajena.
3. Impedir suplantación de propietario (`authorId` siempre tomado de `req.user.userId` e inmutable en actualizaciones).
4. Migrar [storage.service.ts](file:///c:/Users/david/Documents/10th%20FMP/Comprehensive%20Mobile%20Development/rooms4ums_full/backendrooms4ums/src/storage/storage.service.ts) de `getPublicUrl()` a `createSignedUrl()` con expiración.
5. Matriz de seguridad completa (`SEG-01` a `SEG-10`) ejecutada contra el backend real.

---

### Práctica 11 — Pruebas de White Box
**Requisitos técnicos:**
1. **Análisis estático:** `flutter analyze`, Gradle `lint`, ESLint/TypeScript en NestJS.
2. **Móvil (3 métodos críticos con CFG + Complejidad Ciclomática + Statement/Branch/Condition coverage):**
   - Validación: `SecurityValidators.validatePassword` / `LoginScreen`
   - Procesamiento: `DeepLinkService.parse`
   - Comunicación/DB: `ApiService._guard` y `LocalDatabase.cachedPosts`
3. **Web/API:** DTOs con `class-validator`, verificación de códigos HTTP (200, 201, 204, 400, 401, 403, 404, 409, 422, 500) y no exposición de hashes/tokens.
4. **Base de datos:** Pruebas CRUD, integridad y planes de ejecución (`EXPLAIN ANALYZE` en PostgreSQL/SQLite y `.explain('executionStats')` en MongoDB).
5. **Conectividad y carga:** Medición de Ping (20 paquetes), Latencia HTTP (10 solicitudes), Tasa de transferencia (Mbps), 1, 5 y 10 usuarios concurrentes (mínimo 20 reqs) y reporte de al menos 3 defectos reales identificados en el código.

---

### Práctica 12 — Optimización, Pruebas de Estrés y Resiliencia
**Archivos objetivo:**
- `rooms4umsmobile/lib/core/services/api_service.dart` (backoff exponencial + `X-Idempotency-Key`)
- `backendrooms4ums/src/forum/posts.service.ts` & `forum.controller.ts` (proyección de campos, índices, clave de idempotencia en Redis/Mongo)
- `backendrooms4ums/src/main.ts` (compresión HTTP si aplica)

**Requisitos técnicos:**
1. **Profiling:** CPU/RAM en Flutter DevTools y Wear OS.
2. **Estrés:** Script reproducible (lectura + escritura) midiendo RPS, promedio, P90, P95, máximo y % error.
3. **Optimización DB/API:** Proyección selectiva en listados, reducción de payload y validación con `explain`.
4. **Resiliencia (`RES-01` a `RES-08`):** Backoff exponencial controlado en `ApiService._guard` e idempotencia (`X-Idempotency-Key`) en creación de posts/comentarios para evitar duplicados tras fallos de red.
5. **Comparativa cuantitativa Antes vs Después** con tabla completa y métricas `PER-01` a `PER-11`.

---

### Prácticas 13 y 14 — Automatización de Pruebas y Validación Continua (CI)
**Archivos objetivo:**
- `rooms4umsmobile/test/unit_security_test.dart`
- `rooms4umsmobile/test/integration_api_db_test.dart`
- `wearos/app/src/test/java/com/rooms4ums/wear/WearLogicTest.kt`
- `backendrooms4ums/src/forum/forum.controller.spec.ts` / `auth/auth.controller.spec.ts`
- `.github/workflows/ci.yml`

**Requisitos técnicos:**
1. **5+ pruebas unitarias:** Cubriendo entrada válida, vacía/nula, fuera de rango, salida esperada y excepciones en `SecurityValidators`, `DeepLinkService`, `ApiService` y `WearOS`.
2. **3+ pruebas de integración:** Flujo cliente ↔ API (códigos HTTP, backoff, errores de red) y persistencia SQLite (`sqflite_common_ffi` o mock DB).
3. **CI/CD en GitHub Actions (`.github/workflows/ci.yml`):** Ejecución automática en `push`/`pull_request` para:
   - Flutter (`flutter analyze`, `flutter test --coverage`)
   - Wear OS (`./gradlew test lint`)
   - Backend NestJS (`npm run build`, `npm test`)
4. Completar matriz `AUT-01` a `AUT-08` con evidencia real de ejecución.

---

## Estado Actual de Implementación (Verificado)

### Completado y probado
- **Práctica 5 (Código Seguro):**
  - `rooms4umsmobile/lib/core/utils/security_validators.dart`: validadores centrales (rechaza espacios/vacíos, mínimo 8 y máximo 64 caracteres en contraseña, límites de longitud, sanitización de errores de autenticación).
  - `login_screen.dart` y `register_screen.dart`: integrados con `SecurityValidators` y `maxLength`.
  - `push_service.dart` y `wearos/.../WearDataLayerListener.kt`: eliminada la impresión de tokens FCM/títulos sensibles en logs.
- **Práctica 6 (Interacción entre Dispositivos):**
  - `wearable_screen.dart`, `wear_service.dart`, `MainActivity.kt` (Flutter) y `WearDataLayerListener.kt` (Wear OS): panel interactivo Teléfono (A) ↔ Wear OS (B) sobre Data Layer BLE (`/rooms4ums/chat`), validación de vacío, marca de hora, contadores por dispositivo, limpieza de historial y notificación visual.
- **Prácticas 7, 9, 10 y 12 (Backend CRUD, Seguridad, Roles, Idempotencia y Resiliencia):**
  - `backendrooms4ums/src/forum/dto/forum.dto.ts`: DTOs con `class-validator` (`CreatePostDto`, `UpdatePostDto`, `CreateCommentDto`) bloqueando campos no permitidos (`authorId` spoofing).
  - `post.schema.ts`, `posts.service.ts` y `forum.controller.ts`: campos `status`, `priority`, `assignedAgentId` e índice único disperso `idempotencyKey`; endpoints `PATCH /api/forum/posts/:id`, `DELETE /api/forum/posts/:id` y `POST /api/forum/posts/:id/assign` con validación de propiedad/rol (`403 Forbidden`) y control optimista de versión (`__v` -> `409 Conflict`).
  - `posts.service.ts`: optimización con `.select(...)` + `.lean()` en listados.
  - `storage.service.ts`: método `getAttachmentUrl()` con soporte `createSignedUrl()` vía `SUPABASE_SIGNED_URLS=true`.
  - `api_service.dart`: backoff exponencial en `_guard`, `X-Idempotency-Key` en `createPost`/`createComment`, y métodos `getProfile`, `updatePost`, `deletePost`.
  - `home_screen.dart`: visualización en pantalla del `UID` y usuario activo decodificados del JWT.
- **Prácticas 13 y 14 (Pruebas Automatizadas y CI):**
  - Flutter: 30 pruebas aprobadas (`widget_test.dart` + `security_and_resilience_test.dart`) con `coverage/lcov.info` (488/1999 líneas globales; cobertura focalizada en `SecurityValidators`, `ApiService`, `DeepLinkService` y pantallas).
  - Wear OS: `WearLogicTest.kt` + compilación completa (`./gradlew test assembleDebug` exitoso).
  - Backend: `posts.service.spec.ts` (5/5 pruebas aprobadas) + `nest build` exitoso.
  - CI: `.github/workflows/ci.yml` creado para Flutter, Wear OS y Backend NestJS.

### Pendiente (para siguientes pasos / evidencia)
1. **Documento base del usuario:** Adaptar y redactar el documento LaTeX/Word que proporcione el usuario con base en este plan.
2. **Práctica 7 (Subida de archivos desde móvil):** La subida multipart con campo `files` y el selector de imágenes están implementados y cubiertos por pruebas automatizadas; falta la demostración de extremo a extremo contra el backend desplegado.
3. **Prácticas 11 y 12 (Mediciones en vivo y Profiling):** Ejecutar pruebas de conectividad/carga (`ping`, latencia HTTP, `k6` 1/5/10 usuarios, `EXPLAIN ANALYZE` / `.explain('executionStats')`), captura de Flutter DevTools y tablas cuantitativas Antes vs Después.
4. **Cobertura adicional móvil (`>= 85%` en módulos críticos):** Añadir pruebas unitarias específicas con `sqflite_common_ffi` para `LocalDatabase` (`rooms_cache`, `posts_cache`, TTL) para elevar la cobertura de módulos críticos.

