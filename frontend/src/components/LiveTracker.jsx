import { useEffect, useMemo, useState } from 'react';
import './LiveTracker.css';

const API_URL = 'http://localhost:3000';

const createDemoPlayer = (id, agent, name, teamId, utilRate, demoWeapons = {}) => ({
  id,
  puuid: `demo-${id}`,
  agent,
  name,
  teamId,
  utilRate,
  demoWeapons,
  stats: {
    kills: 0,
    deaths: 0,
    score: 0,
    attackKills: 0,
    attackDeaths: 0,
    defenseKills: 0,
    defenseDeaths: 0
  },
  firstKills: 0,
  firstDeaths: 0,
  util: { c: 0, q: 0, e: 0, x: 0 }
});

const createDemoState = () => ({
  map: 'Ascent',
  mode: 'Competitive',
  round: 0,
  elapsedMs: 0,
  teams: [
    {
      name: 'Attackers',
      color: 'red',
      players: [
        createDemoPlayer('red-1', 'Jett', 'Flocked', 'Red', { c: 2.2, q: 0.7, e: 2.6, x: 0.25 }, { Vandal: 'Prime', Phantom: 'Spectrum' }),
        createDemoPlayer('red-2', 'Reyna', 'snaptap', 'Red', { c: 0.4, q: 2.8, e: 1.3, x: 0.22 }, { Vandal: 'Prelude to Chaos', Phantom: 'Protocol 781-A' }),
        createDemoPlayer('red-3', 'Omen', 'nebula', 'Red', { c: 2.6, q: 2.5, e: 1.1, x: 0.19 }, { Vandal: 'Sentinels of Light', Phantom: 'Recon' }),
        createDemoPlayer('red-4', 'Sova', 'scanline', 'Red', { c: 1.3, q: 1.1, e: 2.4, x: 0.21 }, { Vandal: 'Gaia\'s Vengeance', Phantom: 'Ruination' }),
        createDemoPlayer('red-5', 'Killjoy', 'byte', 'Red', { c: 2.1, q: 2.1, e: 1.5, x: 0.18 }, { Vandal: 'Araxys', Phantom: 'Radiant Crisis 001' })
      ]
    },
    {
      name: 'Defenders',
      color: 'blue',
      players: [
        createDemoPlayer('blue-1', 'Raze', 'blastpack', 'Blue', { c: 1.1, q: 1.2, e: 2.7, x: 0.24 }, { Vandal: 'Forsaken', Phantom: 'Ion' }),
        createDemoPlayer('blue-2', 'Cypher', 'tripwire', 'Blue', { c: 2.4, q: 1.8, e: 2.0, x: 0.17 }, { Vandal: 'Reaver', Phantom: 'Neo Frontier' }),
        createDemoPlayer('blue-3', 'Skye', 'guidelight', 'Blue', { c: 2.0, q: 1.9, e: 1.7, x: 0.20 }, { Vandal: 'Elderflame', Phantom: 'Oni' }),
        createDemoPlayer('blue-4', 'Viper', 'toxscreen', 'Blue', { c: 1.4, q: 1.0, e: 2.2, x: 0.16 }, { Vandal: 'RGX 11z Pro', Phantom: 'Glitchpop' }),
        createDemoPlayer('blue-5', 'Phoenix', 'flashbang', 'Blue', { c: 1.9, q: 2.5, e: 1.2, x: 0.23 }, { Vandal: 'Champions 2023', Phantom: 'Prime//2.0' })
      ]
    }
  ]
});

const formatElapsed = (ms) => {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
};

const clampInt = (value, min, max) => Math.max(min, Math.min(max, Math.floor(value)));

const bumpUtil = (value, rate, min = 0, max = 6) => {
  const variance = (Math.random() - 0.5) * 1.4;
  return value + clampInt(rate + variance, min, max);
};

const simulateDemoRound = (state) => {
  const next = JSON.parse(JSON.stringify(state));
  next.round += 1;
  next.elapsedMs += (85 + Math.floor(Math.random() * 36)) * 1000;
  const currentRound = next.round;
  const sideForTeam = (teamId, round) => {
    const r = Number(round || 0);
    if (r <= 12) return teamId === 'Red' ? 'attack' : 'defense';
    if (r <= 24) return teamId === 'Red' ? 'defense' : 'attack';
    return ((r - 25) % 2 === 0)
      ? (teamId === 'Red' ? 'attack' : 'defense')
      : (teamId === 'Red' ? 'defense' : 'attack');
  };

  const flat = [];
  for (const team of next.teams) {
    for (const player of team.players) {
      flat.push(player);
      player.util.c = bumpUtil(player.util.c, player.utilRate.c, 0, 4);
      player.util.q = bumpUtil(player.util.q, player.utilRate.q, 0, 4);
      player.util.e = bumpUtil(player.util.e, player.utilRate.e, 0, 5);
      player.util.x = bumpUtil(player.util.x, player.utilRate.x, 0, 2);
      const addKills = clampInt(Math.random() * 3, 0, 2);
      const addDeaths = clampInt(Math.random() * 2, 0, 1);
      const side = sideForTeam(player.teamId, currentRound);
      player.stats.kills += addKills;
      player.stats.deaths += addDeaths;
      if (side === 'attack') {
        player.stats.attackKills += addKills;
        player.stats.attackDeaths += addDeaths;
      } else {
        player.stats.defenseKills += addKills;
        player.stats.defenseDeaths += addDeaths;
      }
      player.stats.score += 120 + Math.floor(Math.random() * 220);
    }
  }

  if (flat.length >= 2) {
    const fkIndex = Math.floor(Math.random() * flat.length);
    let fdIndex = Math.floor(Math.random() * flat.length);
    while (fdIndex === fkIndex) {
      fdIndex = Math.floor(Math.random() * flat.length);
    }
    flat[fkIndex].firstKills += 1;
    flat[fdIndex].firstDeaths += 1;
  }

  return next;
};

