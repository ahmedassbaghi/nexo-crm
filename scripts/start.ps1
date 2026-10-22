. "$PSScriptRoot\common.ps1"
& "$PSScriptRoot\database.ps1" start
foreach ($service in @('api','web')) {
    $port = if ($service -eq 'api') { 8100 } else { 3100 }
    if (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) {
        Write-Output "El puerto $port ya está en uso; no se inicia una segunda instancia."
        continue
    }
    if ($service -eq 'api') {
        $proc = Start-Process -FilePath "$RepoRoot\.venv\Scripts\python.exe" -ArgumentList @('apps/api/manage.py','runserver','127.0.0.1:8100','--noreload') -WorkingDirectory $RepoRoot -WindowStyle Hidden -RedirectStandardOutput "$LocalDir\api.log" -RedirectStandardError "$LocalDir\api.error.log" -PassThru
    } else {
        $proc = Start-Process -FilePath (Get-Command node.exe).Source -ArgumentList @('node_modules/next/dist/bin/next','dev','apps/web','--hostname','127.0.0.1','--port','3100') -WorkingDirectory $RepoRoot -WindowStyle Hidden -RedirectStandardOutput "$LocalDir\web.log" -RedirectStandardError "$LocalDir\web.error.log" -PassThru
    }
    @{Id=$proc.Id; StartTimeUtcTicks=[string]$proc.StartTime.ToUniversalTime().Ticks} | ConvertTo-Json | Set-Content "$LocalDir\$service.json"
}
Write-Output 'Nexo: http://127.0.0.1:3100. Credenciales: .local/ACCESO.md'
