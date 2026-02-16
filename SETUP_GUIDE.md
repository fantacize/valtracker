# VALORANT Skin Tracker - Complete Setup Guide

## 📋 Prerequisites

- **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
- **VALORANT** installed and running
- **API Keys** (optional but recommended):
  - Henrik API: [Get from Discord](https://discord.gg/X3GaVkX2YN)
  - Tracker.gg API: [Register here](https://tracker.gg/developers)

## 🚀 Quick Start

### 1. Install Dependencies

**Backend:**
```bash
cd backend
npm install
```

**Frontend:**
```bash
cd frontend
npm install
```

### 2. Configure Environment Variables

Create `backend/.env` file (copy from `.env.example`):
```env
PORT=3000
HENRIK_API_KEY=your_henrik_key_here
TRACKER_API_KEY=your_tracker_key_here
```

**Note:** The app works without API keys but you'll hit rate limits faster.

### 3. Run the Application

**Terminal 1 - Start Backend:**
```bash
cd backend
npm run dev
```
You should see: `Server running on: http://localhost:3000`

**Terminal 2 - Start Frontend:**
```bash
cd frontend
npm run dev
```
You should see: `Local: http://localhost:5173`

### 4. Open the App

Go to `http://localhost:5173` in your browser.

## 🎮 How to Use

1. **Launch VALORANT** - The app detects if VALORANT is running
2. **Join a match** - Enter any game mode (Competitive, Unrated, etc.)
3. **View skins** - The app automatically fetches and displays everyone's skins
4. **Switch weapons** - Use the dropdown to view different weapon skins
5. **Load stats** - Click "Load Stats" on any player card to see their Tracker.gg stats

## 🔧 How It Works

### The Magic Behind the Scenes

1. **Lockfile Authentication**
   - Reads `C:\Riot Games\VALORANT\live\lockfile`
   - Extracts local API credentials (port + password)
   - Connects to VALORANT client running on `https://127.0.0.1:{port}`

2. **Real-time Match Detection**
   - Monitors presence data via `/chat/v4/presences`
   - Detects when you enter a match
   - Gets match ID automatically

3. **Skin Fetching** (THE COOL PART!)
   - Calls `/core-game/v1/matches/{matchId}/loadouts`
   - This endpoint returns ALL loadout data for ALL players
   - Includes: skins, chromas, levels, buddies, sprays
   - Enriches with Valorant-API.com for skin names/images

4. **Player Data Enhancement**
   - Uses Henrik API to resolve hidden profile names
   - Uses Tracker.gg for detailed stats (K/D, rank, winrate, etc.)
   - Caches responses to respect rate limits

### Key API Endpoints

**Your Backend:**
- `GET /api/match/status` - Check if VALORANT is running
- `GET /api/match/current` - Get current match with all skins
- `GET /api/player/:name/:tag` - Get player stats
- `GET /api/player/puuid/:puuid` - Get player by PUUID (for hidden profiles)

**VALORANT Local API (via lockfile):**
- `/chat/v4/presences` - Game state and match ID
- `/core-game/v1/matches/{matchId}` - Match details and players
- `/core-game/v1/matches/{matchId}/loadouts` - **SKINS ARE HERE!**

## 📡 API Details

### Henrik API
- **Rate Limits:** 30 requests/minute (free tier)
- **Used for:** Finding hidden player names, basic account info
- **Endpoints we use:**
  - `/valorant/v1/by-puuid/account/{puuid}` - Get name from PUUID
  - `/valorant/v2/by-puuid/mmr/{region}/{puuid}` - Get rank/MMR

### Tracker.gg API
- **Rate Limits:** 10 requests/minute (free tier)
- **Used for:** Detailed player statistics
- **Endpoints we use:**
  - `/valorant/standard/profile/riot/{name}%23{tag}` - Get full profile

### Valorant-API.com
- **Rate Limits:** None (public API)
- **Used for:** Weapon skins, agents, maps metadata
- **Endpoints we use:**
  - `/v1/weapons` - All weapons data
  - `/v1/weapons/skins` - All skin data with images

## 🎨 Features

### Current Features
✅ Real-time skin tracking for all weapons
✅ Player stats lookup (K/D, winrate, rank, etc.)
✅ Hidden profile name resolution
✅ Auto-refresh every 3 seconds
✅ Beautiful UI with team colors
✅ Weapon selector (Vandal, Phantom, Operator, etc.)
✅ Caching to reduce API calls
✅ Agent detection
✅ Level display

### Possible Future Features
- 🔄 Spray showcase
- 🔄 Gun buddy tracking
- 🔄 Match history view
- 🔄 Rank tracker over time
- 🔄 Desktop app version (Electron)
- 🔄 Export match data
- 🔄 Compare players side-by-side

## 🛠️ Troubleshooting

### "VALORANT Not Running"
- Make sure VALORANT is actually running
- Check if lockfile exists: `C:\Riot Games\VALORANT\live\lockfile`
- Restart VALORANT if lockfile is corrupted

### "Error fetching match data"
- You must be IN a match (not in menu)
- Wait a few seconds after match starts
- Check backend logs in terminal for errors

### "Player stats not loading"
- Check your Tracker.gg API key
- Player might not have any tracked games
- Rate limit might be hit (wait 1 minute)

### "No skin data"
- Some players might not have purchased skins (Standard skins)
- Player might not have that weapon equipped in their loadout
- API might be temporarily down

### API Rate Limits
If you hit rate limits:
1. The app uses caching to minimize calls
2. Get API keys (Henrik + Tracker.gg) for higher limits
3. Reduce auto-refresh frequency in code
4. Wait 1 minute before retrying

## 💡 Tips

1. **Get API Keys:** Even free tier keys increase rate limits significantly
2. **Cache Works:** The app caches data for 10 seconds (match) and 10 minutes (stats)
3. **Hidden Profiles:** Henrik API can find hidden/private profile names
4. **Local Only:** All VALORANT data is from your local client - no external VALORANT API needed

## 🔒 Privacy & Security

- Your lockfile password never leaves your computer
- All VALORANT API calls are to `localhost` only
- No data is stored or sent to external servers
- Open source - you can inspect all code

## 📝 Tech Stack

**Backend:**
- Node.js + Express
- Axios for API calls
- dotenv for config

**Frontend:**
- React 18
- Vite for fast builds
- CSS3 for styling

**APIs:**
- VALORANT Local Client API (via lockfile)
- Henrik API (henrikdev.xyz)
- Tracker.gg API
- Valorant-API.com

## 🤝 Contributing

Found a bug? Want to add features? 
- Fork the repo
- Make your changes
- Submit a pull request

## 📄 License

MIT License - feel free to use and modify!

## 🙏 Credits

- **Henrik API** - For VALORANT data API
- **Tracker.gg** - For player statistics
- **Valorant-API.com** - For skin and agent data
- **VALORANT Rank Yoinker** - For inspiration on lockfile reading

---

Made with ❤️ for the VALORANT community
