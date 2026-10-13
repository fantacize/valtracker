# Valorant Tracker Desktop

A local-first Windows desktop companion for VALORANT lobby, pregame, queue, loadout, rank, and live-match intelligence.

## Run

Open `release/ValorantTracker.exe`. The app starts and manages its private local service automatically—there are no BAT launchers or separate backend windows.

VALORANT and Riot Client must be running and signed in for live data.

## Build

Requirements:

- Node.js
- .NET 8 SDK or newer
- Microsoft Edge WebView2 Runtime

From the project root:

```powershell
npm run build
```

The build produces one distributable file:

```text
release/ValorantTracker.exe
```

## Development

Run the services separately only while developing:

```powershell
npm run dev:backend
npm run dev:frontend
```

The desktop release embeds the production frontend inside the packaged backend, then embeds that backend inside the self-contained WPF application.

## Data sources

- Local VALORANT client API
- Henrik API
- Tracker.gg API
- valorant-api.com
