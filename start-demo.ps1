$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

try {
    $existingDemo = Invoke-WebRequest -Uri 'http://127.0.0.1:5173/' -TimeoutSec 2 -UseBasicParsing
    if ($existingDemo.Content -match '<title>Luma') {
        Write-Host 'Luma is already running: http://127.0.0.1:5173/' -ForegroundColor Green
        return
    }
} catch {
    # No existing local server: start the project below.
}

# Prefer a standard Node installation; the Codex desktop runtime is a local fallback.
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCommand) {
    $demoNode = $nodeCommand.Source
} else {
    $demoNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
}

if (-not (Test-Path -LiteralPath $demoNode)) {
    throw 'Node.js is required. Install Node.js, reopen your terminal, and try again.'
}

$viteEntry = Join-Path $PSScriptRoot 'node_modules\vite\bin\vite.js'
if (-not (Test-Path -LiteralPath $viteEntry)) {
    throw 'Dependencies are missing. Run pnpm install (or npm install), then try again.'
}

Write-Host 'Luma is starting at http://127.0.0.1:5173/' -ForegroundColor Green
Write-Host 'Keep this terminal open. Press Ctrl+C to stop.'
& $demoNode $viteEntry --host 127.0.0.1 --open
