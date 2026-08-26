# ANLUX Ads Intelligence

Panel interno (privado, de un solo cliente de agencia) para visualizar métricas de campañas de **Meta Ads** y, en fases posteriores, analizarlas con **IA (Claude, de Anthropic)**.

Los datos de campañas siguen siendo **100% mock**. La autenticación (**Supabase Auth**) ya está
conectada: con credenciales reales en `.env.local` el login usa sesiones reales; sin ellas, cae
automáticamente en modo demo. Meta Marketing API y Anthropic siguen **preparados
arquitectónicamente** pero **no conectados todavía**.

---

## 1. Qué hace el proyecto

- Login con Supabase Auth real (email/contraseña) — modo demo automático si no hay credenciales
  configuradas.
- Selector de cliente (Orthobasic / Hotel Expert) y filtro de rango de fechas.
- Dashboard de Overview con 10 KPIs (inversión, alcance, impresiones, CPM, clics, CTR, CPC,
  resultados, costo por resultado, frecuencia), cada uno con variación % contra el periodo
  anterior y una indicación correcta de si esa variación es buena o mala (p. ej. un CPC al alza
  se marca en rojo, no en verde).
- Gráfica de evolución diaria (inversión / CTR / CPC / resultados).
- Funnel de conversión (Impresiones → Clics → Conversaciones/Leads → Resultados).
- Tablas ordenables y con búsqueda/filtros de Campañas, Conjuntos de anuncios (Ad Sets) y
  Anuncios, con vista de detalle de campaña.
- Sección de Creativos Ganadores, con etiquetas calculadas (Mejor CTR, Menor CPC, Más
  resultados, Mejor costo por resultado).
- **AI Performance Analyst**: chat con preguntas rápidas que genera un análisis (resumen,
  problemas, oportunidades, recomendaciones, prioridad) a partir de las métricas reales del
  periodo. Hoy es una simulación basada en reglas; el backend ya está listo para sustituirse por
  una llamada real a Claude sin tocar el frontend.
- Módulo de Alertas de performance (CTR cae > 20%, CPC sube > 25%, frecuencia > 3, gasto sin
  resultados, costo por resultado muy por encima del promedio), con severidad
  info/advertencia/crítica.
- Página de Configuración que muestra el estado real de cada integración (mock vs. configurada).

## 2. Arquitectura

```
src/
  app/                      → Next.js App Router
    (auth)/login/           → pantalla de login (pública)
    (dashboard)/            → todas las secciones protegidas, comparten sidebar + topbar
      overview/
      campaigns/[id]/
      adsets/
      ads/
      creatives/
      ai-analyst/
      alerts/
      settings/
    api/ai/analyze/         → único backend real del MVP: orquesta el AI Performance Analyst
  components/
    ui/                     → primitivas reutilizables (Card, Badge, DataTable, Dropdown...)
    layout/                 → Sidebar, Topbar, ClientSwitcher, DateRangeFilter, DashboardShell
    dashboard/  campaigns/  adsets/  ads/  creatives/  ai/  alerts/
                             → componentes específicos de cada sección
    providers/               → FiltersProvider (cliente + rango de fechas compartidos)
  hooks/                    → acceso a datos desde componentes cliente (useCampaigns, useAds...)
  lib/
    types/                  → modelos de dominio compartidos (fuente de verdad única)
    mock/                   → entidades y generador determinista de métricas diarias
    meta/                   → adaptador de Meta Marketing API (IMetaAdsService + Mock/Real)
    ai/                     → adaptador del analista de IA (mock hoy, Claude mañana)
    alerts/                 → motor de reglas de alertas de performance
    supabase/               → clientes de Supabase (browser/server) + esquema futuro
    utils/                  → fechas, formateo, cálculo de métricas, funnel, etiquetas
```

**Principio central**: la UI nunca habla directamente con "datos mock" ni con proveedores
externos. Todo pasa por interfaces (`IMetaAdsService`, `IAIAnalystService`) definidas en
`lib/types` y `lib/meta` / `lib/ai`. Sustituir el mock por la integración real es, en ambos
casos, cambiar una única función (`getMetaAdsService()` / `getAIAnalystService()`) — cero cambios
en páginas o componentes.

## 3. Instalación

