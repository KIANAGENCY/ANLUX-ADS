# ANLUX Ads: revisión y puesta en producción de las correcciones

Estado al 23 de septiembre de 2026. Estas correcciones no modifican campañas de Meta.

## Completado

- Migraciones de Supabase `20260923163033_harden_member_rls.sql` y `20260923163135_move_membership_helper_private.sql` aplicadas en ANLUX. `anon` no puede ejecutar la función de membresía; `authenticated` la usa para RLS, pero ya no existe el RPC en el esquema público.
- Security Advisor ya no reporta la función; Performance Advisor ya no reporta foreign keys sin índice ni políticas con `auth.uid()` por fila. Los tres avisos de índices sin uso son informativos con el volumen actual.
- Las seis observaciones antiguas de Hotel Expert se recalcularon desde ANLUX con insights reales de Meta y se verificaron en Supabase por periodo y `captured_at` entre 16:52 y 16:55 UTC del 23 de septiembre de 2026. El rango `2026-08-18` a `2026-09-16` pasó de 428.44 a 562.70 MXN de gasto; el rango `2026-08-24` a `2026-09-22` pasó de 1,068.59 a 1,221.90 MXN. Los seis rangos se solapan y no deben sumarse entre sí. Se retiró el control temporal de recálculo después de verificarlos.

## Pendiente por limitación de acceso o plan

1. **Leaked Password Protection** requiere Supabase Pro o superior. La organización ANLUX está en Free. No se cambió la suscripción ni se simuló una protección equivalente. Una actualización de plan implica un pago y requiere un límite de gasto autorizado.
2. Confirmar con uso normal que `/api/meta/health/monitor` refleja 200/503 según Meta, las metas persisten entre navegadores y Today no genera solicitudes de IA por campaña.

La pantalla «Conversaciones iniciadas» muestra atribución y conteos, no el contenido de los chats. Leer mensajes exige una integración distinta y permisos explícitos; no está implementada en esta rama.
