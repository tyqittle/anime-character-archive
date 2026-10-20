@echo off
setlocal
cd /d "%~dp0"
set "PORT=8765"
where py >nul 2>nul
if %errorlevel%==0 (
  start "Winter Site Server" cmd /k py -3 -m http.server %PORT% --bind 127.0.0.1
  timeout /t 2 /nobreak >nul
  start "" "http://127.0.0.1:%PORT%/gallery.html"
  echo Website: http://127.0.0.1:%PORT%/gallery.html
  goto :end
)
where python >nul 2>nul
if %errorlevel%==0 (
  start "Winter Site Server" cmd /k python -m http.server %PORT% --bind 127.0.0.1
  timeout /t 2 /nobreak >nul
  start "" "http://127.0.0.1:%PORT%/gallery.html"
  echo Website: http://127.0.0.1:%PORT%/gallery.html
  goto :end
)
where node >nul 2>nul
if %errorlevel%==0 (
  echo Python is needed to serve the full archive (install Python 3).
  echo Opening the standalone animation page instead.
  start "" "%~dp0spine.html"
  pause
  goto :end
)
echo Python 3 not found; opening the standalone animation page.
echo Install Python 3 for the full gallery (data JSON + CG files).
start "" "%~dp0spine.html"
pause
:end
