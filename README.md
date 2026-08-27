# ANLUX Ads Intelligence

Panel interno (privado, de un solo cliente de agencia) para visualizar métricas de campañas de **Meta Ads** y, en fases posteriores, analizarlas con **IA (Claude, de Anthropic)**.

La autenticación (**Supabase Auth**) y la lectura de **Meta Marketing API** ya están conectadas:
con credenciales reales en `.env.local` ambas usan datos reales; sin ellas, cada una cae
automáticamente en modo demo/mock por separado. **Anthropic (Claude)** sigue **preparado
arquitectónicamente** pero **no conectado todavía**.

---

## 1. Qué hace el proyecto

- Login con Supabase Auth real (email/contraseña) — modo demo automático si no hay credenciales
  configuradas.
- Selector de cliente con dos modos: clientes demo (Orthobasic / Hotel Expert, datos mock) y
  cuentas publicitarias reales de Meta (descubiertas automáticamente con `META_ACCESS_TOKEN`,
  ver sección 8) — y filtro de rango de fechas, aplicable a ambos modos.
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
| `META_ACCESS_TOKEN` | Token de acceso a Meta Graph API (único requisito para datos reales) | `lib/meta/config.ts`, vía `lib/meta/real/` |
| `META_GRAPH_API_VERSION` | Opcional: fija la versión de Graph API | `lib/meta/config.ts` |
| `META_APP_ID` / `META_APP_SECRET` / `META_AD_ACCOUNT_ID` | Reservadas para una fase futura (no se usan todavía) | `lib/meta/config.ts` |
| `ANTHROPIC_API_KEY` | Clave de la API de Claude | `lib/ai/claude-service.ts` (vía `/api/ai/analyze`) |

**Nunca** se exponen `META_APP_SECRET`, `META_ACCESS_TOKEN` ni `ANTHROPIC_API_KEY` al cliente:
ninguna tiene el prefijo `NEXT_PUBLIC_` y solo se leen desde código de servidor (API routes,
Server Components, Server Actions, middleware) — `lib/meta/real/` además usa el paquete
`server-only`, que hace fallar el build si alguno de sus módulos se importa por error desde un
componente cliente. La clave secreta de Supabase (antes `SUPABASE_SERVICE_ROLE_KEY`, hoy "Secret
key") no se usa en esta fase — el cliente de servidor (`lib/supabase/server.ts`) opera con la
misma clave pública que el navegador y respeta Row Level Security.

## 6. Estructura de carpetas

Ver el árbol de la sección 2. Cada carpeta de `lib/` tiene una responsabilidad única:

- `lib/types` — modelos compartidos (`Client`, `Campaign`, `AdSet`, `Ad`, `PerformanceMetrics`,
  `DailyMetrics`, `AIAnalysis`, `PerformanceAlert`...).
- `lib/mock` — datos "de verdad" del MVP: entidades estáticas (`entities.ts`) y un generador
  determinista de métricas diarias (`metrics-generator.ts`) con tendencias, estacionalidad y
  casos "guionizados" (fatiga de audiencia, campañas sin resultados, picos de CPC...) para que
  las alertas y los creativos ganadores tengan sentido.
- `lib/meta` — la interfaz `IMetaAdsService` y `MockMetaAdsService` (usada por `getMetaAdsService()`
  para el modo demo). La integración real de lectura vive aparte, en `lib/meta/real/`, y solo se
  usa desde `app/api/meta/*` (ver sección 8) — nunca desde `getMetaAdsService()`.
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

## 8. Meta Marketing API (activo, modo lectura)

1. Define `META_ACCESS_TOKEN` en `.env.local` — es la única variable necesaria. Las cuentas
   publicitarias accesibles con ese token se descubren automáticamente vía `/me/adaccounts`, no
   hace falta fijar `META_AD_ACCOUNT_ID`.
2. Reinicia `npm run dev`. El selector de cliente de la topbar mostrará una sección "Cuentas Meta
   (real)" además de los clientes demo — sin tocar código.
3. Selecciona una cuenta real (`act_...`) para ver campañas, ad sets, anuncios y métricas reales
   en vez de mock, en las mismas pantallas (Overview, Campañas, Conjuntos, Anuncios, Creativos).

**Arquitectura:** a diferencia de Supabase (cuyo cliente puede llamarse desde el navegador de
forma segura), el token de Meta **nunca** llega al frontend. La integración real vive en
`lib/meta/real/` (cliente de Graph API, mapeos de status/objetivo/dinero, interpretación de
`actions`, fetchers por entidad) y solo se usa desde Route Handlers server-only:

- `GET /api/meta/accounts` — descubre cuentas accesibles con el token.
- `GET /api/meta/overview?accountId=&from=&to=` — KPIs de cuenta + serie diaria.
- `GET /api/meta/campaigns` / `/api/meta/adsets` / `/api/meta/ads` (mismos parámetros) — listado +
  métricas agregadas por entidad.

El frontend solo llama a estos endpoints internos (nunca a `getMetaAdsService()`, que sigue
siendo exclusivamente mock — ver `lib/meta/index.ts`). `hooks/use-account-metrics.ts`,
`use-campaigns.ts`, `use-adsets.ts` y `use-ads.ts` deciden qué fuente usar mirando un único dato:
si el `clientId` seleccionado empieza por `act_` (cuenta real) o no (cliente demo).

**Qué sigue siendo mock siempre**, independientemente de la cuenta seleccionada: la vista de
detalle de campaña (`/campaigns/[id]`), el módulo de Alertas y el AI Performance Analyst — no
están conectados a datos reales todavía.

**Interpretación de resultados:** Meta no expone un campo único de "resultados"; los devuelve
desglosados por `action_type` en `actions`/`cost_per_action_type`. `lib/meta/real/actions.ts`
elige, para cada objetivo de campaña, el `action_type` que Meta considera el resultado principal
(p. ej. `lead` para generación de leads, `link_click` para tráfico) — nunca suma tipos de acción
heterogéneos entre sí. Si esa acción no viene en la respuesta, no se fabrica un valor.

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
