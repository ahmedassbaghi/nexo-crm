param([Parameter(Mandatory=$true)][string]$BackupFile, [Parameter(Mandatory=$true)][string]$NewDatabase)
. "$PSScriptRoot\common.ps1"
if ($NewDatabase -notmatch '^[a-z][a-z0-9_]{0,62}$' -or $NewDatabase -in @($env:POSTGRES_DB,'postgres','template0','template1')) { throw 'Elige un nombre nuevo de base de datos; no se permite sobrescribir la base activa.' }
$resolvedBackup = (Resolve-Path -LiteralPath $BackupFile).Path
$PgBin = Find-Postgres
$env:PGPASSWORD = $env:POSTGRES_PASSWORD
try {
    & (Join-Path $PgBin 'createdb.exe') -h $env:POSTGRES_HOST -p $env:POSTGRES_PORT -U $env:POSTGRES_USER $NewDatabase
    Assert-Exit 'Create fresh restore database (must not already exist)'
    & (Join-Path $PgBin 'pg_restore.exe') -h $env:POSTGRES_HOST -p $env:POSTGRES_PORT -U $env:POSTGRES_USER -d $NewDatabase --no-owner --no-privileges --exit-on-error $resolvedBackup
    Assert-Exit 'Restore PostgreSQL'
} finally { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }
Write-Output "Restaurada en $NewDatabase. Verifica el contenido antes de cambiar POSTGRES_DB. La base activa no se ha alterado."
