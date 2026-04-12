param(
  [string]$SourcePath = ""
)

$ErrorActionPreference = "Stop"

$targetRoot = Split-Path -Parent $PSScriptRoot

if (-not $SourcePath) {
  throw "Indica -SourcePath apuntando a la carpeta AppStockLocal del pendrive."
}

if (-not (Test-Path $SourcePath)) {
  throw "La ruta indicada no existe: $SourcePath"
}

$resolvedSource = (Resolve-Path $SourcePath).Path
$resolvedTarget = (Resolve-Path $targetRoot).Path

if ($resolvedSource -eq $resolvedTarget) {
  throw "La carpeta de origen y destino son la misma. Usa la carpeta AppStockLocal del pendrive."
}

$sourceExe = Join-Path $resolvedSource "AppStockLocal.exe"
if (-not (Test-Path $sourceExe)) {
  throw "No se encontro AppStockLocal.exe en el origen. Apunta a la carpeta AppStockLocal del pendrive."
}

if (Get-Process AppStockLocal -ErrorAction SilentlyContinue) {
  throw "AppStockLocal.exe sigue abierto. Cerra la app antes de actualizar."
}

$backupRoot = Join-Path $resolvedTarget "_backup_update"
if (Test-Path $backupRoot) {
  Remove-Item -LiteralPath $backupRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null

foreach ($dirName in @("data", "logs")) {
  $dirPath = Join-Path $resolvedTarget $dirName
  if (Test-Path $dirPath) {
    Copy-Item -LiteralPath $dirPath -Destination (Join-Path $backupRoot $dirName) -Recurse -Force
  }
}

$robocopyArgs = @(
  $resolvedSource,
  $resolvedTarget,
  "/E",
  "/R:1",
  "/W:1",
  "/XD",
  "data",
  "logs",
  "_backup_update"
)

& robocopy @robocopyArgs | Out-Null
$robocopyCode = $LASTEXITCODE
if ($robocopyCode -ge 8) {
  throw "La copia de actualizacion fallo. Codigo robocopy: $robocopyCode"
}

foreach ($dirName in @("data", "logs")) {
  $backupDir = Join-Path $backupRoot $dirName
  $targetDir = Join-Path $resolvedTarget $dirName
  if (Test-Path $backupDir) {
    if (-not (Test-Path $targetDir)) {
      Move-Item -LiteralPath $backupDir -Destination $targetDir
    }
  }
}

Write-Host "Actualizacion local completada. Se preservaron data y logs." -ForegroundColor Green
