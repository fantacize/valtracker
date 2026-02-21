import { useState, useEffect, useRef } from 'react';
import MatchOverview from './components/MatchOverview';
import PregameLobby from './components/PregameLobby';
import LiveTracker from './components/LiveTracker';
import './App.css';

const API_URL = 'http://localhost:3000';
const WEAPON_FILTER_OPTIONS = [
  'Classic',
  'Shorty',
  'Frenzy',
  'Ghost',
  'Sheriff',
  'Stinger',
  'Spectre',
  'Bucky',
  'Judge',
  'Bulldog',
  'Guardian',
  'Phantom',
  'Vandal',
  'Marshal',
  'Outlaw',
  'Operator',
  'Ares',
  'Odin',
  'Melee'
];

function App() {
  const [matchData, setMatchData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState({ valorantRunning: false });
  const [queueModes, setQueueModes] = useState([]);
  const [selectedQueueId, setSelectedQueueId] = useState('');
  const [queueActionLoading, setQueueActionLoading] = useState(false);
  const [queueActionMessage, setQueueActionMessage] = useState('');
  const [queueState, setQueueState] = useState({ inQueue: false, queueStartedAt: null, partyState: null, currentQueueId: null });
  const [pregameData, setPregameData] = useState(null);
  const [nowTs, setNowTs] = useState(Date.now());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [authStatus, setAuthStatus] = useState({ loggedIn: false, user: null });
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [selectedWeapons, setSelectedWeapons] = useState(['Vandal', 'Phantom']);
  const [queueTimerStartedAt, setQueueTimerStartedAt] = useState(null);
  const [activeTab, setActiveTab] = useState('tracker');
  const prevInQueueRef = useRef(false);

  // Check VALORANT status
  const checkStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/api/match/status`);
      const data = await response.json();
      setStatus(data);
    } catch (err) {
      console.error('Error checking status:', err);
    }
  };

  // Fetch current match data
  const fetchMatchData = async () => {
    if (!status.valorantRunning) {
      setMatchData(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${API_URL}/api/match/current`);
      const data = await response.json();
      
      if (data.inGame) {
        setMatchData(data);
      } else {
        // Keep showing the last in-game snapshot until next pregame starts.
        // Pregame handlers are responsible for clearing matchData.
      }
    } catch (err) {
      setError(err.message);
      console.error('Error fetching match data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchQueueModes = async () => {
    if (!status.valorantRunning) {
      setQueueModes([]);
      setSelectedQueueId('');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/match/queue/modes`);
      if (!response.ok) {
        throw new Error(`Queue mode request failed (${response.status})`);
      }
      const data = await response.json();
      const enabledModes = (data.modes || []).filter((mode) => mode.enabled);
      setQueueModes(enabledModes);
      setQueueState({
        inQueue: Boolean(data.inQueue),
        queueStartedAt: data.queueStartedAt || null,
        partyState: data.partyState || null,
        currentQueueId: data.currentQueueId || null
      });

      if (data.currentQueueId && enabledModes.some((m) => m.queueId === data.currentQueueId)) {
        setSelectedQueueId(data.currentQueueId);
      } else if (enabledModes.length > 0) {
        setSelectedQueueId((prev) => (prev ? prev : enabledModes[0].queueId));
      } else {
        setSelectedQueueId('');
      }
    } catch (err) {
      console.error('Error fetching queue modes:', err);
    }
  };

  const fetchPregameData = async () => {
    if (!status.valorantRunning) {
      setPregameData(null);
      return null;
    }

    try {
      const response = await fetch(`${API_URL}/api/match/pregame/current`);
      const data = await response.json();
      if (data.inPregame) {
        setPregameData(data);
        return data;
      } else {
        setPregameData(null);
        return null;
      }
    } catch (err) {
      console.error('Error fetching pregame data:', err);
      return null;
    }
  };

  const fetchAuthStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/api/auth/status`);
      const data = await response.json();
      setAuthStatus(data);
    } catch (err) {
      console.error('Error checking auth status:', err);
      setAuthStatus({ loggedIn: false, user: null });
    }
  };

  const loginLocal = async () => {
    setAuthLoading(true);
    setAuthMessage('');
    try {
      const response = await fetch(`${API_URL}/api/auth/login/local`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || data.error || `Login failed (${response.status})`);
      }
      setAuthStatus(data);
      setAuthMessage(`Connected: ${data?.user?.gameName || 'Unknown'}#${data?.user?.tagLine || ''}`);
    } catch (err) {
      console.error('Error on local login:', err);
      setAuthMessage(`Login failed: ${err.message}`);
    } finally {
      setAuthLoading(false);
    }
  };

  const toggleWeaponFilter = (weapon) => {
    setSelectedWeapons((prev) =>
      prev.includes(weapon)
        ? prev.filter((w) => w !== weapon)
        : [...prev, weapon]
    );
  };

  const getQueueLabel = (queueId) => {
    if (!queueId) return 'Unknown';
    const map = {
      competitive: 'Competitive',
      unrated: 'Unrated',
      swiftplay: 'Swiftplay',
      spikerush: 'Spike Rush',
      deathmatch: 'Deathmatch',
      escalation: 'Escalation',
      replication: 'Replication',
      onefa: 'Deathmatch (FFA)',
      snowball: 'Snowball Fight',
      ggteam: 'Team Deathmatch'
    };
    return map[queueId] || queueId.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const joinQueue = async () => {
    if (!status.valorantRunning || !selectedQueueId) return;
    setQueueActionLoading(true);
    setQueueActionMessage('');
    try {
      const response = await fetch(`${API_URL}/api/match/queue/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queueId: selectedQueueId })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || data.error || `Queue join failed (${response.status})`);
      }
      setQueueActionMessage(`Queued: ${getQueueLabel(data.queueId || selectedQueueId)}`);
      fetchQueueModes();
    } catch (err) {
      console.error('Error joining queue:', err);
      setQueueActionMessage(`Queue failed: ${err.message}`);
    } finally {
      setQueueActionLoading(false);
    }
  };

  const handleRefresh = async () => {
    const pregame = await fetchPregameData();
    if (pregame?.inPregame) {
      setMatchData(null);
      setLoading(false);
    } else {
      await fetchMatchData();
    }
    await fetchQueueModes();
  };

  const getModeName = (modeId) => {
    if (!modeId || typeof modeId !== 'string') return 'Not in match';
    if (modeId.includes('Bomb')) return 'Competitive';
    if (modeId.includes('QuickBomb')) return 'Unrated';
    if (modeId.includes('Deathmatch')) return 'Deathmatch';
    if (modeId.includes('SpikeRush')) return 'Spike Rush';
    if (modeId.includes('Escalation')) return 'Escalation';
    if (modeId.includes('Replication')) return 'Replication';
    if (modeId.includes('Snowball')) return 'Snowball Fight';
    if (modeId.includes('Swiftplay')) return 'Swiftplay';
    return 'Custom';
  };

  // Initial load
  useEffect(() => {
    checkStatus();
  }, []);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const statusInterval = setInterval(checkStatus, 5000); // Check status every 5s
    const mainInterval = setInterval(async () => {
      if (!status.valorantRunning) {
        setMatchData(null);
        setPregameData(null);
        setLoading(false);
        return;
      }

      const pregame = await fetchPregameData();
      if (pregame?.inPregame) {
        // Freeze in-match map polling while pregame is active.
        setMatchData(null);
        setLoading(false);
        return;
      }

      await fetchMatchData();
    }, 3000);
    const queueModesInterval = setInterval(fetchQueueModes, 5000); // Queue mode refresh every 5s

    // Initial fetch
    (async () => {
      if (!status.valorantRunning) {
        setMatchData(null);
        setPregameData(null);
        setLoading(false);
        return;
      }
      const pregame = await fetchPregameData();
      if (pregame?.inPregame) {
        setMatchData(null);
        setLoading(false);
      } else {
        await fetchMatchData();
      }
    })();
    if (status.valorantRunning) {
      fetchQueueModes();
    }

    return () => {
      clearInterval(statusInterval);
      clearInterval(mainInterval);
      clearInterval(queueModesInterval);
    };
  }, [autoRefresh, status.valorantRunning]);

  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    fetchAuthStatus();
    const authInterval = setInterval(fetchAuthStatus, 15000);
    return () => clearInterval(authInterval);
  }, []);

  useEffect(() => {
    if (!status.valorantRunning) {
      setQueueTimerStartedAt(null);
      prevInQueueRef.current = false;
      return;
    }

    if (queueState.inQueue) {
      if (!prevInQueueRef.current) {
        setQueueTimerStartedAt(queueState.queueStartedAt || Date.now());
      } else if (
        queueState.queueStartedAt &&
        (!queueTimerStartedAt || queueState.queueStartedAt < queueTimerStartedAt)
      ) {
        setQueueTimerStartedAt(queueState.queueStartedAt);
      }
    } else {
      setQueueTimerStartedAt(null);
    }

    prevInQueueRef.current = queueState.inQueue;
  }, [queueState.inQueue, queueState.queueStartedAt, status.valorantRunning, queueTimerStartedAt]);

  const modeLabel = matchData?.inGame ? getModeName(matchData.mode) : 'Not in match';
  const queueElapsedSeconds = queueState.inQueue && queueTimerStartedAt
    ? Math.max(0, Math.floor((nowTs - queueTimerStartedAt) / 1000))
    : 0;
  const queueElapsedLabel = `${String(Math.floor(queueElapsedSeconds / 60)).padStart(2, '0')}:${String(queueElapsedSeconds % 60).padStart(2, '0')}`;

  return (
    <div className="app">
      <header className="header">
        <div className="header-title">
          <h1>VALORANT Skin Tracker</h1>
          <div className="tab-switch">
            <button
              type="button"
              className={`tab-btn ${activeTab === 'tracker' ? 'active' : ''}`}
              onClick={() => setActiveTab('tracker')}
            >
              Tracker
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'live-game' ? 'active' : ''}`}
              onClick={() => setActiveTab('live-game')}
            >
              Live Game
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'live-demo' ? 'active' : ''}`}
              onClick={() => setActiveTab('live-demo')}
            >
              Live Demo
            </button>
          </div>
        </div>
        <div className="header-controls">
          <div className="status-indicator">
            <span className={`status-dot ${status.valorantRunning ? 'online' : 'offline'}`}></span>
            <span>VALORANT: {status.valorantRunning ? 'Running' : 'Not Running'}</span>
          </div>
          <div className="status-indicator">
            <span className={`status-dot ${authStatus.loggedIn ? 'online' : 'offline'}`}></span>
            <span>
              Login: {authStatus.loggedIn
                ? `${authStatus?.user?.gameName || 'Unknown'}#${authStatus?.user?.tagLine || ''}`
                : 'Not Connected'}
            </span>
          </div>
          {status.valorantRunning && (
            <>
              <div className="queue-indicator">
                <span className="queue-dot online"></span>
                <span>Game Mode: {modeLabel}</span>
              </div>
              {queueState.inQueue && (
                <div className="queue-indicator">
                  <span className="queue-dot pending"></span>
                  <span>
                    Queueing {getQueueLabel(queueState.currentQueueId || selectedQueueId)} | {queueElapsedLabel}
                  </span>
                </div>
              )}
              <div className="queue-controls">
                <select
                  className="queue-select"
                  value={selectedQueueId}
                  onChange={(e) => setSelectedQueueId(e.target.value)}
                  disabled={queueActionLoading || queueModes.length === 0}
                >
                  {queueModes.length === 0 ? (
                    <option value="">No queue modes available</option>
                  ) : (
                    queueModes.map((mode) => (
                      <option key={mode.queueId} value={mode.queueId}>
                        {getQueueLabel(mode.queueId)}
                      </option>
                    ))
                  )}
                </select>
                <button
                  onClick={joinQueue}
                  className="refresh-btn"
                  disabled={queueActionLoading || !selectedQueueId}
                  type="button"
                >
                  {queueActionLoading ? 'Queueing...' : 'Queue'}
                </button>
              </div>
            </>
          )}
          <label className="auto-refresh">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh
          </label>
          {!pregameData?.inPregame && (
            <button onClick={handleRefresh} className="refresh-btn">
              Refresh
            </button>
          )}
          <button onClick={loginLocal} className="refresh-btn" disabled={authLoading} type="button">
            {authLoading ? 'Connecting...' : 'Login (Local)'}
          </button>
          <div className="weapon-filters">
            {WEAPON_FILTER_OPTIONS.map((weapon) => (
              <button
                key={weapon}
                type="button"
                className={`weapon-chip ${selectedWeapons.includes(weapon) ? 'active' : ''}`}
                onClick={() => toggleWeaponFilter(weapon)}
              >
                {weapon}
              </button>
            ))}
          </div>
        </div>
      </header>
      {status.valorantRunning && queueActionMessage && (
        <div className="queue-action-banner">
          {queueActionMessage}
        </div>
      )}
      {authMessage && (
        <div className="queue-action-banner">
          {authMessage}
        </div>
      )}

      <main className="main-content">
        {activeTab === 'live-demo' ? (
          <LiveTracker demoMode selectedWeapons={selectedWeapons} />
        ) : activeTab === 'live-game' ? (
          <LiveTracker demoMode={false} selectedWeapons={selectedWeapons} />
        ) : (
          <>
            {!status.valorantRunning && (
              <div className="message-box warning">
                <h2>VALORANT Not Running</h2>
                <p>Please launch VALORANT to use the tracker.</p>
              </div>
            )}

            {status.valorantRunning && loading && !matchData && (
              <div className="message-box">
                <div className="loader"></div>
                <p>Loading match data...</p>
              </div>
            )}

            {status.valorantRunning && !loading && !matchData && !error && (
              <>
                {pregameData?.inPregame ? (
                  <PregameLobby data={pregameData} />
                ) : (
                  <div className="message-box info">
                    <h2>Not in a Match</h2>
                    <p>Join a match to see player skins and stats!</p>
                  </div>
                )}
              </>
            )}

            {error && (
              <div className="message-box error">
                <h2>Error</h2>
                <p>{error}</p>
              </div>
            )}

            {matchData && matchData.inGame && (
              <MatchOverview matchData={matchData} selectedWeapons={selectedWeapons} />
            )}
          </>
        )}
      </main>

      <footer className="footer">
        <p>Made with love for the VALORANT community</p>
        <p className="footer-note">
          Uses Henrik API, Tracker.gg, and Valorant-API.com
        </p>
      </footer>
    </div>
  );
}

export default App;
