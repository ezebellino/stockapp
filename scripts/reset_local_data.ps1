$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$databasePath = Join-Path $root "backend\data\appstock.db"

if (Test-Path $databasePath) {
  Remove-Item $databasePath -Force
}

Write-Host "Base local reiniciada. Al volver a abrir la app, arrancara sin datos de demo." -ForegroundColor Green
Write-Host "Las claves de localStorage tambien quedaron invalidadas por version, asi que volvera a mostrarse Primer acceso." -ForegroundColor Green
