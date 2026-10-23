<#
.SYNOPSIS
  Checks prerequisites, versions, configuration and ports for Universal Downloader.
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\scripts\check.ps1
#>
. (Join-Path $PSScriptRoot '_common.ps1')

$problems = 0

Write-Step 'Tools'
$python = Get-PythonCommand
if ($python) { Write-Ok "Python $($python.Version) ($($python.Path))" }
else { Write-Warn 'Python 3.11+ not found. Install: winget install -e --id Python.Python.3.12'; $problems++ }

$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
    $nodeVersion = (& node --version).TrimStart('v')
    if ([version]$nodeVersion -ge [version]'20.9') { Write-Ok "Node.js $nodeVersion" }
    else { Write-Warn "Node.js $nodeVersion is too old (need 20.9+). winget install -e --id OpenJS.NodeJS.LTS"; $problems++ }
}
else { Write-Warn 'Node.js not found. Install: winget install -e --id OpenJS.NodeJS.LTS'; $problems++ }

$git = Get-Command git -ErrorAction SilentlyContinue
if ($git) { Write-Ok ((& git --version) -join ' ') } else { Write-Warn 'Git not found (optional). winget install -e --id Git.Git' }

$settings = Read-DotEnv
$ffmpegPath = $null
if ($settings.ContainsKey('FFMPEG_LOCATION') -and $settings['FFMPEG_LOCATION']) {
    $configured = $settings['FFMPEG_LOCATION']
    if (Test-Path $configured -PathType Container) { $configured = Join-Path $configured 'ffmpeg.exe' }
    if (Test-Path $configured) { $ffmpegPath = $configured }
}
if (-not $ffmpegPath) {
    $cmd = Get-Command ffmpeg -ErrorAction SilentlyContinue
    if ($cmd) { $ffmpegPath = $cmd.Source }
}
if ($ffmpegPath) { Write-Ok ("FFmpeg: " + ((& $ffmpegPath -version | Select-Object -First 1))) }
else { Write-Warn 'FFmpeg not found: media merging is disabled. winget install -e --id Gyan.FFmpeg (then open a new terminal), or set FFMPEG_LOCATION in .env' }

Write-Step 'Project setup'
if (Test-Path $VenvPython) {
    Write-Ok 'Python virtual environment exists (services\api\.venv)'
    $ytdlp = & $VenvPython -c 'import yt_dlp.version as v; print(v.__version__)' 2>$null
    if ($LASTEXITCODE -eq 0) { Write-Ok "yt-dlp $ytdlp" } else { Write-Warn 'yt-dlp not installed in the venv. Run scripts\dev.ps1 -Install'; $problems++ }
}
else { Write-Warn 'Virtual environment missing. Run: .\scripts\dev.ps1 -Install'; $problems++ }

if (Test-Path (Join-Path $WebDir 'node_modules')) { Write-Ok 'Node dependencies installed (apps\web\node_modules)' }
else { Write-Warn 'Node dependencies missing. Run: .\scripts\dev.ps1 -Install'; $problems++ }

if (Test-Path (Join-Path $RepoRoot '.env')) { Write-Ok '.env exists' }
else { Write-Warn '.env missing. It will be created from .env.example by scripts\dev.ps1' }

if ($settings['AUTH_REQUIRED'] -eq 'true' -and -not $settings['API_TOKENS']) {
    Write-Warn 'AUTH_REQUIRED=true but API_TOKENS is empty: the API will refuse to start.'; $problems++
}
if ($settings['APP_HOST'] -and $settings['APP_HOST'] -ne '127.0.0.1') {
    Write-Warn "APP_HOST=$($settings['APP_HOST']) exposes the API beyond this computer. Use AUTH_REQUIRED=true."
}

Write-Step 'Ports'
$apiPort = if ($settings['API_PORT']) { [int]$settings['API_PORT'] } else { 8000 }
$webPort = if ($settings['WEB_PORT']) { [int]$settings['WEB_PORT'] } else { 3000 }
foreach ($port in @($apiPort, $webPort)) {
    if (Test-PortFree $port) { Write-Ok "Port $port is free" }
    else {
        $owner = (Get-NetTCPConnection -State Listen -LocalPort $port | Select-Object -First 1).OwningProcess
        Write-Warn "Port $port is in use by process id $owner (see: Get-Process -Id $owner)"
    }
}

if ($problems -gt 0) {
    Write-Host "`n$problems problem(s) found." -ForegroundColor Red
    exit 1
}
Write-Host "`nAll required checks passed." -ForegroundColor Green
exit 0
