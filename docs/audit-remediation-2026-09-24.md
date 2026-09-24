# ANLUX Ads: correcciones de la auditoría del 24 de septiembre de 2026

## Decisiones e histórico

- La migración `20260924172310_refresh_decision_history.sql` deja una decisión vigente por cuenta, periodo y entidad. Conservó las seis versiones desplazadas en `anlux_private.decision_history_revisions`; la tabla privada no permite acceso a `anon` ni a `authenticated`.
- Los guardados por usuario y por el cron actualizan acción, score, evidencia, métricas, razonamiento, `generated_at` y `stored_at` de la decisión vigente. La observación del mismo periodo toma el mismo instante en `captured_at`.
- Los periodos que se guardaron antes de esta corrección pueden seguir mostrando decisiones antiguas hasta que se recalculen expresamente con «Guardar análisis en memoria» en Intelligence. No se falsifican fechas ni evidencias mediante SQL.

## Consulta y guardado

- `GET /api/meta/intelligence` calcula el análisis y consulta el estado de memoria sin escribir en Supabase.
- `POST /api/meta/intelligence` requiere la sesión ANLUX y la comprobación de origen del proxy; recalcula y guarda explícitamente el periodo. El botón de Intelligence es la única llamada interactiva a POST.
- El cron diario sigue guardando su propia observación durante el proceso programado.

## Cron

- El endpoint valida `CRON_SECRET`, el nombre estándar que Vercel transmite en `Authorization: Bearer ...` a sus invocaciones. La programación permanece en `vercel.json` a las 13:00 UTC.
- Para dejarlo operativo, verificar que `CRON_SECRET` exista para Production en Vercel junto con `RESEND_API_KEY` y `ANLUX_BRIEF_RECIPIENT`; retirar `ANLUX_CRON_SECRET` una vez confirmada la rotación. No registrar ni mostrar sus valores.
- Verificar la próxima ejecución en logs del cron y un resultado satisfactorio de Resend. Una compilación o una prueba local de autenticación no acredita por sí sola el envío diario.

El repositorio público y la función incompleta de feedback quedaron fuera de la autorización de esta intervención.
