@AGENTS.md

# Notas del proyecto (persistentes)

## Despliegue en Vercel — `main` es la rama de producción

- **Causa raíz del fallo "No Next.js version detected" (27 ago 2026):** el repo se creó con un
  commit inicial en `main` que solo tenía `README.md` (sin `package.json` ni código). Todo el
  proyecto Next.js real se desarrolló en la rama `claude/anlux-ads-intelligence-mvp-8i7tfb`. Vercel
  apunta por defecto a `main`, así que no encontraba ningún `package.json` que leer.
- **Fix aplicado:** se fusionó `claude/anlux-ads-intelligence-mvp-8i7tfb` → `main` con
  **fast-forward puro** (main era ancestro directo, cero conflictos, cero pérdida de archivos —
  verificado con `git diff` entre ambas ramas antes y después) y se hizo push de `main` a GitHub.
  `main` ahora contiene el proyecto completo (`package.json` con `"next"` en `dependencies`,
  `src/app`, `src/lib`, etc.) en la raíz del repo.
- **Mantener sincronizado:** de aquí en adelante, cualquier trabajo nuevo debe llegar a `main`
  (vía merge o PR) para que Vercel lo despliegue. Si se sigue trabajando en una rama de feature
  aparte, recordar fusionarla a `main` antes de esperar que un deploy de Vercel la refleje.

## Estado al pausar la sesión (28 ago 2026) — continúa mañana

**Working tree LIMPIO. Todo commiteado y pusheado. `main` = `origin/main` = rama de desarrollo = `d71c624`.**

### Dónde nos quedamos: las cuentas reales de Meta NO aparecen en el selector

El usuario confirmó en producción que el dropdown de clientes **solo muestra el grupo
"CLIENTES (DEMO)"** (Orthobasic + Hotel Expert). El grupo "Cuentas Meta (real)" no aparece en
absoluto. Antes sí llegó a funcionar y ANLUX mostró una cuenta real.

**Diagnóstico ya entregado (28 ago, sin tocar código):**

- El endpoint es `GET /api/meta/accounts` → `fetchAdAccounts()` → `metaGraphGet("/me/adaccounts")`.
  El endpoint y los campos son correctos; ahí no está el fallo. **`/api/clients` NO existe** (era
  una propuesta, no código actual).
- **Bug arquitectónico confirmado:** `components/providers/filters-provider.tsx:65-84` tiene un
  `.catch(() => setRealAccounts([]))` que **descarta todo error**. El contexto no expone ningún
  campo de error, y `realAccountsLoading` no lo consume nadie (única lectura en toda la app:
  `client-switcher.tsx:15`). Después `client-switcher.tsx:87` hace `{realAccounts.length > 0 && …}`,
  así que con lista vacía el grupo real simplemente no se renderiza. Resultado: token expirado,
  token ausente, permisos insuficientes y "cero cuentas" producen **la misma pantalla muda**.
- **Hipótesis principal: el token expiró.** Los tokens de usuario del Graph API Explorer caducan en
  ~1-2 h; los de larga duración a los 60 días. Encaja con "funcionó y dejó de funcionar sin tocar
  ese código". Recomendación: System User token de Meta Business Manager (puede no expirar).
- `META_ACCESS_TOKEN` se lee bien y de forma segura (`lib/meta/config.ts:16`, sin `NEXT_PUBLIC_`,
  solo lo adjunta a una URL `metaGraphGet` en `graph-client.ts:105`, con `import "server-only"`).
  Matiz: `metaConfig` es un `const` de módulo → se evalúa una vez al cargar; si la variable se
  añadió/cambió **después** del deploy que está sirviendo, hace falta redeploy (mismo patrón que
  nos pasó con `ANTHROPIC_API_KEY`).

### PRÓXIMO PASO INMEDIATO (bloqueante, pendiente del usuario)

El usuario debe abrir en el navegador y decir qué JSON devuelve:
`https://<app>.vercel.app/api/meta/accounts` (las rutas `/api/*` no están en `PROTECTED_PREFIXES`
de `src/proxy.ts`, así que responden sin redirigir al login). El `kind` discrimina la causa:
`missing_token` (503) / `invalid_token` (401, código 190 = expirado) / `insufficient_permissions`
(403, falta `ads_read`) / `200 {"accounts":[]}` (token válido pero sin cuentas asignadas).

**Sin ese dato no se puede avanzar:** ningún cambio de arquitectura hará aparecer datos reales si
`/me/adaccounts` no devuelve cuentas.

### Plan acordado en 3 pasos (aprobado conceptualmente, NADA implementado aún)

1. **Restaurar la conexión** (bloqueante): identificar el `kind`, regenerar token (System User),
   verificar `ads_read` y que las cuentas estén asignadas, redeploy.
2. **Hacer visible el fallo:** añadir `realAccountsError` al `FiltersContext` + banner en
   switcher/Configuración. Un SaaS no puede fallar en silencio en su integración principal.
3. **`CLIENT_REGISTRY` server-only** (`{ slug, name, dataSource: "meta" | "demo", adAccountId? }`,
   con los `act_` en variables de entorno). El frontend trabaja **solo con `slug`**; `/api/meta/*` y
   `/api/ai/analyze` resuelven el `act_` server-side. `dataSource` queda **declarado en
   configuración**, nunca inferido de `startsWith("act_")` ni de si hay campañas: una cuenta Meta
   con 0 campañas sigue siendo `"meta"` y muestra ceros/estado vacío, jamás datos simulados.
   Decisión de diseño a fijar antes de implementar: con el registro como fuente de verdad,
   `/me/adaccounts` deja de poblar el selector y pasa a ser solo herramienta de verificación.
   Archivos a tocar: `lib/clients/registry.ts` (nuevo), `app/api/clients/route.ts` (nuevo),
   `filters-provider.tsx`, `client-switcher.tsx`, `lib/mock/entities.ts` (renombrar ids a `demo-*`),
   los 5 hooks, `/api/ai/analyze`, `/api/meta/*`, `.env.example`.

