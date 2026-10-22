# Operación e implantación

## Desarrollo local

Los scripts se ejecutan desde PowerShell 7. La base de datos dedicada se almacena en `.local/postgres`, con escucha solo en loopback y contraseña SCRAM. `scripts/start.ps1` inicia API y web en segundo plano, sin ventanas visibles; sus logs y registros de proceso están en `.local/`. `scripts/stop.ps1` comprueba PID y hora de inicio antes de detener los procesos del proyecto.

Puertos predeterminados: 3100 web, 8100 API, 55439 base de datos. El puerto de base se puede cambiar en `.env`; si el clúster ya existe, también debe coincidir en `.local/postgres/postgresql.conf`. Para cambiar el puerto web, actualiza los scripts, el `package.json` de web y `CSRF_TRUSTED_ORIGINS`. No detengas procesos desconocidos para liberar un puerto.

Los secretos están en `.env`. No copiar el archivo a un repositorio ni reutilizar las cuentas demo en un despliegue. La demostración solo se genera la primera vez y no se reinicia al arrancar.

## Copias

```powershell
.\scripts\backup.ps1
```

Genera un dump consistente de PostgreSQL en `.local/backups`. Incluye clientes, citas, cobros y usuarios; por tanto debe protegerse como los datos originales. El script no envía copias fuera del equipo. Define retención y una copia externa cifrada para un despliegue real. Guarda los secretos necesarios por un canal separado.

## Restauración sin sobrescribir

```powershell
.\scripts\restore.ps1 -BackupFile "C:\ruta\nexo-AAAAMMDD-HHMMSS.dump" -NewDatabase "nexo_recuperado"
```

El comando exige crear una base nueva; no permite la base activa ni una base que ya exista. Si una restauración falla, conserva la base parcial para inspección y no cambia la configuración de la aplicación. Comprueba esquema, número de registros y un recorrido real de acceso/consulta antes de cambiar `POSTGRES_DB` y reiniciar servicios. La restauración no elimina la base anterior.

## Implantar otro cliente

1. Crear un negocio vacío con `manage.py create_business`.
2. Entrar con el administrador creado y revisar nombre, datos de contacto, zona horaria y horario.
3. Añadir servicios, precios y duración. Añadir profesionales y marcar los servicios que prestan.
4. Crear recursos si se necesitan. Añadir bloqueos para descansos o ausencias.
5. Dar accesos al personal desde Configuración. Los usuarios y los profesionales son conceptos independientes.
6. Añadir clientes y hacer una reserva de prueba.
7. Si procede, activar reservas públicas y compartir la URL de ese negocio.

No existe alta autónoma, contratación online de planes SaaS o cobro de suscripción: la implantación es asistida.

## Despliegue real pendiente

Esta entrega está arrancada y verificada en local; no se ha contratado infraestructura ni publicado dominio. Para producción:

- Usar un servidor WSGI compatible con Django, no `runserver`, y servir Next con su compilación de producción.
- PostgreSQL gestionado o supervisado, usuario de aplicación con privilegios mínimos, copias y prueba de restauración periódica. El usuario local creado por `initdb` tiene privilegios de administración y no es el modelo de privilegios de producción.
- Configurar `DJANGO_DEBUG=0`, un `DJANGO_SECRET_KEY` nuevo, `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS` y `API_URL` del servicio de API. `API_URL` debe estar definido al compilar la web porque las reglas de proxy se generan en la compilación.
- Terminar HTTPS correctamente. Con `DEBUG=0` se activan cookies Secure, redirección SSL y HSTS. Si un proxy termina TLS, configurar de forma explícita el encabezado seguro de proxy, eliminando cualquier valor suministrado por el cliente; comprobar que no se producen bucles HTTPS.
- Mantener el endpoint API inaccesible directamente al público si solo se utiliza a través del proxy de la web. Desactivar cachés de datos privados.
- Añadir límites de peticiones compartidos, logs supervisados, alertas de errores y una política de actualizaciones de dependencias.
- Adaptar el texto de privacidad de la reserva al responsable y tratamiento concretos; establecer retención, exportación y borrado/anominización cuando proceda. La existencia de un checkbox no certifica cumplimiento legal.
- Verificar carga con el volumen real. Antes de grandes historiales, sustituir bootstrap por paginación y consultas por rango.

## Integraciones y límites operativos

No hay envíos automáticos por email, SMS o WhatsApp. No hay pasarela de pagos, facturas fiscales, devolución automática ni sincronización externa de calendario. Las oportunidades no generan presupuestos PDF. Los cobros representan importes que una persona registra como cobrados.

Si se cancela una cita con cobros, el historial se conserva y la UI indica que la devolución debe gestionarse externamente. Esta versión no tiene movimientos negativos ni conciliación bancaria; no debe presentarse como software contable.

Las reservas públicas crean clientes separados en caso de coincidencia de correo para evitar asociar a un anónimo con el historial de una persona. La revisión y deduplicación avanzada quedan para una ampliación.

El restablecimiento de acceso por email tampoco está integrado. El administrador técnico puede usar `manage.py changepassword <usuario>`; cada usuario puede cambiar su propia contraseña conociendo la actual.
