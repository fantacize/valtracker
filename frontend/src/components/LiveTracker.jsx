import { useEffect, useMemo, useState } from 'react';
import './LiveTracker.css';

const DEMO_SCOREBOARD = {
  map: 'Ascent',
  mode: 'Competitive',
  teams: [
    {
      name: 'Attackers',
      color: 'red',
      players: [
        { agent: 'Jett', name: 'Flocked', skin: 'Singularity', rank: 'Ascendant 2 (28)', peak: 'Immortal 3', hs: '40', wr: '47 (93)', level: '-', rrDelta: '+18 (0)' },
        { agent: 'Reyna', name: 'Reyna', skin: 'Primordium', rank: 'Ascendant 2 (15)', peak: 'Immortal 2', hs: '19', wr: '50 (123)', level: '0', rrDelta: '-18 (0)' }
      ]
    },
    {
      name: 'Defenders',
      color: 'blue',
      players: [
        { agent: 'Sova', name: 'selena2trim#boo', skin: 'Standard', rank: 'Ascendant 2 (47)', peak: 'Ascendant 2', hs: '25', wr: '56 (91)', level: '336', rrDelta: '+16 (0)' }
      ]
    }
  ]
};

const API_URL = 'http://localhost:3000';

function LiveTracker({ demoMode }) {
  const [liveData, setLiveData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  const fetchLiveData = async () => {
    if (demoMode) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/match/scoreboard/current?weapon=Vandal`);
      const data = await response.json();
      if (data.inGame) {
        setLiveData(data);
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
    if (demoMode) return;
    fetchLiveData();
    const interval = setInterval(fetchLiveData, 3000);
    return () => clearInterval(interval);
  }, [demoMode]);

  const teams = useMemo(() => {
    if (demoMode) return DEMO_SCOREBOARD.teams;
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
  }, [demoMode, liveData]);

  const formatWr = (stats) => {
    if (!stats || stats.winRate === null || stats.winRate === undefined) return '-';
    return `${stats.winRate} (${stats.games ?? 0})`;
  };

  const formatRrDelta = (stats) => {
    if (!stats || stats.deltaRrLabel === undefined || stats.deltaRrLabel === null) return '-';
    return stats.deltaRrLabel;
  };

  const formatLevel = (player) => {
    if (player.accountLevel === null || player.accountLevel === undefined) return '-';
    return String(player.accountLevel);
  };

  return (
    <div className="live-scoreboard">
      <div className="live-scoreboard-header">
        <div>
          <h2>Live Tracker {demoMode ? '(Demo)' : ''}</h2>
          <p>
            {demoMode
              ? `${DEMO_SCOREBOARD.map} - ${DEMO_SCOREBOARD.mode}`
              : liveData
                ? `${liveData.map} - ${liveData.mode}`
                : 'Waiting for match data'}
          </p>
        </div>
        <div className="live-scoreboard-actions">
          <button
            className="live-btn"
            onClick={() => {
              if (demoMode) setTick((t) => t + 1);
              else fetchLiveData();
            }}
            type="button"
          >
            {demoMode ? 'Simulate Tick' : 'Refresh'}
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
            <span>Vandal</span>
            <span>Rank</span>
            <span>Peak Rank</span>
            <span>HS</span>
            <span>WR</span>
            <span>Level</span>
            <span>dRR</span>
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
                <span></span>
              </div>
              {team.players.map((player, idx) => {
                if (demoMode) {
                  return (
                    <div key={`${team.name}-${idx}`} className="scoreboard-row">
                      <span className="agent-cell">
                        <span className="agent-tag">{player.agent}</span>
                        <span className="agent-name">{player.name}</span>
                      </span>
                      <span>{player.skin}</span>
                      <span>{player.rank}</span>
                      <span>{player.peak}</span>
                      <span>{player.hs}</span>
                      <span>{player.wr}</span>
                      <span>{player.level}</span>
                      <span>{player.rrDelta}</span>
                    </div>
                  );
                }

                const yoinkStats = player.yoinkStats || null;
                return (
                  <div key={player.puuid} className="scoreboard-row">
                    <span className="agent-cell">
                      <span className="agent-tag">{player.agentName || 'Agent'}</span>
                      <span className="agent-name">{player.gameName}</span>
                    </span>
                    <span>{player.weaponSkin?.skinName || '-'}</span>
                    <span>{yoinkStats ? `${yoinkStats.rankName} (${yoinkStats.rr ?? 0})` : '-'}</span>
                    <span>{yoinkStats?.peakRankName || '-'}</span>
                    <span>{yoinkStats?.hsPct ?? '-'}</span>
                    <span>{formatWr(yoinkStats)}</span>
                    <span>{formatLevel(player)}</span>
                    <span>{formatRrDelta(yoinkStats)}</span>
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
