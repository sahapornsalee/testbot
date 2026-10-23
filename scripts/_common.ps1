# Shared helpers for the Universal Downloader PowerShell scripts (Windows 11, PowerShell 5.1+ or 7+).
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:RepoRoot = Split-Path -Parent $PSScriptRoot
$script:ApiDir = Join-Path $RepoRoot 'services\api'
$script:WebDir = Join-Path $RepoRoot 'apps\web'
$script:VenvPython = Join-Path $ApiDir '.venv\Scripts\python.exe'

function Write-Step([string]$Message) { Write-Host "==> $Message" -ForegroundColor Cyan }
function Write-Ok([string]$Message) { Write-Host "  OK  $Message" -ForegroundColor Green }
function Write-Warn([string]$Message) { Write-Host "  !!  $Message" -ForegroundColor Yellow }

function Invoke-Checked {
    # Runs a native command and stops with a clear message when it fails.
    param(
        [Parameter(Mandatory)] [string]$FilePath,
        [string[]]$Arguments = @(),
        [string]$WorkingDirectory = $RepoRoot,
        [string]$Description = $FilePath
    )
    Push-Location $WorkingDirectory
    try {
        & $FilePath @Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "$Description failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}

function Get-PythonCommand {
    foreach ($candidate in @('py', 'python')) {
        $cmd = Get-Command $candidate -ErrorAction SilentlyContinue
        if ($cmd) {
            $pyArgs = if ($candidate -eq 'py') { @('-3') } else { @() }
            # No double quotes in the code: Windows PowerShell 5.1 mangles them for native commands.
            $version = & $cmd.Source @pyArgs -c 'import sys; print(sys.version_info[0], sys.version_info[1], sep=chr(46))' 2>$null
            if ($LASTEXITCODE -eq 0 -and $version -and [version]$version -ge [version]'3.11') {
                return @{ Path = $cmd.Source; Args = $pyArgs; Version = $version }
            }
        }
    }
    return $null
}

function Read-DotEnv {
    # Minimal .env reader (KEY=VALUE lines). Values are not printed anywhere.
    $values = @{}
    $envFile = Join-Path $RepoRoot '.env'
    if (Test-Path $envFile) {
        foreach ($line in Get-Content $envFile) {
            if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') {
                $values[$Matches[1]] = $Matches[2].Trim('"').Trim("'")
            }
        }
    }
    return $values
}

function Test-PortFree([int]$Port) {
    $listener = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
    return -not $listener
}
