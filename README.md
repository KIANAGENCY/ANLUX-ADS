# ANLUX Ads Intelligence

ANLUX Ads Intelligence es un panel interno de agencia para consultar y analizar datos reales de Meta Ads. El proyecto usa Next.js, Supabase Auth, Meta Marketing API y un proveedor de IA configurable entre Anthropic y Google Gemini.

## Principio de integridad

ANLUX no debe presentar datos publicitarios simulados como si fueran reales. Si Meta, Supabase o el proveedor de IA no están configurados o fallan, la aplicación debe mostrar un estado vacío o un error explícito.

La integración de Meta es de lectura. El token permanece en el servidor y no se expone al navegador.

## Funcionalidades actuales

- Autenticación con Supabase Auth.
- Descubrimiento de cuentas publicitarias accesibles con el token de Meta.
- Soporte opcional para cuentas de cliente de un Business Manager mediante `META_BUSINESS_ID`.
- Overview con inversión, alcance, impresiones, clics, CTR, CPC, CPM, resultados, costo por resultado y frecuencia.
- Comparación contra el periodo anterior equivalente.
- Serie diaria de performance a nivel de cuenta.
- Campañas, conjuntos de anuncios y anuncios obtenidos de Meta Marketing API.
- Detalle de campaña y sus conjuntos de anuncios.
- Alertas deterministas de performance.
- AI Performance Analyst con dos modos: rendimiento sobre datos reales y consulta estratégica general.
- Proveedor de IA configurable: Anthropic o Gemini.
- Moneda real de cada cuenta aplicada al dashboard y al contexto de IA.
- Fechas de inicio reales de campañas y conjuntos cuando Meta las devuelve.

## Arquitectura

```text
src/
  app/
    (auth)/login/
    (dashboard)/
      overview/
      campaigns/
      adsets/
      ads/
      creatives/
      ai-analyst/
      alerts/
      settings/
    api/
      meta/
      ai/analyze/
  components/
  hooks/
  lib/
    ai/
    alerts/
    meta/real/
    supabase/
    types/
    utils/
  proxy.ts
```

### Meta Ads

La capa de Meta vive en `src/lib/meta/real/`. Todas las llamadas a Graph API se realizan desde el servidor. La UI consume Route Handlers internos; nunca recibe `META_ACCESS_TOKEN`.

Las métricas de cuenta usan insights `level=account` para que alcance y frecuencia provengan de los valores deduplicados por Meta. Los resultados se interpretan por objetivo de campaña en vez de sumar indiscriminadamente tipos de acción incompatibles.

### AI Performance Analyst

`POST /api/ai/analyze` separa explícitamente dos modos:

- `performance`: requiere cuenta y rango de fechas y reúne métricas reales, campañas, ad sets, anuncios y alertas deterministas.
- `general`: no consulta Meta y responde únicamente con criterio estratégico general.

El modelo recibe una instrucción explícita de no inventar cifras, campañas, resultados, moneda ni alertas.

### Alertas

Las alertas se calculan con reglas deterministas en `src/lib/alerts/real-engine.ts`. El AI Analyst reutiliza esas mismas reglas sobre los datos ya cargados, evitando duplicar llamadas a Meta.

### Supabase

Supabase se usa para autenticación. No existe sesión demo: si las variables de Supabase faltan, las rutas protegidas quedan cerradas.

`src/lib/supabase/schema.sql` es únicamente un esquema de referencia para una futura persistencia de snapshots e historial de análisis. No se ejecuta automáticamente.

## Requisitos

- Node.js 22 o superior.
- npm.
- Un proyecto Supabase configurado para autenticación.
- Un token de Meta con los permisos de lectura necesarios para las cuentas autorizadas.
- Una API key del proveedor de IA seleccionado si se utilizará AI Analyst.

## Instalación

```bash
npm ci
```

Copia `.env.example` a `.env.local` y configura las variables necesarias.

```bash
npm run dev
```

## Variables de entorno

| Variable | Uso |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave pública de Supabase |
| `META_ACCESS_TOKEN` | Token server-only de Meta Marketing API |
| `META_BUSINESS_ID` | Opcional; añade cuentas de cliente del Business Manager |
| `META_GRAPH_API_VERSION` | Opcional; versión de Graph API |
| `AI_PROVIDER` | `anthropic` o `gemini` |
| `ANTHROPIC_API_KEY` | API key de Anthropic |
| `GEMINI_API_KEY` | API key de Gemini |
| `GEMINI_MODEL` | Opcional; modelo Gemini |

`META_APP_ID`, `META_APP_SECRET` y `META_AD_ACCOUNT_ID` están reservadas para posibles flujos futuros y no son requisito del flujo actual.

## Comandos de calidad

```bash
npm run lint
npm run build
npm run test:ai
npm run test:health
```

El repositorio incluye CI en `.github/workflows/ci.yml`, que ejecuta instalación limpia, lint y build sobre pull requests hacia `main` con permisos de solo lectura.

## Seguridad de cambios

Los cambios de integración deben desarrollarse en una rama y validarse antes de llegar a `main`. No se deben modificar tokens, permisos de Business Manager, credenciales o configuración productiva como parte de una refactorización ordinaria.

## Persistencia

Actualmente Meta es la fuente de verdad para métricas. El esquema de Supabase para histórico permanece como referencia y requiere una migración explícita y revisada antes de habilitar escritura o persistencia en producción.
