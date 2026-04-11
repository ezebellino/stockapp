@echo off
if exist "%~dp0backend\dist\AppStockLocal\AppStockLocal.exe" (
  start "" "%~dp0backend\dist\AppStockLocal\AppStockLocal.exe"
) else (
  powershell -ExecutionPolicy Bypass -File "%~dp0scripts\start_local.ps1"
)
