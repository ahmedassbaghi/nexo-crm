# CitaCRM — plan de producto y desarrollo

Estado: primera versión local implementada como **Nexo**. Se adaptó el patrón de calendario y reserva de **Hub Local**. Stack conservado: Next.js 16.3.8, React 19.3, TypeScript, Motion, Django 5.2.17, DRF 3.18.1 y PostgreSQL 17. Consultar `ENTREGA.md` para la verificación y los límites reales.

## Objetivo

Aplicación de gestión de citas y CRM para pequeños negocios de servicios, comercializable mediante implantación, personalización y mantenimiento. Primera versión orientada a un negocio con varios profesionales y recursos. La arquitectura deberá permitir separar los datos de cada negocio si se comercializa como SaaS.

No pretende sustituir un ERP industrial. Para talleres y pequeñas empresas de servicios técnicos, una cita puede representar una visita, una intervención o una reserva de equipo.

## Entrega y criterios de alcance

El proyecto se desarrolla en `LocalHub/CitaCRM`, separado del original. La primera entrega incluye aplicación ejecutable con persistencia real, datos de demostración identificados, documentación de instalación y pruebas de los flujos críticos. Los servicios externos que requieran cuentas, dominios o credenciales se documentan sin simular envíos ni cobros reales.

## Módulos de la primera versión

| Módulo | Comportamiento esperado |
| --- | --- |
| Acceso | Inicio y cierre de sesión, contraseñas protegidas, sesiones con caducidad y permisos de administrador y personal. |
| Panel | Citas del día, próximas citas, tareas pendientes e indicadores calculados con datos almacenados. |
| Agenda | Vista por fecha y profesional; crear, editar, reprogramar y cancelar citas; estados pendiente, confirmada, completada, cancelada y no presentado. |
| Disponibilidad | Horario laboral, duración del servicio y bloqueos; impedir solapamientos de profesional o recurso y reservas fuera de horario. |
| Clientes | Alta, edición, búsqueda, contacto, etiquetas, notas e historial de citas y pagos. |
| Servicios | Nombre, descripción, duración, precio y estado activo; conservar el precio y duración históricos de cada cita. |
| Equipo | Profesionales, servicios habilitados y disponibilidad. Desactivar registros sin perder su historial. |
| Recursos | Salas, puestos o equipos que una cita pueda necesitar; control de ocupación. |
| CRM | Oportunidades con etapas de nuevo contacto, contactado, propuesta, ganado y perdido; importe estimado y próxima acción. |
| Tareas | Seguimiento con responsable, fecha de vencimiento, cliente opcional y estado pendiente/completado. |
| Cobros | Registro manual de importe, método, fecha y referencia; saldo pendiente por cita. No equivale a una pasarela ni a facturación fiscal. |
| Informes | Citas completadas, cancelaciones, cobros y actividad por profesional dentro de un intervalo. Exportación CSV autorizada. |
| Configuración | Datos del negocio, moneda, zona horaria, horario, usuarios y preferencias operativas. |

## Reserva pública

Flujo previsto: elegir servicio → profesional o primera disponibilidad → día y hora → datos de contacto → confirmación. La disponibilidad se validará de nuevo al guardar. La confirmación mostrará el resultado real del servidor. La publicación del formulario requerirá protección frente al abuso y no expondrá datos de otros clientes.

## Modelo de datos conceptual

- Negocio: identidad, moneda, zona horaria y configuración.
- Usuario y sesión: identidad de acceso, rol, negocio y caducidad.
- Profesional: usuario opcional, nombre, estado y servicios que presta.
- Servicio: duración, precio, estado y relación con profesionales.
- Recurso: nombre, estado y asignación opcional a servicios/citas.
- Horario y bloqueo: profesional/recurso, intervalos y excepciones.
- Cliente: negocio, nombre, contacto, etiquetas y notas.
- Cita: cliente, servicio, profesional, recurso opcional, inicio/fin, estado, precio y duración pactados.
- Pago: cita, importe, método, fecha y referencia.
- Oportunidad: cliente, etapa, valor estimado, responsable y próxima acción.
- Tarea: responsable, cliente opcional, vencimiento y estado.
- Auditoría: actor, acción, entidad y fecha, evitando registrar secretos.

