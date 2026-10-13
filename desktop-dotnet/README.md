# .NET Desktop App (WPF + WebView2)

This replaces Electron with a Windows-native shell.

## What It Does
- Starts/reuses `release/ValorantTrackerBackend.exe`
- Waits for `http://127.0.0.1:3000/health`
- Loads the tracker UI in WebView2
- Provides buttons for refresh/restart/open browser/stop backend

## Prerequisite
Install **.NET SDK 8.0 (x64)**:
- https://dotnet.microsoft.com/en-us/download/dotnet/8.0

## Build
```bat
build-dotnet.bat
```

## Publish EXE
```bat
publish-dotnet.bat
```
Output:
- `release\desktop-dotnet\ValorantTracker.Desktop.exe`

## Project Path
- `desktop-dotnet\ValorantTracker.Desktop\ValorantTracker.Desktop.csproj`
