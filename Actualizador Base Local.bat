@echo off
setlocal
echo Actualizador Base Local
echo ======================
echo.
echo Cierra AppStock antes de continuar.
echo.
set /p source=Ruta de la carpeta AppStockLocal del pendrive: 

if "%source%"=="" (
  echo No se indico ninguna ruta.
  pause
  exit /b 1
)

powershell -ExecutionPolicy Bypass -File "%~dp0scripts\update_portable_release.ps1" -SourcePath "%source%"
pause
