# Seguridad de ANLUX Ads Intelligence

ANLUX es una aplicación interna que consulta datos reales de Meta Marketing API y puede consumir proveedores de IA de pago. El principio de seguridad es **fail-closed**: si autenticación o una integración crítica no está disponible, la aplicación debe negar acceso o mostrar un error explícito; nunca sustituirlo por datos simulados.

## Fronteras de confianza

- El navegador solo recibe la clave pública de Supabase (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`).
- `META_ACCESS_TOKEN`, `META_APP_SECRET`, `ANTHROPIC_API_KEY` y `GEMINI_API_KEY` son secretos exclusivamente de servidor.
- Las rutas `/api/meta/*` y `/api/ai/*` requieren sesión Supabase revalidada en servidor.
- Meta se usa en modo lectura. No existen endpoints de ANLUX que creen, editen, pausen o eliminen campañas.
- Los proveedores de IA no reciben herramientas/function calling y su salida se valida contra un schema cerrado.

## Controles implementados

- Sin modo demo ni credenciales simuladas.
- APIs internas protegidas por autenticación server-side.
- Defensa de mismo origen para métodos HTTP no seguros de APIs internas.
- Respuestas de APIs protegidas marcadas `private, no-store`.
- IDs de cuenta y rangos de fecha validados y acotados.
- Solicitudes al AI Analyst con límite de tamaño y longitud de pregunta.
- Cabeceras HTTP de seguridad y `X-Powered-By` deshabilitado.
- `.env*` ignorado por Git salvo `.env.example` sin valores.
- Módulos de Meta e IA marcados `server-only`.
- Supabase futuro documentado con RLS habilitado y sin policies permisivas por defecto.
- CI con permisos mínimos (`contents: read`), acciones fijadas por SHA, `npm audit`, lint, build y smoke tests de seguridad.

## Controles externos que deben mantenerse

Estos controles no viven en el repositorio y deben comprobarse en sus respectivos paneles:

1. **Supabase Auth:** para una app interna, deshabilitar registro público o usar un mecanismo explícito de invitación/allowlist. No basta con ocultar la pantalla de registro.
2. **GitHub:** preferir repositorio privado y proteger `main` exigiendo PR + CI antes de merge.
3. **Vercel:** guardar secretos únicamente como variables de entorno privadas; nunca usar prefijo `NEXT_PUBLIC_` para tokens de Meta o claves de IA.
4. **Meta:** usar un token con el mínimo permiso necesario (lectura) y rotarlo/revocarlo inmediatamente si se sospecha exposición.
5. **MFA:** mantener 2FA/MFA habilitado en GitHub, Vercel, Supabase y Meta Business.
6. **Persistencia futura:** no desplegar el esquema de Supabase hasta definir y probar policies RLS por usuario/rol.

## Respuesta ante exposición de secretos

Si un secreto aparece en Git, logs, capturas públicas o un canal no confiable, eliminarlo del código **no es suficiente**. Debe revocarse/rotarse en el proveedor correspondiente y luego actualizarse en Vercel. Evitar registrar URLs completas de Graph API o cuerpos de proveedores que puedan incluir datos sensibles.

## Revisión continua

Cada PR debe pasar CI. Las dependencias de producción se auditan con `npm audit --omit=dev --audit-level=high`; cualquier vulnerabilidad alta o crítica debe resolverse antes de integrar a `main`.
