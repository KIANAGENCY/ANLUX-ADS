# Correcciones del 28 de septiembre de 2026

## Comprobado en producción antes de modificar

- Producción READY en commit 629c8671944580f0178175fc158ee54ccda990f0.
- `anlux_cron_runs`: 0 filas; no hay evidencia de ejecución diaria.
- `decision_history`: 48 filas, ninguna con result_type informado.
- No se modificaron estos registros ni se inventó su semántica.

## Cambios de código

- Configuración consulta los registros operativos después de verificar sesión y rol. Separa memoria manual, último intento, último snapshot exitoso, periodo, error y correo.
- Advierte por ausencia de registros, intentos interrumpidos y más de 26 horas sin actividad. No expone credenciales ni errores crudos de infraestructura.
- Un reintento limpia la finalización anterior para no aparentar que ya terminó.
- Los repositorios manual y de servicio comparten la escritura de snapshots conservando sus clientes y permisos separados. Se mantienen controles de agregado de cuenta, semántica de resultados y upserts idempotentes.
- Creativos pasa a llamarse Anuncios destacados. Las tarjetas aclaran que no hay vista previa y la página especifica el alcance del análisis.
- Se añade revisión visible del historial de decisiones, con validación de cuenta y usuario, lectura bajo RLS y guardado explícito.
- README actualizado para persistencia, configuración diaria y límites del piloto. Se conserva el bloqueo de cuentas externas; no se afirma aislamiento SaaS.

## Pendiente operativo, no resuelto por este commit

- Consultar/activar el scheduler en Vercel y verificar CRON_SECRET y variables de servicio en producción. El conector get_project rechaza su propio esquema (`idOrName`); la CLI no tiene sesión. No hay confirmación de la causa raíz.
- Ejecutar una tarea controlada y verificar un snapshot, después confirmar el siguiente disparo automático.
- Solo después releer los periodos históricos desde Meta para recuperar las 48 decisiones y la brecha diaria. No inferir tipos de resultados.
- Habilitar protección de contraseñas filtradas en Supabase Auth mediante acceso a configuración; los tools disponibles no ofrecen esta escritura.
- Probar Meta y AI Analyst con sesión autenticada real.
- Verificar en sesión productiva el nuevo flujo de feedback visible: permite revisar hasta 20 decisiones guardadas por campaña, con periodo original y notas; no modifica Meta.
- Los índices sin uso se conservan: falta evidencia de carga que justifique eliminarlos. La optimización opcional del recorrido de alertas se difiere sin alterar resultados.

El cambio de observabilidad permite detectar la falla; no equivale a reparar el programador externo.
