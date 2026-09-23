# ANLUX Ads: revisión y puesta en producción de las correcciones

Estado al 23 de septiembre de 2026. Estas correcciones no modifican campañas de Meta.

## Completado

- Migraciones de Supabase `20260923163033_harden_member_rls.sql` y `20260923163135_move_membership_helper_private.sql` aplicadas en ANLUX. `anon` no puede ejecutar la función de membresía; `authenticated` la usa para RLS, pero ya no existe el RPC en el esquema público.
- Security Advisor ya no reporta la función; Performance Advisor ya no reporta foreign keys sin índice ni políticas con `auth.uid()` por fila. Los tres avisos de índices sin uso son informativos con el volumen actual.

## Pendiente por limitación de acceso o plan

1. **Leaked Password Protection** requiere Supabase Pro o superior. La organización ANLUX está en Free. No se cambió la suscripción ni se simuló una protección equivalente. Una actualización de plan implica un pago y requiere un límite de gasto autorizado.
2. Las seis observaciones antiguas (rangos `2026-08-18` a `2026-09-16`, `2026-08-19` a `2026-09-17`, `2026-08-21` a `2026-09-19`, `2026-08-22` a `2026-09-20`, `2026-08-23` a `2026-09-21` y `2026-08-24` a `2026-09-22`) siguen con sumas de decisiones. Para corregirlas, consultar `/api/meta/intelligence` por cada rango con sesión ANLUX autorizada y comprobar el resultado contra Meta. El intento de inicio de sesión automatizado fue rechazado por credenciales incorrectas. No alterar las filas manualmente ni tratarlas como verificadas.
3. Confirmar en una sesión ANLUX que `/api/meta/health/monitor` refleja 200/503 según Meta, las metas persisten entre navegadores y Today no genera solicitudes de IA por campaña.

La pantalla «Conversaciones iniciadas» muestra atribución y conteos, no el contenido de los chats. Leer mensajes exige una integración distinta y permisos explícitos; no está implementada en esta rama.