function LiveTracker({ demoMode, selectedWeapons = [] }) {
  const [liveData, setLiveData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);
  const [demoState, setDemoState] = useState(() => createDemoState());

  const fetchLiveData = async () => {
    if (demoMode) return;
    setLoading(true);
    setError(null);
    try {
      const scoreboardResponse = await fetch(`${API_URL}/api/match/scoreboard/current?source=henrik`);
      if (!scoreboardResponse.ok) {
        const text = await scoreboardResponse.text();
        throw new Error(text || `Request failed (${scoreboardResponse.status})`);
      }
      const data = await scoreboardResponse.json();
      if (data.inGame) {
        // Render live data immediately; hydrate weapon skins in a follow-up request.
        setLiveData(data);
        fetch(`${API_URL}/api/match/current`)
          .then(async (resp) => {
            if (!resp.ok) return null;
            return resp.json();
          })
          .then((currentMatchData) => {
            if (!currentMatchData?.inGame) return;
            const loadoutByPuuid = {};
            for (const p of currentMatchData?.players || []) {
              if (!p?.puuid) continue;
              loadoutByPuuid[p.puuid] = p?.loadout?.weapons || {};
            }
            setLiveData((prev) => {
              if (!prev?.inGame) return prev;
              const mergedPlayers = (prev.players || []).map((p) => ({
                ...p,
                loadoutWeapons: loadoutByPuuid[p.puuid] || p.loadoutWeapons || {}
              }));
              return { ...prev, players: mergedPlayers };
            });
          })
          .catch(() => {
            // Keep live stats visible even if loadout enrichment fails.
          });
      } else {
        setLiveData(null);
      }
      setTick((t) => t + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (demoMode) {
      setDemoState(createDemoState());
      setTick(0);
      const interval = setInterval(() => {
        setDemoState((prev) => simulateDemoRound(prev));
        setTick((t) => t + 1);
      }, 2800);
      return () => clearInterval(interval);
    }
    fetchLiveData();
    const interval = setInterval(fetchLiveData, 3000);
    return () => clearInterval(interval);
  }, [demoMode]);

  const teams = useMemo(() => {
    if (demoMode) return demoState.teams;
    if (!liveData?.players) return [];

    const grouped = { Red: [], Blue: [] };
    for (const player of liveData.players) {
      const teamKey = player.teamId === 'Red' ? 'Red' : 'Blue';
      grouped[teamKey].push(player);
    }

    return [
      { name: 'Attackers', color: 'red', players: grouped.Red },
      { name: 'Defenders', color: 'blue', players: grouped.Blue }
    ];
  }, [demoMode, demoState, liveData]);

  const formatKd = (stats) => {
    const kills = Number(stats?.kills ?? 0);
    const deaths = Number(stats?.deaths ?? 0);
    if (!Number.isFinite(kills) || !Number.isFinite(deaths)) return '0.00';
    const kd = deaths > 0 ? kills / deaths : kills;
    return kd.toFixed(2);
  };

  const getDisplayedKd = (player) => {
    if (!demoMode) {
      const seasonKd = Number(player?.seasonKd);
      if (Number.isFinite(seasonKd)) return seasonKd.toFixed(2);
    }
    return formatKd(player?.stats);
  };

  const formatSideKd = (player) => {
    if (!player) return 'ATK 0.00';

    if (!demoMode) {
      const stats = player.stats || {};
      const side = String(stats.currentSide || 'attack').toLowerCase() === 'defense' ? 'DEF' : 'ATK';
      const kd = Number(stats.sideKdCurrent ?? 0);
      return `${side} ${Number.isFinite(kd) ? kd.toFixed(2) : '0.00'}`;
    }

    const round = Number(demoState?.round || 0);
    let side = 'attack';
    if (round <= 12) side = player.teamId === 'Red' ? 'attack' : 'defense';
    else if (round <= 24) side = player.teamId === 'Red' ? 'defense' : 'attack';
    else side = ((round - 25) % 2 === 0)
      ? (player.teamId === 'Red' ? 'attack' : 'defense')
      : (player.teamId === 'Red' ? 'defense' : 'attack');

    const attackKills = Number(player?.stats?.attackKills ?? 0);
    const attackDeaths = Number(player?.stats?.attackDeaths ?? 0);
    const defenseKills = Number(player?.stats?.defenseKills ?? 0);
    const defenseDeaths = Number(player?.stats?.defenseDeaths ?? 0);
    const attackKd = attackDeaths > 0 ? attackKills / attackDeaths : attackKills;
    const defenseKd = defenseDeaths > 0 ? defenseKills / defenseDeaths : defenseKills;
    const kd = side === 'attack' ? attackKd : defenseKd;
    return `${side === 'attack' ? 'ATK' : 'DEF'} ${kd.toFixed(2)}`;
  };

  const formatUtil = (player) => {
    const util = player?.utility || {};
    return `${util.c ?? 0} / ${util.q ?? 0} / ${util.e ?? 0} / ${util.x ?? 0}`;
  };

  const formatWeapons = (player) => {
    const requested = Array.isArray(selectedWeapons) && selectedWeapons.length > 0
      ? selectedWeapons
      : ['Vandal', 'Phantom'];
    const source = demoMode ? (player?.demoWeapons || {}) : (player?.loadoutWeapons || {});
    const items = requested
      .map((weapon) => {
        const skin = source?.[weapon];
        const skinName = skin?.skinName || skin || null;
        return skinName ? `${weapon}: ${skinName}` : null;
      })
      .filter(Boolean);
    return items.length > 0 ? items.join(' | ') : '-';
  };

  return (
    <div className="live-scoreboard">
      <div className="live-scoreboard-header">
        <div>
          <h2>Live Tracker {demoMode ? '(Demo)' : ''}</h2>
          <p>
            {demoMode
              ? `${demoState.map} - ${demoState.mode}`
              : liveData
                ? `${liveData.map} - ${liveData.mode} (${liveData.source || 'local'})`
                : 'Waiting for match data'}
          </p>
          {demoMode ? (
            <p className="live-meta">
              Round {demoState.round} | Match Time {formatElapsed(demoState.elapsedMs)}
            </p>
          ) : liveData?.inGame ? (
            <p className="live-meta">
              Round {liveData.round ?? '-'} | Match Time {formatElapsed(liveData.matchDurationMs ?? 0)}
            </p>
          ) : null}
        </div>
        <div className="live-scoreboard-actions">
          <button
            className="live-btn"
            onClick={() => {
              if (demoMode) {
                setDemoState((prev) => simulateDemoRound(prev));
                setTick((t) => t + 1);
              }
              else fetchLiveData();
            }}
            type="button"
          >
            {demoMode ? 'Simulate Round' : 'Refresh'}
          </button>
          <span className="live-tick">Update #{tick}</span>
        </div>
      </div>

      {!demoMode && loading && (
        <div className="live-message">Loading live data...</div>
      )}

      {!demoMode && !loading && !liveData && (
        <div className="live-message">Not in a match right now.</div>
      )}

      {!demoMode && error && (
        <div className="live-message error">{error}</div>
      )}

      {teams.length > 0 && (
        <div className="scoreboard-table">
          <div className="scoreboard-row scoreboard-head">
            <span>Agent</span>
            <span>KD</span>
            <span>Side KD</span>
            <span>Score</span>
            <span>FK</span>
            <span>FD</span>
            <span>C / Q / E / X</span>
            <span>Weapons</span>
          </div>

          {teams.map((team) => (
            <div key={team.name} className={`scoreboard-team ${team.color}`}>
              <div className={`scoreboard-row team-banner ${team.color}`}>
                <span>{team.name}</span>
                <span></span>
                <span></span>
                <span></span>
                <span></span>
                <span></span>
                <span></span>
              </div>
              {team.players.map((player, idx) => {
                if (demoMode) {
                  return (
                    <div key={player.id || `${team.name}-${idx}`} className="scoreboard-row">
                      <span className="agent-cell">
                        <span className="agent-tag">{player.agent}</span>
                        <span className="agent-name">{player.name}</span>
                      </span>
                      <span>{getDisplayedKd(player)}</span>
                      <span>{formatSideKd(player)}</span>
                      <span>{player.stats.score}</span>
                      <span className="fkfd-cell">{player.firstKills}</span>
                      <span className="fkfd-cell">{player.firstDeaths}</span>
                      <span className="util-cell">
                        {`${player.util.c} / ${player.util.q} / ${player.util.e} / ${player.util.x}`}
                      </span>
                      <span className="weapons-cell">{formatWeapons(player)}</span>
                    </div>
                  );
                }

                return (
                  <div key={player.puuid} className="scoreboard-row">
                    <span className="agent-cell">
                      <span className="agent-tag">{player.agentName || 'Agent'}</span>
                      <span className="agent-name">{player.gameName}</span>
                    </span>
                    <span>{getDisplayedKd(player)}</span>
                    <span>{formatSideKd(player)}</span>
                    <span>{player?.stats?.score ?? 0}</span>
                    <span className="fkfd-cell">{player?.stats?.firstKills ?? 0}</span>
                    <span className="fkfd-cell">{player?.stats?.firstDeaths ?? 0}</span>
                    <span className="util-cell">{formatUtil(player)}</span>
                    <span className="weapons-cell">{formatWeapons(player)}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default LiveTracker;
