. "$PSScriptRoot\common.ps1"
$PgBin = Find-Postgres
$backupDir = Join-Path $LocalDir 'backups'
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$backupFile = Join-Path $backupDir ("nexo-" + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.dump')
$env:PGPASSWORD = $env:POSTGRES_PASSWORD
try {
    & (Join-Path $PgBin 'pg_dump.exe') -h $env:POSTGRES_HOST -p $env:POSTGRES_PORT -U $env:POSTGRES_USER -d $env:POSTGRES_DB -Fc -f $backupFile
    Assert-Exit 'Backup PostgreSQL'
} finally { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }
Write-Output "Copia creada: $backupFile"
