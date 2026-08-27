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

## Estado al pausar la sesión (27 ago 2026) — continúa mañana

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
