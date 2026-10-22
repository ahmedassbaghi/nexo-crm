#requires -Version 7.0
$ErrorActionPreference = 'Stop'
$env:NEXT_TELEMETRY_DISABLED = '1'
$RepoRoot = Split-Path $PSScriptRoot -Parent
Set-Location $RepoRoot
$LocalDir = Join-Path $RepoRoot '.local'
New-Item -ItemType Directory -Force -Path $LocalDir | Out-Null
if (Test-Path '.env') {
    foreach ($line in Get-Content '.env') {
        if ($line -match '^(DJANGO_SECRET_KEY|POSTGRES_DB|POSTGRES_USER|POSTGRES_PASSWORD|POSTGRES_HOST|POSTGRES_PORT|DEMO_PASSWORD|GIPHY_API_KEY|KLIPY_API_KEY)=(.*)$') {
            [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], 'Process')
        }
    }
}
function Assert-Exit([string]$Step) {
    if ($LASTEXITCODE -ne 0) { throw "$Step failed (exit $LASTEXITCODE)" }
}
function Find-Postgres {
    if ($env:POSTGRES_BIN -and (Test-Path (Join-Path $env:POSTGRES_BIN 'pg_ctl.exe'))) { return $env:POSTGRES_BIN }
    $installed = Get-ChildItem 'C:\Program Files\PostgreSQL' -Directory -ErrorAction SilentlyContinue |
        Sort-Object { [int]$_.Name } -Descending |
        Where-Object { Test-Path (Join-Path $_.FullName 'bin\pg_ctl.exe') } |
        Select-Object -First 1
    if (-not $installed) { throw 'Install PostgreSQL locally or set POSTGRES_BIN to its bin directory.' }
    return (Join-Path $installed.FullName 'bin')
}
