# Nexo — CRM para pequeños negocios

Aplicación CRM independiente para pequeños negocios, creada con el stack de **Hub Local**. Nexo tiene dominio, interfaz y base de datos propios. Del proyecto de referencia se ha adaptado el patrón de calendario de disponibilidad, selección de horas y revisión de una reserva; no se han copiado datos ni credenciales.

## Abrir la aplicación

**http://127.0.0.1:3100**

En la instalación local, las credenciales de demostración se generan al ejecutar `setup.ps1` y se guardan en `.local/ACCESO.md`, fuera de Git. Usuarios de demostración: `admin` y `equipo`. La contraseña se genera durante la preparación, nunca está incluida en el código.

Reserva de demostración: **http://127.0.0.1:3100/reservar/estudio-norte**. Los datos y contactos de Estudio Norte son ficticios.

## Funcionalidades implementadas

- Mesa de trabajo comercial con seguimientos pendientes, previsión ponderada, tareas, conversaciones y agenda del día.
- Búsqueda global de contactos, ventas, presupuestos y tareas mediante Ctrl/Cmd K.
- Agenda por profesional en vistas de día, semana y lista; filtros, detalle, confirmación, reprogramación, cancelación, completado y no presentado.
- Asistente de cita con servicios, profesional, cliente, recurso opcional, calendario de disponibilidad, horas y revisión final.
- Reservas públicas sin acceso al CRM; entran pendientes de confirmación del negocio.
- Contactos con ciclo comercial, procedencia, responsable, etiquetas y archivo; ficha 360 con cronología de conversaciones, citas, presupuestos, oportunidades y tareas.
- Registro inmutable de llamadas, reuniones, correos y notas con fecha y autor. No envía mensajes.
- Presupuestos con conceptos, cantidades, descuento, impuestos y totales calculados en servidor; estados, numeración, control de versiones, duplicación y documento imprimible / guardar como PDF desde el diálogo de impresión.
- Oportunidades por etapas, probabilidad, responsable, cierre previsto, motivo de pérdida y próxima acción; tareas con responsable, cliente, prioridad y vencimiento.
- Cobros manuales completos o parciales, saldos pendientes, historial y exportación CSV.
- Servicios con duración, precio y color; profesionales y servicios habilitados; recursos compartidos y bloqueos por profesional o negocio.
- Informes comerciales de cartera, responsables, procedencia y tasa de éxito; informes de citas y cobros por intervalo y profesional. Configuración de datos del negocio, horarios, zona horaria y reservas públicas.
- Acceso por sesión, CSRF, dos roles, gestión de usuarios, cambio de contraseña, aislamiento de negocios y registro de actividad.

## Stack

Next.js **16.3.8**, React **19.3.0**, TypeScript **5.9**, Motion **14**; Python **3.13**, Django **5.2.17**, Django REST Framework **3.18.1**, PostgreSQL **17**. Dependencias fijadas en `package-lock.json` y `apps/api/requirements.lock.txt`. No utiliza SQLite ni almacenamiento del navegador para los datos del negocio.

## Instalación local (Windows / PowerShell 7)

Requisitos: Node.js 22–24, Python 3.13 y PostgreSQL instalado. El script detecta PostgreSQL en `C:\Program Files\PostgreSQL`; también acepta `POSTGRES_BIN` apuntando a su carpeta `bin`.

```powershell
cd ruta\al\proyecto
.\scripts\setup.ps1
.\scripts\start.ps1
```

`setup.ps1` prepara dependencias, secretos, una instancia PostgreSQL dedicada, migraciones y datos de demostración. No reinicia los datos si ya existe la demostración. Detén los servicios antes de volver a instalar dependencias.

Puertos: web **3100**, API **8100**, PostgreSQL **55439**. La instancia de referencia y sus bases permanecen separadas.

```powershell
.\scripts\stop.ps1
```

## Estructura

```text
apps/web/app/               Rutas Next, estilos y páginas de error
apps/web/components/        Interfaz, calendario, formularios y paneles
apps/web/lib/               Contratos TypeScript, API y formatos
apps/api/config/            Configuración Django y rutas REST
apps/api/crm/models.py      Modelo de negocio
apps/api/crm/serializers.py  Validación y ámbitos de relaciones
apps/api/crm/scheduling.py  Disponibilidad, conflictos y zonas horarias
apps/api/crm/views.py       Sesiones, API, reservas públicas y exportaciones
apps/api/crm/migrations/    Esquema versionado de PostgreSQL
apps/api/crm/tests.py       Pruebas de reglas de negocio y concurrencia
tests/                     Recorridos de navegador con Playwright
scripts/                   Instalación, arranque, pruebas, copias y restauración
docs/                      Plan, arquitectura, operación y entrega
.local/                    Datos locales, logs y accesos (no versionados)
```

## Comprobar el proyecto

```powershell
.\scripts\test.ps1
npm.cmd run build
```

Las pruebas de navegador utilizan Microsoft Edge en modo headless y un negocio aislado que se retira al terminar. Las pruebas del servidor usan una base PostgreSQL temporal. `scripts/preview-check.cjs` revisa la demostración sin modificarla y genera capturas de escritorio y móvil en `.local/`.

## Alta de un negocio real vacío

```powershell
.\.venv\Scripts\python.exe apps/api/manage.py create_business --name "Mi negocio" --slug "mi-negocio" --username "mi-admin"
```

El comando solicita una contraseña sin mostrarla. También admite la variable `NEXO_ADMIN_PASSWORD`. No activa la reserva pública hasta que el administrador la habilite. Al entrar: configura horario, crea servicios, crea profesionales y asigna sus servicios; después añade clientes y citas.

## Estado y alcance

Aplicación funcional para desarrollo y demostración local. Publicar este código en GitHub no despliega el servicio ni lo prepara automáticamente para producción. La autenticación es de sesión y la configuración de desarrollo usa `DEBUG=1`; antes de exponerla en Internet hay que configurar los valores de producción y completar los puntos operativos descritos en [OPERACION.md](docs/OPERACION.md). Los recordatorios por correo/WhatsApp, pagos online, facturación fiscal, devoluciones automáticas, calendarios externos y un ERP industrial no están implementados ni simulados.

- [Plan y alcance](docs/PLAN.md)
- [Arquitectura y decisiones](docs/ARQUITECTURA.md)
- [Operación y copias](docs/OPERACION.md)
- [Entrega y limitaciones](docs/ENTREGA.md)

## Evolución comercial

El diagnóstico, los desarrollos de esta iteración y el trabajo pendiente para competir como producto están en [docs/EVOLUCION-CRM.md](docs/EVOLUCION-CRM.md). Las pruebas de navegador de la primera versión no validan esta ampliación; esta iteración se verifica con pruebas del servidor y compilación, por petición del usuario.
