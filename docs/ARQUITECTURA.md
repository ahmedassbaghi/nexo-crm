# Arquitectura de Nexo

## Separación de responsabilidades

La interfaz Next.js se comunica con Django a través de `/api/` en el mismo origen. Next conserva el sufijo `/` al reenviar rutas, como requiere el enrutamiento Django. Las sesiones son cookies HttpOnly, con CSRF obligatorio en autenticación y mutaciones, incluida la reserva pública. Las respuestas privadas no deben cachearse en proxies.

El servidor es la autoridad de los permisos, precios, fechas y disponibilidad. Deshabilitar controles en la interfaz no es una barrera de seguridad. Cada usuario tiene una pertenencia a un negocio con rol administrador o equipo. No existe selección de negocio por identificador enviado desde el cliente para operaciones privadas.

## Datos y transacciones

Todas las entidades de negocio tienen `business_id`. Los serializers restringen los campos relacionales al negocio autenticado; los viewsets restringen sus consultas del mismo modo. La reserva pública determina el negocio exclusivamente por su slug habilitado y jamás devuelve clientes, notas, cobros ni citas existentes.

Cada mutación toma un bloqueo `SELECT ... FOR UPDATE` sobre el negocio dentro de una transacción PostgreSQL. El ámbito de bloqueo es deliberadamente sencillo: serializa las escrituras de cada pequeño negocio, pero permite que negocios diferentes trabajen en paralelo. Disponibilidad, creación y reprogramación vuelven a comprobar intervalos en servidor. La prueba concurrente comprueba dos solicitudes reales con conexiones distintas contra PostgreSQL.

Las citas guardan nombre del servicio, duración y precio históricos. Cambiar el catálogo no cambia el acuerdo de una cita ya creada. `version` impide guardar cambios sobre una cita desactualizada. Las claves UUID de solicitud evitan repetir altas de citas o cobros cuando se reintenta una solicitud.

Las citas no se borran: se cancelan. Los clientes, servicios, recursos y profesionales se archivan. Las relaciones históricas usan `PROTECT`. Los cobros son inmutables; la versión actual no tiene libro de ajustes o devoluciones. Las tareas y bloqueos sí pueden eliminarse.

## Tiempo y disponibilidad

- PostgreSQL almacena instantes conscientes de zona horaria; la representación de las citas usa la zona del negocio.
- Horario semanal común, entre apertura y cierre del mismo día, con inicios cada 15 minutos.
- Servicios de 15 a 480 minutos en múltiplos de 15; horizonte máximo de reserva de 365 días.
- Los bloqueos pueden afectar a un profesional o al negocio completo. Para horarios individuales o descansos se utilizan bloqueos.
- Una cita puede ocupar un recurso opcional de capacidad uno.
- Se rechazan horas locales ambiguas o inexistentes por cambios de horario de verano.
- Las citas canceladas liberan el intervalo. Completadas y no presentadas conservan su ocupación histórica.
- Cambiar el horario no reprograma ni cancela citas existentes.

## Interfaz y accesibilidad

Componentes React con TypeScript, estilos propios y animaciones de Motion que respetan reducción de movimiento. El calendario conserva de Hub Local la densidad por día, el número de inicios disponibles, el uso de flechas y la selección animada. Los diálogos nativos gestionan el foco, Escape y el bloqueo de interacción con el fondo. El tablero y las tablas tienen desplazamiento horizontal contenido en pantallas pequeñas.

La UI principal es una aplicación de una página con rutas de sección en el fragmento (`#agenda`, `#clients`, etc.) y una ruta Next independiente para reserva pública. El estado persistente se obtiene de PostgreSQL. La recarga vuelve a obtener datos del servidor.

## Decisiones y límites conscientes

La primera entrega usa una carga agregada `/api/bootstrap/` para simplificar la sincronización de los módulos. Es adecuada para la validación local y pilotos pequeños, pero deberá sustituirse por consultas paginadas y por rango antes de crecer a historiales grandes. Los filtros y los informes visuales se calculan sobre esa respuesta, siempre dentro del ámbito del negocio.

La agenda no usa WebSockets: se actualiza después de guardar, al abrir disponibilidad o al pulsar Actualizar. Un segundo navegador puede mostrar datos antiguos, pero el servidor rechaza un solapamiento o una versión de cita desactualizada al guardar.

Las nuevas solicitudes públicas crean una ficha separada para evitar que conocer un email permita asociarse al historial privado de otra persona. No se ha implementado la fusión de duplicados. La gestión de consentimiento comercial y el marketing están fuera del alcance.

El throttling DRF usa la caché local de proceso en desarrollo. Un despliegue con varios workers debe aplicar límites compartidos en el proxy o una caché compartida. No sustituye a protección antiabuso de infraestructura.

## API principal

| Ruta | Uso |
| --- | --- |
| `/api/session/` | Usuario, negocio y token CSRF |
| `/api/login/`, `/api/logout/`, `/api/password/` | Gestión de acceso |
| `/api/bootstrap/` | Datos privados del negocio |
| `/api/clients/`, `/api/services/`, `/api/professionals/`, `/api/resources/` | Maestros |
| `/api/appointments/`, `/api/availability/`, `/api/blocks/` | Agenda |
| `/api/tasks/`, `/api/opportunities/`, `/api/payments/` | CRM y cobros |
| `/api/settings/`, `/api/users/` | Administración |
| `/api/export/?kind=clients` | Clientes CSV (administrador) |
| `/api/export/?kind=payments&from=AAAA-MM-DD&to=AAAA-MM-DD` | Cobros CSV por periodo |
| `/api/public/<slug>/`, `/api/public/<slug>/book/` | Oferta, disponibilidad y solicitud pública |
