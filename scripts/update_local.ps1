param(
  [string]$SourcePath = "",
  [switch]$UseGit
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

if ($UseGit) {
  Push-Location $root
  try {
    git fetch origin main
    git pull origin main
  } finally {
    Pop-Location
  }
  Write-Host "Actualizacion desde repositorio completada." -ForegroundColor Green
  exit 0
}

if (-not $SourcePath) {
  throw "Indica -SourcePath con la carpeta del pendrive o usa -UseGit."
}

if (-not (Test-Path $SourcePath)) {
  throw "La ruta indicada no existe: $SourcePath"
}

$codeDirs = @("backend\app", "frontend\src", "frontend\public")
$codeFiles = @(
  "backend\pyproject.toml",
  "backend\uv.lock",
  "frontend\package.json",
  "frontend\package-lock.json",
  "frontend\vite.config.js",
  "frontend\tailwind.config.js",
  "frontend\postcss.config.js",
  "README.md"
)

foreach ($dir in $codeDirs) {
  $sourceDir = Join-Path $SourcePath $dir
  $targetDir = Join-Path $root $dir
  if (Test-Path $sourceDir) {
    robocopy $sourceDir $targetDir /E /R:1 /W:1 | Out-Null
  }
}

foreach ($file in $codeFiles) {
  $sourceFile = Join-Path $SourcePath $file
  $targetFile = Join-Path $root $file
  if (Test-Path $sourceFile) {
    Copy-Item $sourceFile $targetFile -Force
  }
}

Write-Host "Actualizacion desde carpeta local completada. Ejecuta luego scripts\build_local.ps1." -ForegroundColor Green