Requisitos: Node.js 20+ y npm.

```bash
npm install
```

## 4. Ejecución

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) — redirige automáticamente a `/login`
(modo demo: cualquier email válido + contraseña de 4+ caracteres inician sesión) y de ahí a
`/overview`.

Otros comandos:

```bash
npm run lint     # ESLint
npm run build    # build de producción (incluye chequeo de tipos de Next.js)
npm run start    # sirve el build de producción
```

## 5. Variables de entorno

Copia `.env.example` a `.env.local` y rellena **solo** lo que vayas a conectar. Con el archivo
vacío o sin crear, la app funciona íntegramente en modo mock/demo.

| Variable | Uso | Dónde se lee |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase | `lib/supabase/config.ts` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave pública de Supabase (nomenclatura actual, sustituye a la antigua "anon key") | `lib/supabase/config.ts` |
| `META_APP_ID` / `META_APP_SECRET` | Credenciales de la app de Meta | `lib/meta/config.ts` |
| `META_ACCESS_TOKEN` | Token de acceso a la Graph API | `lib/meta/config.ts` |
| `META_AD_ACCOUNT_ID` | Cuenta publicitaria a consultar | `lib/meta/config.ts` |
| `ANTHROPIC_API_KEY` | Clave de la API de Claude | `lib/ai/claude-service.ts` (vía `/api/ai/analyze`) |

**Nunca** se exponen `META_APP_SECRET`, `META_ACCESS_TOKEN` ni `ANTHROPIC_API_KEY` al cliente:
ninguna tiene el prefijo `NEXT_PUBLIC_` y solo se leen desde código de servidor (API routes,
Server Components, Server Actions, middleware). La clave secreta de Supabase (antes
`SUPABASE_SERVICE_ROLE_KEY`, hoy "Secret key") no se usa en esta fase — el cliente de servidor
(`lib/supabase/server.ts`) opera con la misma clave pública que el navegador y respeta Row Level
Security.

## 6. Estructura de carpetas

Ver el árbol de la sección 2. Cada carpeta de `lib/` tiene una responsabilidad única:

- `lib/types` — modelos compartidos (`Client`, `Campaign`, `AdSet`, `Ad`, `PerformanceMetrics`,
  `DailyMetrics`, `AIAnalysis`, `PerformanceAlert`...).
- `lib/mock` — datos "de verdad" del MVP: entidades estáticas (`entities.ts`) y un generador
  determinista de métricas diarias (`metrics-generator.ts`) con tendencias, estacionalidad y
  casos "guionizados" (fatiga de audiencia, campañas sin resultados, picos de CPC...) para que
  las alertas y los creativos ganadores tengan sentido.
- `lib/meta` — la interfaz `IMetaAdsService` y su única implementación actual,
  `MockMetaAdsService`.
- `lib/ai` — la interfaz `IAIAnalystService` y su implementación mock (`MockAIAnalystService`).
- `lib/alerts` — reglas de negocio que convierten métricas en `PerformanceAlert[]`.
- `lib/supabase` — clientes de Supabase + `schema.sql` de referencia (no ejecutado).

## 7. Cómo funciona el modo mock

Todo el dataset (2 clientes, ~11 campañas, ~19 ad sets, ~35 anuncios, ~150 días de histórico por
anuncio) se genera con un PRNG determinista (`lib/mock/random.ts`): mismos resultados siempre,
en servidor y en cliente, sin necesidad de persistir nada. Cada anuncio tiene un "perfil" (tier de
performance, tendencia de CTR, tendencia de costo) fijado una vez al cargar el módulo, y las
métricas de cada día se derivan matemáticamente de ese perfil — no son números sueltos.

`lib/meta/mock-service.ts` implementa `IMetaAdsService` leyendo ese dataset y añade una pequeña
latencia simulada para que los estados de carga (skeletons) tengan sentido.

## 8. Dónde conectaremos Meta Marketing API

1. Rellenar `META_APP_ID`, `META_APP_SECRET`, `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID` en
   `.env.local`.
2. Crear `lib/meta/real-service.ts` implementando `IMetaAdsService` (definida en
   `lib/meta/service.ts`) con llamadas reales a la Graph API.
