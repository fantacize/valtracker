@echo off
setlocal
cd /d "%~dp0"

if not exist "release\ValorantTrackerBackend.exe" (
  echo Missing release\ValorantTrackerBackend.exe
  echo Run build-exe.bat first.
  pause
  exit /b 1
)

start "Valorant Tracker EXE" "release\ValorantTrackerBackend.exe"
timeout /t 2 >nul
start "" http://localhost:3000

exit /b 0
