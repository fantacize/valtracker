@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo ======================================
echo Build VALORANT Tracker EXE
echo ======================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed or not in PATH.
  pause
  exit /b 1
)

echo Installing backend deps...
cmd /c npm --prefix backend install
if errorlevel 1 (
  echo Backend npm install failed.
  pause
  exit /b 1
)

echo Installing frontend deps...
cmd /c npm --prefix frontend install
if errorlevel 1 (
  echo Frontend npm install failed.
  pause
  exit /b 1
)

echo Building EXE...
cmd /c npm --prefix backend run build:exe
if errorlevel 1 (
  echo EXE build failed.
  pause
  exit /b 1
)

echo.
echo Build complete.
echo Output:
echo   release\ValorantTrackerBackend.exe
echo   release\frontend-dist\...
echo.
pause
exit /b 0
