<#
.SYNOPSIS
  Runs linters and all automated tests. Add -E2E for browser tests, -SkipWeb or -SkipApi to narrow.
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\scripts\test.ps1
#>
param(
    [switch]$E2E,
    [switch]$SkipApi,
    [switch]$SkipWeb
)
. (Join-Path $PSScriptRoot '_common.ps1')

if (-not $SkipApi) {
    if (-not (Test-Path $VenvPython)) { throw 'Run .\scripts\dev.ps1 -Install first.' }
    Write-Step 'API: lint'
    Invoke-Checked -FilePath $VenvPython -Arguments @('-m', 'ruff', 'check', '.') -WorkingDirectory $ApiDir -Description 'ruff check'
    Invoke-Checked -FilePath $VenvPython -Arguments @('-m', 'ruff', 'format', '--check', '.') -WorkingDirectory $ApiDir -Description 'ruff format'
    foreach ($suite in @('unit', 'integration', 'security')) {
        Write-Step "API: $suite tests"
        Invoke-Checked -FilePath $VenvPython -Arguments @('-m', 'pytest', "tests/$suite", '-q') -WorkingDirectory $ApiDir -Description "pytest $suite"
    }
}

if (-not $SkipWeb) {
    Write-Step 'Web: lint, typecheck, unit tests, build'
    Invoke-Checked -FilePath 'npm.cmd' -Arguments @('run', 'lint') -WorkingDirectory $WebDir -Description 'npm run lint'
    Invoke-Checked -FilePath 'npm.cmd' -Arguments @('run', 'typecheck') -WorkingDirectory $WebDir -Description 'npm run typecheck'
    Invoke-Checked -FilePath 'npm.cmd' -Arguments @('test') -WorkingDirectory $WebDir -Description 'npm test'
    Invoke-Checked -FilePath 'npm.cmd' -Arguments @('run', 'build') -WorkingDirectory $WebDir -Description 'npm run build'
}

if ($E2E) {
    Write-Step 'E2E: Playwright (first run: npx.cmd playwright install chromium)'
    $env:PYTHON = $VenvPython
    Invoke-Checked -FilePath 'npm.cmd' -Arguments @('run', 'e2e') -WorkingDirectory $WebDir -Description 'npm run e2e'
}

Write-Host "`nAll selected checks passed." -ForegroundColor Green
