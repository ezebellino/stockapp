$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$backendRoot = Join-Path $root "backend"
$frontendDist = Join-Path $root "frontend\dist\index.html"
$pythonExe = Join-Path $root "backend\.venv\Scripts\python.exe"
$tempDistRoot = Join-Path $backendRoot "dist_pyinstaller"
$tempWorkRoot = Join-Path $backendRoot "build_pyinstaller"
$finalDistRoot = Join-Path $backendRoot "dist"
$finalAppDir = Join-Path $finalDistRoot "AppStockLocal"
$tempAppDir = Join-Path $tempDistRoot "AppStockLocal"

if (Get-Process AppStockLocal -ErrorAction SilentlyContinue) {
  throw "AppStockLocal.exe esta en ejecucion. Cerra la app antes de reconstruir el paquete."
}

if (-not (Test-Path $pythonExe)) {
  throw "No se encontro backend\.venv\Scripts\python.exe"
}

if (-not (Test-Path $frontendDist)) {
  Write-Host "No existe frontend\dist. Compilando frontend..." -ForegroundColor Yellow
  Push-Location (Join-Path $root "frontend")
  try {
    npm.cmd run build
  } finally {
    Pop-Location
  }
}

foreach ($path in @($tempDistRoot, $tempWorkRoot)) {
  if (Test-Path $path) {
    Remove-Item -LiteralPath $path -Recurse -Force
  }
}

Push-Location $backendRoot
try {
  & $pythonExe -m PyInstaller `
    --noconfirm `
    --clean `
    --name AppStockLocal `
    --onedir `
    --windowed `
    --distpath $tempDistRoot `
    --workpath $tempWorkRoot `
    --specpath $backendRoot `
    --add-data "$root\frontend\dist;frontend\dist" `
    --add-data "$root\backend\app;app" `
    run_local.py
} finally {
  Pop-Location
}

if (-not (Test-Path $tempAppDir)) {
  throw "PyInstaller finalizo sin generar $tempAppDir"
}

if (-not (Test-Path $finalDistRoot)) {
  New-Item -ItemType Directory -Path $finalDistRoot -Force | Out-Null
}

if (Test-Path $finalAppDir) {
  try {
    Remove-Item -LiteralPath $finalAppDir -Recurse -Force
  } catch {
    throw "No se pudo reemplazar backend\dist\AppStockLocal porque hay archivos en uso. Cerra AppStockLocal.exe y volve a ejecutar este script."
  }
}

Move-Item -LiteralPath $tempAppDir -Destination $finalAppDir

if (Test-Path $tempDistRoot) {
  Remove-Item -LiteralPath $tempDistRoot -Recurse -Force
}

Write-Host "Build PyInstaller completado en backend\dist\AppStockLocal" -ForegroundColor Green
