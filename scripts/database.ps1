param([ValidateSet('start','stop')][string]$Action = 'start')
. "$PSScriptRoot\common.ps1"
$PgBin = Find-Postgres
$DataDir = Join-Path $LocalDir 'postgres'
$Control = Join-Path $PgBin 'pg_ctl.exe'
if ($Action -eq 'stop') {
    if (Test-Path $DataDir) {
        & $Control -D $DataDir status *> $null
        if ($LASTEXITCODE -eq 0) { & $Control -D $DataDir -m fast -w stop; Assert-Exit 'Stop database' }
    }
    return
}
if (-not $env:POSTGRES_PASSWORD) { throw 'Run scripts/setup.ps1 first.' }
if (-not (Test-Path (Join-Path $DataDir 'PG_VERSION'))) {
    $PasswordFile = Join-Path $LocalDir 'pg-init-password.tmp'
    try {
        [IO.File]::WriteAllText($PasswordFile, $env:POSTGRES_PASSWORD)
        & (Join-Path $PgBin 'initdb.exe') -D $DataDir -U $env:POSTGRES_USER -A scram-sha-256 "--pwfile=$PasswordFile" --encoding=UTF8 --locale=C
        Assert-Exit 'Initialize database'
        Add-Content (Join-Path $DataDir 'postgresql.conf') "`nlisten_addresses = '127.0.0.1'`nport = $($env:POSTGRES_PORT)"
    } finally { Remove-Item -LiteralPath $PasswordFile -ErrorAction SilentlyContinue }
}
& $Control -D $DataDir status *> $null
if ($LASTEXITCODE -ne 0) {
    $log = Join-Path $LocalDir 'postgres.log'
    $process = Start-Process -FilePath $Control -ArgumentList @('-D', "`"$DataDir`"", '-l', "`"$log`"", '-w', 'start') -WindowStyle Hidden -PassThru
    $process.WaitForExit()
    if ($process.ExitCode -ne 0) { throw "Database failed to start. See $log" }
}
Write-Output "Project PostgreSQL is ready on 127.0.0.1:$($env:POSTGRES_PORT)."
