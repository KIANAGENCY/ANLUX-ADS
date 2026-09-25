# ANLUX Ads: decisiones y camino a SaaS

## Propósito

Ayudar a una persona a decidir qué hacer con sus campañas de Meta, en lenguaje claro y con evidencia verificable, para cuidar el presupuesto. La aplicación recomienda; el usuario decide y ejecuta en Meta. No debe inventar resultados, prometer ventas ni confundir un clic, una conversación y una compra.

## Estado operativo de esta versión

- Lee una cuenta publicitaria de Hotel Expert mediante un token privado del servidor.
- Evalúa campañas, conjuntos y anuncios con reglas deterministas y muestra gasto, resultados, señales, nivel de confianza y límites.
- Compara costos entre campañas únicamente si comparten objetivo y acción primaria de resultado, con volumen suficiente. Recomienda comparar calidad o una prueba pequeña; no mueve presupuestos.
- Permite confirmar metas de negocio y registrar manualmente conversaciones calificadas. La calidad registrada aún no interviene automáticamente en la clasificación.
- El análisis de IA recibe las mismas decisiones y comparaciones para explicarlas; su salida requiere validación continua frente a datos reales.
- Una proyección numérica futura queda desactivada hasta tener serie diaria y horizonte temporal definidos.

## Antes de vender licencias

### 1. Aislamiento por organización y cuenta (bloqueante)

Hoy `ACTIVE_META_CLIENT` fija Hotel Expert y `META_ACCESS_TOKEN` es global. Las políticas actuales de Supabase permiten que miembros internos compartan las tablas de inteligencia. No se puede habilitar un selector de cuentas externas con estas reglas.

Crear organizaciones, membresías con roles y acceso explícito a cuentas. En cada consulta y escritura, resolver la cuenta desde la sesión y la membresía; las políticas RLS deben limitar filas por organización/cuenta. Probar que dos organizaciones no se vean entre sí en API, tablas, historial, IA y tareas programadas. Migrar historial existente de Hotel Expert sin perderlo.

### 2. Conexión de Meta por cliente (bloqueante)

Implementar Facebook Login for Business con consentimiento y permisos de lectura necesarios; seleccionar activos que el usuario realmente autorizó. Guardar tokens cifrados solo en servidor, controlar renovación/revocación y presentar errores de permisos o expiración. Obtener revisión de la app y el nivel de acceso aplicable antes de ofrecer el flujo a terceros. Cada cron debe trabajar con el contexto y credenciales de la organización correspondiente, nunca con el token global.

### 3. Decisiones confiables y medibles (bloqueante)

Registrar por cuenta el resultado principal que importa (conversación, lead, compra) y el costo objetivo confirmado. Separar cantidad de resultados de calidad comercial: habilitar importación o confirmación de conversaciones calificadas, citas y ventas. Comparar periodos con la misma ventana de atribución y el mismo tipo de evento; mostrar por qué una decisión se bloquea cuando falta evidencia. Validar retrospectivamente recomendaciones con casos reales y revisión humana; medir aceptación, falsos positivos y costo por resultado calificado después de cada prueba.

### 4. Onboarding y experiencia para principiantes

Flujo guiado: crear organización, conectar Meta, elegir cuenta, definir objetivo de negocio y meta de costo, verificar primera lectura, mostrar una decisión con evidencia y siguiente paso. Incluir glosario contextual para gasto, costo por resultado, volumen, tendencia y confianza. Estados claros para token vencido, cero resultados, baja muestra y calidad no capturada.

### 5. Operación comercial

Límites de uso, tareas por organización, colas y control de cuotas de Meta, observabilidad, auditoría, privacidad y borrado de datos, coste por proveedor IA, suscripciones y soporte. Ningún cliente externo debe entrar antes de completar los controles de acceso y las pruebas de aislamiento.

## Criterio de salida del piloto

Una cuenta externa conecta sus propios activos sin exponer otras cuentas; ANLUX muestra métricas reproducibles, distingue tipos de resultado, emite al menos una decisión comprensible cuando existe evidencia y sabe responder «esperar y medir» cuando no la hay. Dos usuarios de organizaciones diferentes no pueden ver ni alterar información ajena. Las recomendaciones se revisan frente a resultados posteriores y el usuario puede reportar si fueron útiles.

Referencias: [Meta Marketing API](https://developers.facebook.com/documentation/ads-commerce/marketing-api/get-started/), [Ads Insights](https://developers.facebook.com/documentation/ads-commerce/marketing-api/insights/), [Facebook Login for Business](https://developers.facebook.com/documentation/facebook-login/facebook-login-for-business/), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
