$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$distDir = Join-Path $root "backend\dist\AppStockLocal"
$releaseRoot = Join-Path $root "release"
$releaseDir = Join-Path $releaseRoot "AppStockLocal"

if (-not (Test-Path $distDir)) {
  throw "No existe backend\dist\AppStockLocal. Ejecuta primero scripts\build_pyinstaller.ps1."
}

if (Test-Path $releaseDir) {
  Remove-Item -LiteralPath $releaseDir -Recurse -Force
}

New-Item -ItemType Directory -Path $releaseRoot -Force | Out-Null
Copy-Item -LiteralPath $distDir -Destination $releaseDir -Recurse

$readmeContent = @"
AppStock Local
================

Como ejecutar
-------------
1. Copia esta carpeta completa al disco local de la PC del negocio.
2. Abri AppStockLocal.exe con doble click.
3. Espera unos segundos. La app se abre en el navegador.

Notas
-----
- No hace falta VS Code.
- No hace falta ejecutar npm.
- Los datos se guardan en la carpeta data.
- Los logs se guardan en la carpeta logs.
"@

Set-Content -LiteralPath (Join-Path $releaseDir "LEEME.txt") -Value $readmeContent -Encoding UTF8

Write-Host "Release lista en release\AppStockLocal" -ForegroundColor Green