Todas las relaciones deberán respetar el ámbito del negocio. Los importes se guardarán en unidades monetarias menores; las fechas de los eventos, en UTC, interpretando la disponibilidad en la zona horaria configurada. No se borrarán en cascada los historiales comerciales al desactivar servicios o profesionales.

## Organización del proyecto

La distribución sigue el monorepo original: `apps/web` para Next y `apps/api` para Django, con scripts, pruebas y documentación independientes. Las reglas de disponibilidad, permisos y cobros se comprueban en servidor además de las validaciones de interfaz. La arquitectura detallada está en `ARQUITECTURA.md`.

Documentación prevista:

- `README.md`: instalación, variables, migraciones, datos de prueba y ejecución.
- `docs/PLAN.md`: alcance, arquitectura y decisiones.
- `docs/OPERACION.md`: copias, restauración, configuración y despliegue.
- `docs/ENTREGA.md`: funcionalidades verificadas, limitaciones e integraciones pendientes.

## Secuencia de implementación

1. Identificar el stack original y sus versiones; fijar dependencias y estructura independiente.
2. Preparar persistencia, migraciones, configuración y autenticación.
3. Implementar servicios, profesionales, recursos y clientes.
4. Implementar disponibilidad y agenda, incluyendo validación concurrente de solapamientos.
5. Incorporar tareas, oportunidades y registro de cobros.
6. Añadir panel, informes, exportación y configuración.
7. Implementar reserva pública si el entorno de ejecución permite satisfacer sus controles.
8. Verificar flujos, permisos, persistencia, accesibilidad básica y presentación adaptable.
9. Completar guía de ejecución, límites y lista de trabajo para puesta en producción.

## Verificación de aceptación

- Crear un cliente, un servicio y una cita; comprobar persistencia tras reiniciar.
- Rechazar dos reservas incompatibles para el mismo profesional/recurso, también ante solicitudes concurrentes.
- Reprogramar y cancelar liberando correctamente la disponibilidad.
- Rechazar duraciones, estados, referencias e importes inválidos.
- Registrar un pago y reflejarlo en el saldo e informes sin duplicarlo.
- Completar tareas y avanzar oportunidades; comprobar sus filtros.
- Denegar acceso sin sesión y operaciones administrativas a personal sin permiso.
- Asegurar que identificadores manipulados no permiten acceder a otro negocio.
- Comprobar cambios de zona horaria, límites de día y transiciones de horario de verano.
- Evitar fórmulas ejecutables en exportaciones CSV con contenido de usuarios.
- Verificar navegación por teclado, formularios, errores y uso en móvil.

## Extensiones comerciales

Recordatorios por correo o WhatsApp, pagos online, reservas recurrentes, bonos y membresías, inventario ligero, presupuestos, integración contable, órdenes de trabajo, portal del cliente y sincronización de calendarios. Se priorizarán por sector después de validar la primera versión.

Antes de una venta o despliegue real habrá que concretar alojamiento, dominio, copias y restauración, política de soporte, condiciones comerciales y revisión de requisitos de privacidad y facturación aplicables. Esta planificación no certifica cumplimiento normativo.

## Decisiones de la primera entrega

1. Stack identificado y conservado; se adapta el calendario de Hub Local con diseño propio.
2. Sector transversal de servicios con citas; demostración ficticia de asesoría y servicios profesionales, configurable desde la aplicación.
3. Separación de datos por negocio y alta asistida por comando. Puede servir como base de implantaciones por cliente o de un SaaS; no incluye contratación ni cobro de suscripciones.
4. Entrega local. Dominio, infraestructura pública, proveedor de mensajes y facturación quedan para la implantación.

## Seguimiento de implementación

Las fases 1–8 se han implementado y verificado en el entorno local. La documentación de instalación, operación y entrega completa la fase 9. El alcance funcional está detallado arriba; las restricciones del horario, recursos, volúmenes, cobros e integraciones están recogidas en `ENTREGA.md` para no confundir esta versión con un ERP o una plataforma comercial ya desplegada.
