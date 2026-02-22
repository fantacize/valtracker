valorant skin tracker

a real-time valorant tracker that shows what skins everyone in your match is using, plus stats from tracker.gg and henrik api.

valorant skin tracker

a real-time valorant tracker that shows what skins everyone in your match is using, plus comprehensive stats from tracker.gg and henrik api.

features
 real-time skin tracking - see everyone's weapon skins live in your current match
 comprehensive player stats - rank, rr, level, k/d, hs%, win rate, peak rank
 vtl.lol integration - direct links to player profiles
 match history - view last 5 games with k/d/a and results
 hidden profile support - works with private profiles (shows match history)
 player stats from tracker.gg - detailed statistics for all players
 hidden profile resolution via henrik api - find player names even when hidden
 live match monitoring - real-time updates via websocket
 agent, rank, level, and loadout data - complete player information
 auto-refresh - updates every 3 seconds
 beautiful ui - team colors, smooth animations, professional design

tech stack
backend: node.js + express
frontend: react + vite
apis:
local valorant client api (via lockfile)
henrik api (for hidden profiles)
tracker.gg api (for stats)
valorant-api.com (for skin/weapon data)

project structure
valorant-tracker/
 backend/
    src/
       services/
          lockfile.js      # read valorant lockfile
          valorant.js      # local valorant client api
          henrik.js        # henrik api integration
          tracker.js       # tracker.gg api
          cache.js         # simple caching layer
       routes/
          match.js         # match endpoints
          player.js        # player lookup endpoints
       server.js            # express server
    package.json
    .env                     # api keys
 frontend/
    src/
       components/
          matchoverview.jsx
          playercard.jsx
          skindisplay.jsx
       app.jsx
       main.jsx
    package.json
    vite.config.js
 readme.md

setup instructions

backend setup
cd backend
npm install

create .env file:
port=3000
henrikapikey=your_key_here
trackerapikey=your_key_here

frontend setup
cd frontend
npm install

run the app
terminal 1 (backend):
cd backend
npm run dev

terminal 2 (frontend):
cd frontend
npm run dev

open http://localhost:5173

how it works

lockfile reading: backend reads c:\riot games\valorant\live\lockfile to get:
port number
password for local api auth
process id

local api connection: uses credentials to connect to https://127.0.0.1:{port} with basic auth

match monitoring: connects to websocket to detect when you're in a match

data fetching:
gets match id from /chat/v4/presences
fetches player list from /core-game/v1/matches/{matchid}
fetches loadouts from /core-game/v1/matches/{matchid}/loadouts
enriches with henrik api (for hidden names) and tracker.gg (for stats)

frontend display: react app polls backend and displays real-time data

api endpoints

backend endpoints
get /api/match/current - get current match data with skins
get /api/player/:name/:tag - get player stats (uses henrik + tracker.gg)
get /api/match/status - check if valorant is running

notes
valorant must be running and you must be in a match
lockfile location is hardcoded but can be changed in lockfile.js
rate limits are handled with exponential backoff
cached responses reduce api calls

electron desktop wrapper (windows)

use this if you want a standalone desktop app window (not a browser tab).

build desktop installer/exe
build-electron.bat

this runs:
npm run electron:build:backend (builds release/valoranttrackerbackend.exe + release/frontend-dist)
electron-builder (outputs installer/app in electron-dist/)

run electron locally
npm install
start-electron.bat

