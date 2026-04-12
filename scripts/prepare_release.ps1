$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$distDir = Join-Path $root "backend\dist\AppStockLocal"
$releaseRoot = Join-Path $root "release"
$releaseDir = Join-Path $releaseRoot "AppStockLocal"
$portableUpdaterScript = Join-Path $root "scripts\update_portable_release.ps1"
$portableUpdaterBat = Join-Path $root "Actualizador Base Local.bat"

if (-not (Test-Path $distDir)) {
  throw "No existe backend\dist\AppStockLocal. Ejecuta primero scripts\build_pyinstaller.ps1."
}

if (Test-Path $releaseDir) {
  Remove-Item -LiteralPath $releaseDir -Recurse -Force
}

New-Item -ItemType Directory -Path $releaseRoot -Force | Out-Null
Copy-Item -LiteralPath $distDir -Destination $releaseDir -Recurse

if (Test-Path $portableUpdaterScript) {
  New-Item -ItemType Directory -Path (Join-Path $releaseDir "scripts") -Force | Out-Null
  Copy-Item -LiteralPath $portableUpdaterScript -Destination (Join-Path $releaseDir "scripts\update_portable_release.ps1") -Force
}

if (Test-Path $portableUpdaterBat) {
  Copy-Item -LiteralPath $portableUpdaterBat -Destination (Join-Path $releaseDir "Actualizador Base Local.bat") -Force
}

$readmeContent = @"
AppStock Local
================

Como ejecutar
-------------
1. Copia esta carpeta completa al disco local de la PC del negocio.
2. Abri AppStockLocal.exe con doble click.
3. Espera unos segundos. La app se abre en el navegador.

Como actualizar sin perder datos
--------------------------------
1. Cierra AppStockLocal.exe.
2. Ejecuta Actualizador Base Local.bat.
3. Indica la ruta de la carpeta AppStockLocal nueva del pendrive.
4. El actualizador reemplaza el programa, pero preserva data y logs.

Notas
-----
- No hace falta VS Code.
- No hace falta ejecutar npm.
- Los datos se guardan en la carpeta data.
- Los logs se guardan en la carpeta logs.
- La base se migra al arrancar, sin borrar los datos existentes.
"@

Set-Content -LiteralPath (Join-Path $releaseDir "LEEME.txt") -Value $readmeContent -Encoding UTF8

Write-Host "Release lista en release\AppStockLocal" -ForegroundColor Green
