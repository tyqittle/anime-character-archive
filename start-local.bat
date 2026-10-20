@echo off
setlocal
set "SITE_DIR=%~dp0"
set "PORT=8766"
if not exist "%SITE_DIR%gallery.html" (
  echo [ERROR] gallery.html not found beside start-local.bat
  echo You may have downloaded an older ZIP or moved this .bat file.
  echo Please download the latest main branch ZIP and extract all files.
  pause
  exit /b 1
)
if not exist "%SITE_DIR%spine.html" (
  echo [ERROR] spine.html missing. Extract the entire ZIP first.
  pause
  exit /b 1
)
set "PYTHON_CMD="
where py >nul 2>nul
if not errorlevel 1 set "PYTHON_CMD=py -3"
if not defined PYTHON_CMD (
  where python >nul 2>nul
  if not errorlevel 1 set "PYTHON_CMD=python"
)
if not defined PYTHON_CMD (
  echo Python 3 is required to start the local site.
  echo Download: https://www.python.org/downloads/
  pause
  exit /b 1
)
echo Starting Winter Gallery from: "%SITE_DIR%"
echo.
echo Gallery: http://127.0.0.1:%PORT%/gallery.html
echo Spine:   http://127.0.0.1:%PORT%/spine.html
echo.
start "Winter Gallery Server" cmd /k %PYTHON_CMD% -m http.server %PORT% --bind 127.0.0.1 --directory "%SITE_DIR%"
timeout /t 3 /nobreak >nul
start "" "http://127.0.0.1:%PORT%/gallery.html"
echo Keep the server window open while using the site.
pause