3. En `lib/meta/index.ts`, dentro de `getMetaAdsService()`, sustituir el `console.warn` por
   `return new RealMetaAdsService()` cuando `isMetaApiConfigured()` sea `true`.

Ningún componente de UI cambia: todos consumen `getMetaAdsService()`.

## 9. Dónde conectaremos Claude (Anthropic)

1. `npm install @anthropic-ai/sdk` y definir `ANTHROPIC_API_KEY` en `.env.local`.
2. Completar `lib/ai/claude-service.ts` (`ClaudeAIAnalystService.analyze()`): construir un prompt
   a partir del `AIAnalysisRequest` (cliente, rango, campañas, ad sets, anuncios y métricas) y
   convertir la respuesta de Claude al tipo `AIAnalysis`.
3. En `lib/ai/index.ts`, devolver `new ClaudeAIAnalystService()` cuando `isAnthropicConfigured()`
   sea `true`.

El frontend **nunca** llama a Anthropic directamente: siempre pasa por el endpoint de servidor
`POST /api/ai/analyze` (`app/api/ai/analyze/route.ts`), que es el único lugar donde
`ANTHROPIC_API_KEY` podría usarse.

## 10. Supabase (activo)

Supabase Auth ya está conectado — esta sección documenta cómo, no solo "dónde":

1. Crea un proyecto en [supabase.com](https://supabase.com) y copia, desde
   **Project Settings → API Keys**, la URL del proyecto y la **Publishable key** (nomenclatura
   actual de Supabase) a `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```
2. Crea al menos un usuario en **Authentication → Users** (o habilita el registro) con email y
   contraseña — el login del MVP usa `signInWithPassword`, no hay pantalla de registro todavía.
3. Reinicia `npm run dev`. En cuanto ambas variables existen, `isSupabaseConfigured()` pasa a
   `true` en todo el proyecto y el modo demo se desactiva automáticamente — no hace falta tocar
   código.
4. `lib/supabase/client.ts` (browser) y `lib/supabase/server.ts` (Server Components/Actions/Route
   Handlers) usan `@supabase/ssr` con la clave pública; ambos devuelven `null` si las variables no
   están configuradas, para que el resto del código caiga automáticamente en modo demo.
5. `src/proxy.ts` (la convención "Proxy" de Next.js 16, antes llamada Middleware) protege las
   rutas del dashboard a nivel de servidor: verifica la sesión con
   `supabase.auth.getUser()` en cada request y redirige a `/login` antes de renderizar si no hay
   usuario. En modo demo esta comprobación se salta (no hay sesión de Supabase que verificar) y la
   protección la sigue haciendo el guard de cliente (`hooks/use-auth-state.ts`, basado en
   `localStorage`), exactamente igual que antes.
6. El login (`app/(auth)/login/page.tsx` vía `lib/supabase/auth.ts`) traduce los errores de
   Supabase Auth a mensajes claros en español (credenciales incorrectas, email sin confirmar,
   demasiados intentos, error de red...).
7. Cerrar sesión: menú de usuario en la topbar → "Cerrar sesión" (`components/layout/topbar.tsx`),
   llama a `signOut()` en `lib/supabase/auth.ts`.
8. No se han creado tablas todavía: `lib/supabase/schema.sql` sigue siendo solo documentación de
   referencia (no ejecutada) para cuando el proyecto necesite persistencia propia más allá de
   Auth.

La clave secreta de Supabase (antes `service_role`) **no se usa en esta fase** — se añadirá más
adelante, en un cliente de servidor aparte, solo si una funcionalidad concreta necesita saltarse
Row Level Security.

## 11. Despliegue en Vercel (fase posterior)

Este proyecto es un Next.js estándar con App Router, así que el despliegue en
[Vercel](https://vercel.com) no requiere configuración adicional:

1. Importar el repositorio en Vercel.
2. Definir en el proyecto de Vercel las mismas variables de `.env.example` que quieras activar
   (Settings → Environment Variables).
3. Deploy. No hace falta ningún build step especial (`next build` ya es el comando por defecto).

> No se ha desplegado nada todavía — este paso queda pendiente hasta nueva autorización.

---

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS v4 · Recharts · Supabase (`@supabase/ssr`) ·
ESLint · preparado para Meta Marketing API y Anthropic Claude API.
