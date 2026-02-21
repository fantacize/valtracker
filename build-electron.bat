@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo ======================================
echo Build VALORANT Tracker Desktop App
echo ======================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed or not in PATH.
  pause
  exit /b 1
)

echo Installing desktop wrapper dependencies...
cmd /c npm install
if errorlevel 1 (
  echo Root npm install failed.
  pause
  exit /b 1
)

echo Building desktop installer...
cmd /c npm run electron:dist
if errorlevel 1 (
  echo Electron build failed.
  pause
  exit /b 1
)

echo.
echo Build complete.
echo Output folder:
echo   electron-dist\
echo.
pause
exit /b 0
