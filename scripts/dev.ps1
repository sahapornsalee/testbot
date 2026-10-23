<#
.SYNOPSIS
  Installs dependencies (with -Install) and starts the API and the web UI for Local Mode.
.DESCRIPTION
  The API runs in the background with logs in data\logs\api.log; the web UI runs in this
  window. Press Ctrl+C to stop both.
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1 -Install
#>
param(
    [switch]$Install,
    [int]$ApiPort = 0,
    [int]$WebPort = 0
)
. (Join-Path $PSScriptRoot '_common.ps1')

$envFile = Join-Path $RepoRoot '.env'
if (-not (Test-Path $envFile)) {
    Copy-Item (Join-Path $RepoRoot '.env.example') $envFile
    Write-Ok 'Created .env from .env.example'
}
$settings = Read-DotEnv
if ($ApiPort -eq 0) { $ApiPort = if ($settings['API_PORT']) { [int]$settings['API_PORT'] } else { 8000 } }
if ($WebPort -eq 0) { $WebPort = if ($settings['WEB_PORT']) { [int]$settings['WEB_PORT'] } else { 3000 } }
$apiHost = if ($settings['APP_HOST']) { $settings['APP_HOST'] } else { '127.0.0.1' }

if ($Install -or -not (Test-Path $VenvPython)) {
    Write-Step 'Creating Python virtual environment'
    $python = Get-PythonCommand
    if (-not $python) { throw 'Python 3.11+ is required. Install it with: winget install -e --id Python.Python.3.12' }
    if (-not (Test-Path $VenvPython)) {
        Invoke-Checked -FilePath $python.Path -Arguments ($python.Args + @('-m', 'venv', '.venv')) -WorkingDirectory $ApiDir -Description 'python -m venv'
    }
    Invoke-Checked -FilePath $VenvPython -Arguments @('-m', 'pip', 'install', '--upgrade', 'pip') -WorkingDirectory $ApiDir -Description 'pip upgrade'
    Invoke-Checked -FilePath $VenvPython -Arguments @('-m', 'pip', 'install', '-e', '.[dev]') -WorkingDirectory $ApiDir -Description 'pip install'
}
if ($Install -or -not (Test-Path (Join-Path $WebDir 'node_modules'))) {
    Write-Step 'Installing Node dependencies'
    # npm.cmd avoids the PowerShell execution policy prompt for npm.ps1.
    Invoke-Checked -FilePath 'npm.cmd' -Arguments @('ci', '--no-audit', '--no-fund') -WorkingDirectory $WebDir -Description 'npm ci'
}

foreach ($port in @($ApiPort, $WebPort)) {
    if (-not (Test-PortFree $port)) {
        throw "Port $port is already in use. Stop the other program or run: .\scripts\dev.ps1 -ApiPort 8001 -WebPort 3001"
    }
}

$logDir = Join-Path $RepoRoot 'data\logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$apiLog = Join-Path $logDir 'api.log'
$apiErr = Join-Path $logDir 'api.err.log'

Write-Step "Starting API on http://${apiHost}:$ApiPort (logs: data\logs\api.log)"
$env:API_PORT = "$ApiPort"
$api = Start-Process -FilePath $VenvPython -WorkingDirectory $ApiDir -PassThru -WindowStyle Hidden `
    -RedirectStandardOutput $apiLog -RedirectStandardError $apiErr `
    -ArgumentList @('-m', 'uvicorn', 'app.main:create_app', '--factory', '--host', $apiHost, '--port', "$ApiPort")

try {
    $healthy = $false
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Milliseconds 500
        if ($api.HasExited) { break }
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$ApiPort/api/v1/health" -TimeoutSec 2
            if ($response.StatusCode -eq 200) { $healthy = $true; break }
        }
        catch { }
    }
    if (-not $healthy) {
        Write-Warn 'The API did not become healthy. Last log lines:'
        if (Test-Path $apiErr) { Get-Content $apiErr -Tail 20 }
        throw 'API failed to start'
    }
    Write-Ok 'API is healthy'

    Write-Step "Starting web UI on http://localhost:$WebPort (Ctrl+C to stop)"
    $env:API_INTERNAL_URL = "http://127.0.0.1:$ApiPort"
    Push-Location $WebDir
    try {
        & npm.cmd run dev -- -p $WebPort
    }
    finally {
        Pop-Location
    }
}
finally {
    if ($api -and -not $api.HasExited) {
        Write-Step 'Stopping API'
        Stop-Process -Id $api.Id -Force
    }
}
