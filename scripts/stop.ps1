. "$PSScriptRoot\common.ps1"
foreach ($service in @('web','api')) {
    $record = Join-Path $LocalDir "$service.json"
    if (Test-Path $record) {
        $saved = Get-Content $record | ConvertFrom-Json
        $proc = Get-Process -Id $saved.Id -ErrorAction SilentlyContinue
        if ($proc -and [string]$proc.StartTime.ToUniversalTime().Ticks -eq $saved.StartTimeUtcTicks) {
            & taskkill.exe /PID $saved.Id /T /F | Out-Null
        }
        Remove-Item -LiteralPath $record
    }
}
& "$PSScriptRoot\database.ps1" stop
