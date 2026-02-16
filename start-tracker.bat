@echo off
setlocal EnableExtensions

set "ROOT=%~dp0"
for %%I in ("%ROOT%.") do set "ROOT=%%~fI"
set "BACKEND_DIR=%ROOT%\backend"
set "FRONTEND_DIR=%ROOT%\frontend"
set "RUNNER_DIR=%TEMP%\valorant-tracker-launcher"
set "BACKEND_RUNNER=%RUNNER_DIR%\run_backend.cmd"
set "FRONTEND_RUNNER=%RUNNER_DIR%\run_frontend.cmd"

echo ======================================
echo VALORANT Tracker Launcher
echo ======================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed or not in PATH.
  echo Install Node.js LTS from https://nodejs.org/ and run this again.
  pause
  exit /b 1
)

if not exist "%BACKEND_DIR%\package.json" (
  echo Could not find backend\package.json.
  pause
  exit /b 1
)

if not exist "%FRONTEND_DIR%\package.json" (
  echo Could not find frontend\package.json.
  pause
  exit /b 1
)

if not exist "%RUNNER_DIR%" mkdir "%RUNNER_DIR%"

(
  echo @echo off
  echo pushd "%BACKEND_DIR%" ^|^| ^(echo Failed to open backend directory: "%BACKEND_DIR%" ^& exit /b 1^)
  echo if not exist node_modules npm install
  echo npm run dev
) > "%BACKEND_RUNNER%"

(
  echo @echo off
  echo pushd "%FRONTEND_DIR%" ^|^| ^(echo Failed to open frontend directory: "%FRONTEND_DIR%" ^& exit /b 1^)
  echo if not exist node_modules npm install
  echo npm run dev -- --host 0.0.0.0 --port 5173
) > "%FRONTEND_RUNNER%"

echo Starting backend...
start "Valorant Tracker Backend" "%COMSPEC%" /k ""%BACKEND_RUNNER%""

echo Starting frontend...
start "Valorant Tracker Frontend" "%COMSPEC%" /k ""%FRONTEND_RUNNER%""

echo Waiting for frontend to start...
timeout /t 5 >nul
start "" http://localhost:5173

echo.
echo Tracker started. Keep both terminal windows open.
exit /b 0
