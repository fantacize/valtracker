# VALORANT Skin Tracker

A real-time VALORANT tracker that shows what skins everyone in your match is using, plus stats from Tracker.gg and Henrik API.

# VALORANT Skin Tracker

A real-time VALORANT tracker that shows what skins everyone in your match is using, plus comprehensive stats from Tracker.gg and Henrik API.

## Features
- ✅ **Real-time skin tracking** - See everyone's weapon skins live in your current match
- ✅ **Comprehensive player stats** - Rank, RR, Level, K/D, HS%, Win Rate, Peak Rank
- ✅ **vtl.lol integration** - Direct links to player profiles
- ✅ **Match history** - View last 5 games with K/D/A and results
- ✅ **Hidden profile support** - Works with private profiles (shows match history)
- ✅ **Player stats from Tracker.gg** - Detailed statistics for all players
- ✅ **Hidden profile resolution via Henrik API** - Find player names even when hidden
- ✅ **Live match monitoring** - Real-time updates via websocket
- ✅ **Agent, rank, level, and loadout data** - Complete player information
- ✅ **Auto-refresh** - Updates every 3 seconds
- ✅ **Beautiful UI** - Team colors, smooth animations, professional design

## Tech Stack
- **Backend**: Node.js + Express
- **Frontend**: React + Vite
- **APIs**: 
  - Local VALORANT client API (via lockfile)
  - Henrik API (for hidden profiles)
  - Tracker.gg API (for stats)
  - Valorant-API.com (for skin/weapon data)

## Project Structure
```
valorant-tracker/
├── backend/
│   ├── src/
│   │   ├── services/
│   │   │   ├── lockfile.js      # Read VALORANT lockfile
│   │   │   ├── valorant.js      # Local VALORANT client API
│   │   │   ├── henrik.js        # Henrik API integration
│   │   │   ├── tracker.js       # Tracker.gg API
│   │   │   └── cache.js         # Simple caching layer
│   │   ├── routes/
│   │   │   ├── match.js         # Match endpoints
│   │   │   └── player.js        # Player lookup endpoints
│   │   └── server.js            # Express server
│   ├── package.json
│   └── .env                     # API keys
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── MatchOverview.jsx
│   │   │   ├── PlayerCard.jsx
│   │   │   └── SkinDisplay.jsx
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## Setup Instructions

### 1. Backend Setup
```bash
cd backend
npm install
```

Create `.env` file:
```env
PORT=3000
HENRIK_API_KEY=your_key_here
TRACKER_API_KEY=your_key_here
```

### 2. Frontend Setup
```bash
cd frontend
npm install
```

### 3. Run the App
Terminal 1 (Backend):
```bash
cd backend
npm run dev
```

Terminal 2 (Frontend):
```bash
cd frontend
npm run dev
```

Open `http://localhost:5173`

## How It Works

1. **Lockfile Reading**: Backend reads `C:\Riot Games\VALORANT\live\lockfile` to get:
   - Port number
   - Password for local API auth
   - Process ID

2. **Local API Connection**: Uses credentials to connect to `https://127.0.0.1:{port}` with Basic Auth

3. **Match Monitoring**: Connects to websocket to detect when you're in a match

4. **Data Fetching**: 
   - Gets match ID from `/chat/v4/presences`
   - Fetches player list from `/core-game/v1/matches/{matchId}`
   - Fetches loadouts from `/core-game/v1/matches/{matchId}/loadouts`
   - Enriches with Henrik API (for hidden names) and Tracker.gg (for stats)

5. **Frontend Display**: React app polls backend and displays real-time data

## API Endpoints

### Backend Endpoints
- `GET /api/match/current` - Get current match data with skins
- `GET /api/player/:name/:tag` - Get player stats (uses Henrik + Tracker.gg)
- `GET /api/match/status` - Check if VALORANT is running

## Notes
- VALORANT must be running and you must be in a match
- Lockfile location is hardcoded but can be changed in `lockfile.js`
- Rate limits are handled with exponential backoff
- Cached responses reduce API calls
