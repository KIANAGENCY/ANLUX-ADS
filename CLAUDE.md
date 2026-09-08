@AGENTS.md

# ANLUX Ads Intelligence — notas de desarrollo

Este archivo contiene únicamente invariantes actuales. El estado funcional y las instrucciones de instalación están en `README.md`.

## Producción

- `main` es la rama conectada al despliegue de producción en Vercel.
- Todo cambio debe pasar por rama/PR y por `npm run lint` + `npm run build` antes de integrarse.
- No fusionar cambios de integración sin revisar el diff y los checks.

## Integridad de datos

- ANLUX no debe sustituir fallos de Meta por datos mock/demo.
- Una cuenta sin actividad debe mostrar estado vacío, no cifras generadas.
- No inventar moneda, fechas, alcance, resultados, objetivos ni benchmarks.
- Los KPIs de cuenta deben usar insights `level=account` cuando la métrica no sea aditiva (especialmente reach/frequency).
- Los resultados se interpretan según el objetivo de cada campaña; no sumar `action_type` heterogéneos.

## Meta Marketing API

- Integración actual: solo lectura.
- `META_ACCESS_TOKEN`, `META_BUSINESS_ID` y demás credenciales/configuración productiva no deben alterarse durante refactors ordinarios.
- El token es server-only. Nunca exponerlo al cliente, logs o respuestas API.
- El descubrimiento de cuentas combina `/me/adaccounts` y, si está configurado, `/{business_id}/client_ad_accounts`.
- Los fallos deben conservar su diagnóstico (token ausente, inválido, permisos insuficientes, fallo temporal, etc.).

## AI Performance Analyst

- Proveedores soportados: Anthropic y Google Gemini.
- El proveedor se selecciona con `AI_PROVIDER`; no existe fallback silencioso.
- Hay dos modos explícitos:
  - `general`: no consulta Meta.
  - `performance`: requiere cuenta y periodo y usa únicamente datos reales.
- Las alertas deterministas de ANLUX se calculan antes del LLM y se pasan como contexto; el LLM explica y recomienda, no inventa métricas ni ejecuta cambios en Meta.

## Supabase

- Supabase Auth es obligatorio para el acceso al panel; no crear sesiones demo locales.
- `src/lib/supabase/schema.sql` es solo referencia. No ejecutar migraciones ni habilitar persistencia real sin una revisión explícita de esquema, RLS y credenciales.

## Seguridad de cambios

- No modificar tokens, secretos, permisos de Business Manager, asignación de cuentas ni variables de producción como parte de tareas de UI/analítica.
- No crear endpoints de escritura sobre Meta sin una decisión explícita del producto.
- No afirmar que una prueba pasó si no existe evidencia de ejecución.
- Los checks de GitHub Actions son la referencia para lint/typecheck/build del PR.
