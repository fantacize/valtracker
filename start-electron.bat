@echo off
setlocal EnableExtensions
cd /d "%~dp0"

if not exist "node_modules\electron" (
  echo Missing Electron dependencies.
  echo Run npm install first.
  pause
  exit /b 1
)

if not exist "release\ValorantTrackerBackend.exe" (
  echo Missing release\ValorantTrackerBackend.exe
  echo Run build-exe.bat or npm run electron:build:backend first.
  pause
  exit /b 1
)

cmd /c npm run electron:start
exit /b %errorlevel%
