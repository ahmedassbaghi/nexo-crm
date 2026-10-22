. "$PSScriptRoot\common.ps1"
if (-not (Test-Path '.env')) {
    $secret = [Guid]::NewGuid().ToString('N') + [Guid]::NewGuid().ToString('N')
    $dbPassword = [Guid]::NewGuid().ToString('N')
    $demoPassword = 'Nexo-' + [Guid]::NewGuid().ToString('N').Substring(0,14)
    @("DJANGO_SECRET_KEY=$secret", 'DJANGO_DEBUG=1', 'POSTGRES_DB=nexo_crm', 'POSTGRES_USER=nexo_crm', "POSTGRES_PASSWORD=$dbPassword", 'POSTGRES_HOST=127.0.0.1', 'POSTGRES_PORT=55439', "DEMO_PASSWORD=$demoPassword") | Set-Content '.env'
    . "$PSScriptRoot\common.ps1"
}
if (-not (Test-Path '.venv\Scripts\python.exe')) { python -m venv .venv; Assert-Exit 'Python environment' }
& '.\.venv\Scripts\python.exe' -m pip install -r apps/api/requirements.lock.txt
Assert-Exit 'Python dependencies'
npm.cmd ci
Assert-Exit 'Frontend dependencies'
& "$PSScriptRoot\database.ps1" start
& '.\.venv\Scripts\python.exe' scripts/bootstrap_db.py
Assert-Exit 'Create database'
& '.\.venv\Scripts\python.exe' apps/api/manage.py migrate
Assert-Exit 'Migrations'
& '.\.venv\Scripts\python.exe' apps/api/manage.py seed_demo
Assert-Exit 'Demo data'
@('# Nexo — acceso local', '', 'Aplicación: http://127.0.0.1:3100', 'Usuario administrador: admin', 'Usuario equipo: equipo', "Contraseña: $($env:DEMO_PASSWORD)", '', 'Datos ficticios. No reutilizar las credenciales en producción.') | Set-Content '.local\ACCESO.md'
Write-Output 'Preparado. Ejecuta scripts/start.ps1. Credenciales en .local/ACCESO.md.'
