@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\daxora-release\Install-DaxoraUpdate.ps1" %*
if errorlevel 1 (
  echo.
  echo UPDATE FAILED
  pause
  exit /b 1
)
echo.
echo DAXORA UPDATE COMPLETE
pause
