@echo off
chcp 65001 >nul
setlocal
set "HERE=%~dp0"
if not exist "%HERE%app\SpinePet.exe" (
  echo Missing native SpinePet executable. Extract the ENTIRE downloaded ZIP first.
  pause
  exit /b 1
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%HERE%Register-Bridge.ps1"
if errorlevel 1 (
  echo Failed to register website protocol. Read README.md for help.
  pause
  exit /b 1
)
start "" "%HERE%app\SpinePet.exe"
echo Native SpinePet started. You can import a verified Spine 4.1 role from the website.
pause
