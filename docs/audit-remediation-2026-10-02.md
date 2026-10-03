# Correcciones del 2 de octubre de 2026

## Evidencia real previa al cambio

Producción estaba en c396b5b8. Se inició sesión y se consultó Campañas → Conversaciones iniciadas para 2026-09-03 a 2026-10-02. Meta devolvió VENTAS 2: 54, HOTEL EXPERT Ventas: 37 e Interacción HE Campaña: 2. Ninguna campaña entregó destino verificable.

Runtime logs de la petición de las 04:20:53 UTC del 3 de octubre confirmaron cinco consultas: conversion_destination como breakdown y action breakdown, y action_destination a nivel campaña, conjunto y anuncio. Los eventos de conversación solo incluyeron action_type y value; destino, canal y destino del clic siguieron ausentes. El desglose exacto permanece bloqueado por la respuesta disponible de Meta; no se declara arreglado.

## Cambios

- La selección del desglose ocurre por campaña. Un resultado parcial ya no detiene los intentos para el resto. Se selecciona una respuesta independiente por campaña; nunca se suman consultas superpuestas.
- Los totales conservan su fuente independiente. Se distinguen desglose completo, parcial, no disponible e incompatible. Si un desglose supera el total o contiene cifras inválidas se descarta; no se atribuye al destino actual del anuncio.
- Campañas muestra las conversaciones restantes cuyo destino no está disponible, además de avisos específicos por campaña.
- El cron comprueba el contrato real con Meta usando una ventana de 30 días y registra evidencia operativa sanitizada en anlux_cron_runs.messaging_contract. La ausencia de conversaciones no certifica el contrato.
- La consulta opcional tiene un límite de 20 segundos y se ejecuta después de registrar el snapshot. Su fallo no marca como fallida la persistencia ni impide el correo.
- Configuración muestra el resultado y la fecha de esa comprobación independientemente del guardado diario. Los registros anteriores permanecen sin verificación; no se rellenan.
- El horario se expresa como alrededor de las 06:00, conforme al scheduler configurado a las 13:00 UTC y los retrasos observados.
- Migración aditiva aplicada y columna jsonb verificada; RLS y accesos existentes se conservan.

## Validación

Regresiones de destinos ausentes observados en producción, varias campañas, respuestas parciales, total incompatible, ausencia de eventos, paginación y consultas superpuestas. Regresión del cron verifica snapshot previo al contrato, autenticación y persistencia/correo independientes de fallo de Meta. Suites de decisiones, inteligencia, memoria, feedback, calidad y cartera pasan. Lint sin errores, build correcto, npm audit sin vulnerabilidades y smoke de seguridad con 16 comprobaciones correctas; APIs Meta y AI rechazan sesiones ausentes.

Se comprobó el AI Analyst en producción en modo Consulta estratégica, sin enviar métricas privadas. Respondió con recomendaciones generales y la ruta /api/ai/analyze registró HTTP 200 a las 04:24:20 UTC. Esto verifica una respuesta de IA en vivo; no identifica el proveedor activo ni certifica el modo de rendimiento.

## Publicación

La revisión automática rechazó el push a KIANAGENCY/ANLUX-ADS alegando falta de autorización explícita para enviar el código fuente privado a ese destino. Los cambios están en un commit local; no se afirma despliegue de esta versión. La migración aditiva de Supabase sí está aplicada.

## Pendientes y límites

- La organización Supabase ANLUX es Free. Leaked password protection requiere Pro o superior según la documentación oficial. No se contrata ni se cambia un plan de pago.
- Hay 48 de 63 decisiones sin resultado previo disponible, distribuidas en ocho rangos originales. No se modifican cifras sin reconsulta verificable. El selector productivo solo ofrece presets y la navegación directa a la API fue bloqueada por el navegador, por lo que no se completó esa recuperación.
- El conector Vercel get_project tiene esquemas incompatibles: exige projectId pero luego valida idOrName; no permite inspeccionar variables. No se elimina el fallback de Supabase antes de corregir la configuración externa que podría sostener el login.
- El próximo cron deberá aportar el primer registro real de la nueva comprobación; tener código y fixtures correctos no equivale a un desglose live completo.
- No se altera el aislamiento del piloto ni se presenta como SaaS listo para terceros.
