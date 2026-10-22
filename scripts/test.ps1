. "$PSScriptRoot\common.ps1"
& '.\.venv\Scripts\python.exe' apps/api/manage.py test crm
Assert-Exit 'Backend tests'
npm.cmd run typecheck
Assert-Exit 'TypeScript'
& "$PSScriptRoot\start.ps1"
& '.\.venv\Scripts\python.exe' scripts/e2e_data.py
Assert-Exit 'Prepare isolated browser test tenant'
try {
    npm.cmd run test:e2e
    Assert-Exit 'Browser tests'
} finally {
    & '.\.venv\Scripts\python.exe' scripts/e2e_data.py cleanup
}
