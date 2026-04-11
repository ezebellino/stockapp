@echo off
echo 1. Actualizar desde repositorio
echo 2. Actualizar desde carpeta o pendrive
set /p option=Elegí una opción (1 o 2): 

if "%option%"=="1" (
  powershell -ExecutionPolicy Bypass -File "%~dp0scripts\update_local.ps1" -UseGit
  goto :end
)

if "%option%"=="2" (
  set /p source=Ruta de la carpeta del pendrive o copia local: 
  powershell -ExecutionPolicy Bypass -File "%~dp0scripts\update_local.ps1" -SourcePath "%source%"
  goto :end
)

echo Opción inválida.

:end
pause
