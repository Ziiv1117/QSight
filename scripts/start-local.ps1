$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$apiProcess = $null
Push-Location $projectRoot
try {
    foreach ($command in @('node', 'npm.cmd', 'python')) {
        if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
            throw "Missing $command. Install Node.js 24 and Python 3.12, then reopen your terminal."
        }
    }
    & node -e "if (Number(process.versions.node.split('.')[0]) !== 24) process.exit(1)"
    if ($LASTEXITCODE -ne 0) { throw 'Node.js 24 is required.' }
    & python -c "import sys; sys.exit(0 if sys.version_info[:2] == (3, 12) else 1)"
    if ($LASTEXITCODE -ne 0) { throw 'Python 3.12 is required.' }
    foreach ($port in @(8000, 4173)) {
        $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
        try { $listener.Start() } finally { $listener.Stop() }
    }
    $pythonPath = Join-Path $projectRoot 'backend\.venv\Scripts\python.exe'
    if (-not (Test-Path $pythonPath)) {
        & python -m venv backend/.venv
        if ($LASTEXITCODE -ne 0) { throw 'Virtual environment creation failed.' }
    }
    & $pythonPath -c "import sys; sys.exit(0 if sys.version_info[:2] == (3, 12) else 1)"
    if ($LASTEXITCODE -ne 0) { throw 'Existing backend/.venv must use Python 3.12. See README.md.' }
    & $pythonPath -m pip install --disable-pip-version-check -r backend/requirements.txt
    if ($LASTEXITCODE -ne 0) { throw 'Backend dependency installation failed.' }
    & npm.cmd --prefix frontend ci
    if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed.' }
    & npm.cmd --prefix frontend run build
    if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }

    New-Item -ItemType Directory -Force backend/runtime | Out-Null
    $apiArgs = @('-m', 'uvicorn', 'app.main:app', '--app-dir', 'backend', '--host', '127.0.0.1', '--port', '8000')
    if (Test-Path backend/.env) { $apiArgs += @('--env-file', 'backend/.env') }
    $apiProcess = Start-Process -FilePath $pythonPath -ArgumentList $apiArgs -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput backend/runtime/api.stdout.log -RedirectStandardError backend/runtime/api.stderr.log
    $ready = $false
    for ($i = 0; $i -lt 40; $i++) {
        if ($apiProcess.HasExited) { throw 'API exited. See backend/runtime/api.stderr.log.' }
        try {
            $health = Invoke-RestMethod http://127.0.0.1:8000/api/v1/health -TimeoutSec 1
            if ($health.data.service -eq 'qsight-backend' -and $health.data.database -eq 'ready') { $ready = $true; break }
        } catch { }
        Start-Sleep -Milliseconds 500
    }
    if (-not $ready) { throw 'API readiness timed out. See backend/runtime/api.stderr.log.' }
    Write-Host '[QSight] http://127.0.0.1:4173 - Press Ctrl+C to stop.'
    & npm.cmd --prefix frontend run preview -- --strictPort --open
    if ($LASTEXITCODE -ne 0) { throw 'Frontend preview stopped with an error.' }
} catch {
    Write-Host "[QSight] $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    if ($null -ne $apiProcess -and -not $apiProcess.HasExited) {
        Stop-Process -Id $apiProcess.Id -ErrorAction SilentlyContinue
    }
    Pop-Location
}
