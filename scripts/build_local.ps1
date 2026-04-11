$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot

Push-Location (Join-Path $root "frontend")
try {
  npm.cmd install
  npm.cmd run build
} finally {
  Pop-Location
}

Push-Location (Join-Path $root "backend")
try {
  & ".\.venv\Scripts\python.exe" -m compileall app
} finally {
  Pop-Location
}

Write-Host "Build local completo. La app ya puede servirse desde FastAPI." -ForegroundColor Green
