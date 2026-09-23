# ANLUX Ads: revisión y puesta en producción de las correcciones

Rama: `fix/audit-2026-09-23`. Este cambio no modifica campañas de Meta.

## Al integrar

1. Ejecutar la migración `20260923160953_harden_member_rls.sql` en un entorno de prueba, comprobar políticas SELECT/INSERT/UPDATE como miembro y rechazo para `anon`, y después aplicarla en producción mediante el flujo de migraciones. Confirmar Security y Performance Advisors. No se aplicó desde esta rama.
2. En Supabase Auth, activar **Leaked Password Protection** y comprobar el inicio de sesión y la recuperación de contraseña. Es una configuración del proyecto, no una migración SQL.
3. Tras desplegar, comprobar `/api/meta/health/monitor` con sesión ANLUX: 200 cuando Meta responde y 503 cuando una dependencia falla. `/api/meta/health` conserva su respuesta legible para Configuración.
4. Verificar en Today que una carga no llama `/api/ai/analyze` por campaña. Confirmar que las metas cargan desde Supabase y que el botón «Guardar metas» persiste entre navegadores.
5. Volver a consultar, con una sesión autorizada, los seis periodos que ya figuran en `account_period_observations` para sobrescribir sus totales anteriores con insights agregados de cuenta. Registrar los rangos antes de la migración y comparar gasto, impresiones, alcance, clics y resultados con Meta. Si Meta omite el agregado de cuenta, el periodo no se sobreescribe y requiere revisión manual. No inferir que el histórico antiguo está corregido solo por desplegar el código.
6. Comprobar el cron diario, las recomendaciones, el acceso por roles y las políticas de seguridad tras el despliegue.

La pantalla «Conversaciones iniciadas» muestra atribución y conteos, no el contenido de los chats. Leer mensajes exige una integración distinta y permisos explícitos; no está implementada en esta rama.
