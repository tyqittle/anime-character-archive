@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if not errorlevel 1 (
  py -3 "%~dp0start_site.py"
  goto :end
)
where python >nul 2>nul
if not errorlevel 1 (
  python "%~dp0start_site.py"
  goto :end
)
echo Python 3 was not found. Install Python 3, then run this file again.
pause
:end
