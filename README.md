# Valorant Tracker

Real-time Valorant tracker with skins, player stats, pregame, queue controls, and live match data.

## Stack
- Backend: Node.js + Express (`backend`)
- Frontend: React + Vite (`frontend`)
- Desktop: Electron wrapper (`electron`)

## Data Sources
- Local VALORANT client API (lockfile + local endpoints)
- Henrik API
- Tracker.gg API
- valorant-api.com

## Run (Dev)
1. Backend
```bat
cd backend
npm install
npm run dev
```
2. Frontend
```bat
cd frontend
npm install
npm run dev
```
3. Open `http://localhost:5173`

## Run (Packaged Backend)
```bat
build-exe.bat
start-exe.bat
```

## Run (Electron)
```bat
npm install
start-electron.bat
```

## Env (`backend/.env`)
```env
PORT=3000
HENRIKAPIKEY=your_key
TRACKERAPIKEY=your_key
```

## Notes
- VALORANT and Riot Client must be running and logged in.
- Backend uses yoinker-style runtime presence state tracking for menu/pregame/ingame transitions.
- `start-exe.bat` now reuses an already running backend instance to avoid port conflicts.