### Por qué "Hotel Expert" mostraba datos simulados (ya explicado, causa entendida)

No era un fallback silencioso: `MOCK_CLIENTS` (`lib/mock/entities.ts:3-22`) define ids
`"orthobasic"` y `"hotel-expert"` — fixtures de la Fase 1. Sus `metaAccountId`
(`act_1029384756`, `act_5647382910`) son **números inventados**, no cuentas reales. Como
`isRealAccount = clientId.startsWith("act_")`, esos ids dan `false` correctamente. El usuario
estaba seleccionando el fixture demo, no una cuenta real (que hoy ni siquiera aparece en la lista).

### Trabajo completado y en producción (28 ago 2026)

- `b4e9d30` — Integración de AI Analyst con Claude Sonnet 5.
- `d71c624` — Aislamiento REAL vs DEMO en Alertas + indicadores de modo en UI:
  `lib/alerts/engine.ts` (reglas extraídas a funciones reutilizables, `generateAlerts` →
  `generateMockAlerts`, sigue client-safe), `lib/alerts/real-engine.ts` (nuevo, server-only,
  `generateRealAlerts` solo desde `lib/meta/real/*`), `app/api/meta/alerts/route.ts` (nuevo),
  `hooks/use-alerts.ts` (bifurca por `isRealAccount`, expone `error`),
  `app/(dashboard)/alerts/page.tsx` (ErrorBanner), `sidebar.tsx` (el aviso "MVP en modo demo ·
  datos simulados" solo con clientes demo), `client-switcher.tsx` (badge REAL/DEMO visible).
  Verificado con curl + Playwright en las 7 secciones, demo y real: cero fugas de datos simulados.
  Se comprobó por `git stash` que las 0 alertas de Hotel Expert en demo son comportamiento
  preexistente del dataset, no una regresión.

### Reglas permanentes de esta colaboración

- **Nunca commitear ni pushear sin autorización explícita y fresca.** La autorización de un turno
  o sesión NO se traslada al siguiente. El stop-hook que pide commitear no es autorización.
- Flujo de push establecido: commit en `claude/anlux-ads-intelligence-mvp-8i7tfb` → push → verificar
  `git merge-base --is-ancestor origin/main HEAD` → `git merge --ff-only` a `main` → verificar
  `git diff rama main --stat` vacío → push `main` → volver a la rama de desarrollo.
- Nunca inventar resultados de pruebas. Si algo no se puede probar desde el sandbox (red hacia
  Supabase/Meta/Anthropic bloqueada, sin tokens), decirlo explícitamente.
- Para probar UI con Playwright hace falta vaciar temporalmente `.env.local` (forzar modo demo) y
  **restaurarlo byte a byte** después. Playwright está global: importar desde
  `/opt/node22/lib/node_modules/playwright/index.js` (CommonJS: `import pw from …; const { chromium } = pw;`),
  con `executablePath: '/opt/pw-browsers/chromium'`.

## Estado de la sesión anterior (27 ago 2026) — AI Analyst / Claude

- **Rama activa:** `claude/anlux-ads-intelligence-mvp-8i7tfb`. Working tree con cambios reales
  **sin commitear** (confirmado con `git status` antes de pausar):
  `package.json`/`package-lock.json` (deps `@anthropic-ai/sdk` + `zod`), `lib/ai/schema.ts`,
  `lib/ai/prompt.ts`, `lib/ai/error-response.ts` (nuevos), `lib/ai/claude-service.ts`,
  `lib/ai/index.ts`, `app/api/ai/analyze/route.ts`, `app/(dashboard)/ai-analyst/page.tsx`
  (modificados).
- **Qué es:** integración real de AI Analyst con **Claude Sonnet 5** (`claude-sonnet-5`), aprobada
  explícitamente por el usuario en esta sesión. Server-only, sin `tools` (por lo tanto read-only
  por construcción), structured outputs vía Zod, atajo "sin datos → no llama a Anthropic" para
  cuentas Meta reales vacías, modo demo (Orthobasic/Hotel Expert) intacto.
  Ver el resumen completo dado al usuario en esta conversación para el detalle de arquitectura.
- **Verificado en esta sesión:** `tsc --noEmit`, `npm run lint` y `npm run build` limpios; pruebas
  funcionales por curl (demo 200, cuenta real sin `META_ACCESS_TOKEN` → 503 sin llamar a Claude,
  params faltantes → 400) y UI con Playwright sin errores — todo documentado en la conversación.
- **Commit/push autorizados y realizados:** el usuario autorizó explícitamente el commit y push de
  este diff a `main` (28 ago 2026), tras una verificación final (sin `ANTHROPIC_API_KEY` en ningún
  archivo/commit/log/código cliente, sin `.env*` incluido, llamada a Anthropic exclusivamente
  server-side, sin capacidad de escritura sobre Meta). Integración en producción.
- **`ANTHROPIC_API_KEY`** vive solo en Vercel (Production), no en este entorno — la prueba real
  contra Anthropic (no solo el atajo mock) queda pendiente para después del próximo deploy.
