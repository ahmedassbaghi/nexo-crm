# Entrega — Nexo

Fecha: 12 de octubre de 2026.

## Resultado

Aplicación independiente y funcional de agenda y CRM en `CitaCRM`, con marca provisional **Nexo**. Utiliza el stack y las versiones del proyecto Hub Local indicado por el usuario. Conserva el concepto de su calendario y selección de citas, pero desarrolla un dominio y una interfaz nuevos, sin reutilizar el portal municipal ni sus datos.

## Recorridos disponibles

1. Acceder como administrador o equipo y consultar el panel con datos reales de la base.
2. Crear un cliente; consultar su ficha, notas, citas y cobros.
3. Crear servicios, profesionales y recursos. Asignar servicios a cada profesional.
4. Reservar desde un asistente: servicio, profesional, cliente, recurso opcional, día, hora y revisión.
5. Consultar agenda diaria, semanal o lista; confirmar, reprogramar, completar, marcar no presentado o cancelar.
6. Registrar un cobro parcial o completo y consultar saldos pendientes.
7. Añadir tareas, asignarlas y completarlas; crear oportunidades y moverlas entre etapas.
8. Consultar informes por intervalo y exportar clientes o cobros en CSV.
9. Configurar negocio, horario, zona horaria, acceso público, usuarios y contraseña.
10. Solicitar una cita sin entrar al CRM desde la página pública del negocio.

Las escrituras son persistentes en PostgreSQL, no datos temporales del navegador. Los datos demo están identificados y no representan clientes reales.

## Verificación de la primera versión

- Compilación de producción Next.js y comprobación TypeScript.
- 21 pruebas del servidor: permisos, ámbito de negocio, CSRF, conflictos, bloqueo de recursos, concurrencia de dos reservas, reprogramación transaccional, versiones, precio histórico, cobros y reintentos, calendario, cambios de hora, exportación segura y conservación del historial.
- Recorridos Playwright: cliente → cita → cobro parcial → reprogramación → recarga → cancelación; tareas y oportunidad; configuración; reserva pública; navegación móvil.
- Revisión visual de escritorio a 1440 px y móvil a 390 px. Capturas locales en `.local/`.
- Axe con reglas WCAG 2 A/AA en acceso, pantallas principales y selector. Esta revisión automatizada no equivale a una certificación completa de accesibilidad.
- Copia PostgreSQL mediante `pg_dump`; procedimiento de restauración a una base nueva que no sobrescribe la activa.

## Límites explícitos

La entrega se ejecuta en local y no se ha publicado un servicio de producción. No tiene correo/WhatsApp/SMS, cobros online, facturación fiscal, devoluciones, conciliación bancaria, sincronización de calendarios, generación automática de PDF en servidor, inventario ni órdenes de fabricación. Esas funciones figuran como ampliaciones, no como controles ficticios en la interfaz.

La agenda usa un horario común por negocio con bloqueos para excepciones; no tiene turnos semanales propios por profesional, horarios nocturnos ni pausas recurrentes. Los recursos son opcionales y de capacidad uno. La reserva pública no exige un recurso de servicio ni permite al visitante escogerlo.

Cada usuario pertenece a un solo negocio; no se ha desarrollado una consola de consultoría para operar varios clientes con la misma cuenta. El alta de negocios se realiza mediante el comando `create_business`, no mediante contratación pública de planes.

La respuesta inicial carga el conjunto de datos del negocio y la actualización entre navegadores es manual. Se necesita paginación y consultas por intervalo para volúmenes grandes. No se ha hecho una prueba de carga de producción.

Los contactos anónimos no se enlazan automáticamente con fichas existentes, y no existe una herramienta de fusión. Los cobros no se editan y una devolución se gestiona fuera de esta versión.

## Siguiente implantación comercial

Elegir un sector piloto y adaptar catálogo, identidad y textos. Preparar infraestructura HTTPS, copias externas, soporte y condiciones de tratamiento de datos. Conectar únicamente las integraciones que demande ese piloto. El documento de operación detalla las decisiones técnicas pendientes de despliegue.


## Ampliación CRM — 13 de octubre de 2026
La versión actual incorpora mesa de trabajo comercial, fichas 360, conversaciones, responsables, procedencia y ciclo de contacto; previsión ponderada y filtros comerciales; presupuestos con documento imprimible, estados y contenido congelado al registrar el envío; búsqueda global e informes comerciales. «Nueva cita» se muestra como acción de cabecera exclusivamente en Agenda.

La edición comercial añade pruebas de cálculo/redondeo, límites numéricos, versiones, estados, caducidad, snapshots, aislamiento de empresas, autoría, inmutabilidad, numeración concurrente y carga de demostración idempotente. No se ejecutaron pruebas de navegador en esta ampliación, por petición del usuario. Los resultados visuales de la primera versión no deben interpretarse como validación de estas pantallas nuevas. El documento imprimible se puede guardar como PDF usando la función de impresión del navegador; no se genera ni se envía un archivo automáticamente.

El diagnóstico y las siguientes prioridades se detallan en EVOLUCION-CRM.md. La migración conserva los registros anteriores. Los nuevos ejemplos se añaden únicamente al negocio `estudio-norte` si tiene `is_demo=True` y una sola vez, mediante `seed_crm_demo`.
