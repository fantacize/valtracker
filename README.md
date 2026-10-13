# Valorant Tracker Desktop

A local-first Windows companion for VALORANT. It reads your running game client and shows, for every player in your lobby or match:

- Rank, RR and peak rank (with the act it was reached in)
- Whole-act K/D, headshot % and win rate
- Real names for players in streamer mode, plus a VTL link
- "Seen before" history from your last 300 matches
- Equipped skins for the weapons you choose
- Live round score while you're in a match

## Run

Open `release/ValorantTracker.exe`. It starts its own local service; there are no launchers or separate windows.

VALORANT and the Riot Client must be running and signed in.

## API key

Revealed names and whole-act stats come from the [Henrik API](https://docs.henrikdev.xyz/). Get a free key from its Discord, then:

- **Development:** copy `backend/.env.example` to `backend/.env` and set `HENRIK_API_KEY`.
- **Packaged app:** the backend runs from `%LOCALAPPDATA%\ValorantTracker\runtime\<version>\`, so put the same `.env` file there.

Without a key the app still works, but hidden names and whole-act stats won't load.

## Build

Requirements: Node.js, .NET 8 SDK or newer, Microsoft Edge WebView2 Runtime.

```powershell
npm run build
```

This produces `release/ValorantTracker.exe`: the frontend is embedded in the packaged backend, which is embedded in the WPF desktop shell.

## Development

```powershell
npm run dev:backend
npm run dev:frontend
```

The **Demo** tab shows the match view with sample data, so the UI can be worked on without the game running.

## Tests

```powershell
npm --prefix backend test
npm --prefix frontend test
```

## Data sources

- Local VALORANT client API (lobby, match, ranks, match history)
- [Henrik API](https://docs.henrikdev.xyz/) (hidden names, whole-act stats)
- [valorant-api.com](https://valorant-api.com/) (agent portraits, map art, season names)
