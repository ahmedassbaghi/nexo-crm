# Evolución de Nexo: de agenda a CRM de trabajo

## Posicionamiento
Un CRM para equipos pequeños de servicios, comercios y empresas B2B: saber quién es el cliente, qué se ha hablado, qué se le ha ofrecido y cuál es el siguiente paso. La ventaja buscada es rapidez y claridad, no acumular módulos sin conexión. La agenda conserva su calidad, pero pasa a ser una herramienta dentro del CRM.

## Diagnóstico y alcance de esta iteración
| Área | Carencia anterior | Desarrollo |
|---|---|---|
| Inicio | Demasiado centrado en reservas | Mesa de trabajo con seguimiento vencido, ventas abiertas, previsión ponderada, tareas y actividad |
| Navegación | Nueva cita en todas las pantallas | Acción de cita solo en Agenda; acciones específicas en los módulos; búsqueda global con Ctrl/Cmd K |
| Contactos | Ficha con citas y notas estáticas | Ciclo comercial, procedencia, responsable y ficha 360 con conversaciones, ventas, presupuestos y tareas |
| Seguimiento | No había registro de conversaciones | Registro de llamada, correo, reunión y nota con fecha, autor y relación al contacto |
| Ventas | Etapas y cantidad sin contexto | Responsable, probabilidad, cierre previsto, motivo de pérdida y previsión ponderada |
| Presupuestos | Ausentes | Líneas, cantidades, descuentos e impuestos; totales calculados en servidor, numeración por empresa, estados y documento imprimible |
| Consistencia | Riesgo de cambios en documentos enviados | Versionado, transiciones controladas, datos del emisor/receptor congelados al enviar y aislamiento entre empresas |

## Estructura técnica
Se conserva Next/React/TypeScript y Django/DRF/PostgreSQL. Componentes separados para mesa de trabajo, búsqueda, ficha 360 y presupuestos. Los modelos nuevos se incorporan mediante migraciones aditivas; no se reinicia la base de datos. El servidor es autoridad sobre totales y transiciones. Los cambios siguen el aislamiento por empresa y el registro de auditoría existentes.

## Criterios de uso
- Una acción principal por contexto; no repetir botones de reserva en módulos comerciales.
- Las cifras distinguen previsión, presupuesto e ingreso cobrado.
- El registro de un correo no lo envía; marcar un presupuesto enviado registra un envío realizado fuera de Nexo.
- Un presupuesto no es una factura ni constituye contabilidad fiscal.
- Estados vacíos útiles, enlaces al cliente, búsqueda tolerante a acentos y controles utilizables con teclado.

## Qué falta para competir como producto comercial
1. Validar con 5–10 negocios de un segmento concreto: tiempo para registrar un contacto, preparar una oferta y recuperar un seguimiento; uso semanal y retención. No se puede garantizar adopción universal.
2. Incorporación guiada e importación CSV con vista previa, mapeo y duplicados; empresas como entidad independiente y contactos asociados.
3. Correo y calendario sincronizados, recordatorios y automatizaciones con reintentos, consentimiento y observabilidad. Requieren proveedores y credenciales reales.
4. Facturación adaptada a la jurisdicción, abonos, cobros fuera de citas y conciliación. No vender los registros actuales como contabilidad fiscal.
5. Despliegue con HTTPS, recuperación de contraseña, MFA, roles granulares, políticas de retención, exportación completa, copias automáticas y restauraciones verificadas.
6. Paginación y búsqueda en servidor, índices y métricas con grandes volúmenes. El bootstrap actual sigue pensado para equipos pequeños.
7. Validación visual y de accesibilidad en dispositivos reales antes de publicar. En esta iteración se omiten las pruebas de navegador por petición del usuario; se comprueban código, compilación y reglas del servidor.

## Referencias de producto
Se toman como referencia capacidades públicas, sin copiar su interfaz: [gestión de contactos de HubSpot](https://www.hubspot.com/products/crm/contact-management), [pipeline y actividades de Pipedrive](https://www.pipedrive.com/en/products/sales/processes-pipeline-activities/) y [cronología de contactos](https://support.pipedrive.com/en/article/contacts-timeline). La inferencia de producto es priorizar historial compartido, seguimiento y propuestas antes de añadir más opciones a la agenda.

## Validación de esta iteración
- 31 pruebas Django correctas, incluyendo concurrencia de reservas y numeración de presupuestos.
- Compilación de producción Next.js y comprobación TypeScript correctas.
- Migraciones aplicadas; comprobación de modelos sin migraciones pendientes.
- Copia de seguridad anterior a las migraciones: `.local/backups/nexo-20261013-001207.dump`.
- No se han realizado pruebas de navegador ni validación visual de las pantallas nuevas, siguiendo la petición del usuario.
