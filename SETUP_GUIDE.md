valorant skin tracker - complete setup guide

 prerequisites

node.js (v16 or higher) - download here (https://nodejs.org/)
valorant installed and running
api keys (optional but recommended):
henrik api: get from discord (https://discord.gg/x3gavkx2yn)
tracker.gg api: register here (https://tracker.gg/developers)

 quick start

install dependencies

backend:
cd backend
npm install

frontend:
cd frontend
npm install

configure environment variables

create backend/.env file (copy from .env.example):
port=3000
henrikapikey=your_henrik_key_here
trackerapikey=your_tracker_key_here

note: the app works without api keys but you'll hit rate limits faster.

run the application

terminal 1 - start backend:
cd backend
npm run dev
you should see: server running on: http://localhost:3000

terminal 2 - start frontend:
cd frontend
npm run dev
you should see: local: http://localhost:5173

open the app

go to http://localhost:5173 in your browser.

 how to use

launch valorant - the app detects if valorant is running
join a match - enter any game mode (competitive, unrated, etc.)
view skins - the app automatically fetches and displays everyone's skins
switch weapons - use the dropdown to view different weapon skins
load stats - click "load stats" on any player card to see their tracker.gg stats

 how it works

the magic behind the scenes

lockfile authentication
reads c:\riot games\valorant\live\lockfile
extracts local api credentials (port + password)
connects to valorant client running on https://127.0.0.1:{port}

real-time match detection
monitors presence data via /chat/v4/presences
detects when you enter a match
gets match id automatically

skin fetching (the cool part!)
calls /core-game/v1/matches/{matchid}/loadouts
this endpoint returns all loadout data for all players
includes: skins, chromas, levels, buddies, sprays
enriches with valorant-api.com for skin names/images

player data enhancement
uses henrik api to resolve hidden profile names
uses tracker.gg for detailed stats (k/d, rank, winrate, etc.)
caches responses to respect rate limits

key api endpoints

your backend:
get /api/match/status - check if valorant is running
get /api/match/current - get current match with all skins
get /api/player/:name/:tag - get player stats
get /api/player/puuid/:puuid - get player by puuid (for hidden profiles)

valorant local api (via lockfile):
/chat/v4/presences - game state and match id
/core-game/v1/matches/{matchid} - match details and players
/core-game/v1/matches/{matchid}/loadouts - skins are here!

 api details

henrik api
rate limits: 30 requests/minute (free tier)
used for: finding hidden player names, basic account info
endpoints we use:
/valorant/v1/by-puuid/account/{puuid} - get name from puuid
/valorant/v2/by-puuid/mmr/{region}/{puuid} - get rank/mmr

tracker.gg api
rate limits: 10 requests/minute (free tier)
used for: detailed player statistics
endpoints we use:
/valorant/standard/profile/riot/{name}%23{tag} - get full profile

valorant-api.com
rate limits: none (public api)
used for: weapon skins, agents, maps metadata
endpoints we use:
/v1/weapons - all weapons data
/v1/weapons/skins - all skin data with images

 features

current features
 real-time skin tracking for all weapons
 player stats lookup (k/d, winrate, rank, etc.)
 hidden profile name resolution
 auto-refresh every 3 seconds
 beautiful ui with team colors
 weapon selector (vandal, phantom, operator, etc.)
 caching to reduce api calls
 agent detection
 level display

possible future features
 spray showcase
 gun buddy tracking
 match history view
 rank tracker over time
 desktop app version (electron)
 export match data
 compare players side-by-side

 troubleshooting

"valorant not running"
make sure valorant is actually running
check if lockfile exists: c:\riot games\valorant\live\lockfile
restart valorant if lockfile is corrupted

"error fetching match data"
you must be in a match (not in menu)
wait a few seconds after match starts
check backend logs in terminal for errors

"player stats not loading"
check your tracker.gg api key
player might not have any tracked games
rate limit might be hit (wait 1 minute)

"no skin data"
some players might not have purchased skins (standard skins)
player might not have that weapon equipped in their loadout
api might be temporarily down

api rate limits
if you hit rate limits:
the app uses caching to minimize calls
get api keys (henrik + tracker.gg) for higher limits
reduce auto-refresh frequency in code
wait 1 minute before retrying

 tips

get api keys: even free tier keys increase rate limits significantly
cache works: the app caches data for 10 seconds (match) and 10 minutes (stats)
hidden profiles: henrik api can find hidden/private profile names
local only: all valorant data is from your local client - no external valorant api needed

 privacy & security

your lockfile password never leaves your computer
all valorant api calls are to localhost only
no data is stored or sent to external servers
open source - you can inspect all code

 tech stack

backend:
node.js + express
axios for api calls
dotenv for config

frontend:
react 18
vite for fast builds
css3 for styling

apis:
valorant local client api (via lockfile)
henrik api (henrikdev.xyz)
tracker.gg api
valorant-api.com

 contributing

found a bug? want to add features?
fork the repo
make your changes
submit a pull request

 license

mit license - feel free to use and modify!

 credits

henrik api - for valorant data api
tracker.gg - for player statistics
valorant-api.com - for skin and agent data
valorant rank yoinker - for inspiration on lockfile reading



made with  for the valorant community

