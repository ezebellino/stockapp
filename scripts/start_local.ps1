$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$frontendDist = Join-Path $root "frontend\dist\index.html"
$pythonExe = Join-Path $root "backend\.venv\Scripts\python.exe"

if (-not (Test-Path $pythonExe)) {
  throw "No se encontro el entorno del backend en backend\.venv. Ejecuta primero la instalacion local."
}

if (-not (Test-Path $frontendDist)) {
  throw "No se encontro frontend\dist. Ejecuta primero el build local del frontend."
}

$existing = Get-NetTCPConnection -State Listen -LocalPort 8001 -ErrorAction SilentlyContinue
if ($existing) {
  Start-Process "http://127.0.0.1:8001"
  exit 0
}

Start-Process -FilePath $pythonExe -ArgumentList "run_local.py" -WorkingDirectory (Join-Path $root "backend")
Start-Sleep -Seconds 2
Start-Process "http://127.0.0.1:8001"
