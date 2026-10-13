import { useState, useEffect, useRef } from 'react';
import MatchOverview from './components/MatchOverview';
import PregameLobby from './components/PregameLobby';
import AccountHub from './components/AccountHub';
import WeaponMenu from './components/WeaponMenu';
import { demoMatchData } from './data/demoMatch';
import { modeName, queueLabel } from './lib/gameNames';
import './App.css';

const isBrowser = typeof window !== 'undefined';
const isViteDevPort = isBrowser && (window.location.port === '5173' || window.location.port === '5174');
const apiUrl = isViteDevPort ? 'http://localhost:3000' : (isBrowser ? window.location.origin : 'http://localhost:3000');
const weaponFilterOptions = [
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

const navItems = [
  { id: 'tracker', label: 'Lobby', icon: 'grid' },
  { id: 'account', label: 'Account', icon: 'bag' },
  { id: 'live-demo', label: 'Demo', icon: 'flask' }
];

function Icon({ name, size = 18 }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
    pulse: <path d="M3 12h4l2.2-6 4.2 12 2.2-6H21"/>,
    flask: <><path d="M9 3h6"/><path d="M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-9V3"/><path d="M8 15h8"/></>,
    refresh: <><path d="M20 6v5h-5"/><path d="M19 11a7 7 0 1 0 1 5"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    bag: <><path d="M5 8h14l-1 13H6L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></>
  };

  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name] || paths.grid}
    </svg>
  );
}

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
      const response = await fetch(`${apiUrl}/api/match/status`);
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
      
      const response = await fetch(`${apiUrl}/api/match/current`);
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
      const response = await fetch(`${apiUrl}/api/match/queue/modes`);
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
      const response = await fetch(`${apiUrl}/api/match/pregame/current`);
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
      const response = await fetch(`${apiUrl}/api/auth/status`);
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
      const response = await fetch(`${apiUrl}/api/auth/login/local`, { method: 'POST' });
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

  const joinQueue = async () => {
    if (!status.valorantRunning || !selectedQueueId) return;
    setQueueActionLoading(true);
    setQueueActionMessage('');
    try {
      const response = await fetch(`${apiUrl}/api/match/queue/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queueId: selectedQueueId })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || data.error || `Queue join failed (${response.status})`);
      }
      setQueueActionMessage(`Queued: ${queueLabel(data.queueId || selectedQueueId)}`);
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

  const modeLabel = matchData?.inGame
    ? modeName({ queueId: matchData.queueId, modeId: matchData.mode })
    : pregameData?.inPregame ? 'Agent select' : 'Not in match';
  const queueElapsedSeconds = queueState.inQueue && queueTimerStartedAt
    ? Math.max(0, Math.floor((nowTs - queueTimerStartedAt) / 1000))
    : 0;
  const queueElapsedLabel = `${String(Math.floor(queueElapsedSeconds / 60)).padStart(2, '0')}:${String(queueElapsedSeconds % 60).padStart(2, '0')}`;
  const activeView = navItems.find((item) => item.id === activeTab) || navItems[0];
  const accountName = !authStatus.loggedIn
    ? 'Connect'
    : authStatus?.user?.gameName
      ? `${authStatus.user.gameName}#${authStatus.user.tagLine || ''}`
      : 'Connected';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <span className="brand-mark"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="7" /><path d="M12 2v5M12 17v5M2 12h5M17 12h5" /></svg></span>
          <strong>Tracker</strong>
        </div>

        <nav className="primary-nav" aria-label="Primary navigation">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              aria-current={activeTab === item.id ? 'page' : undefined}
              onClick={() => setActiveTab(item.id)}
            >
              <Icon name={item.icon} size={16} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className={`status-dot ${status.valorantRunning ? 'online' : ''}`} />
          <span>{status.valorantRunning ? 'VALORANT running' : 'VALORANT not running'}</span>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="page-heading">
            <h1>{activeView.label}</h1>
            <span className={`session-pill ${queueState.inQueue ? 'searching' : ''}`}>
              <span className="session-dot" />
              {queueState.inQueue
                ? `Searching ${queueLabel(queueState.currentQueueId || selectedQueueId)} · ${queueElapsedLabel}`
                : modeLabel}
            </span>
          </div>

          <div className="topbar-actions">
            {activeTab !== 'account' && (
              <WeaponMenu options={weaponFilterOptions} selected={selectedWeapons} onToggle={toggleWeaponFilter} />
            )}

            <div className="queue-group">
              <select
                className="queue-select"
                aria-label="Queue mode"
                value={selectedQueueId}
                onChange={(e) => setSelectedQueueId(e.target.value)}
                disabled={!status.valorantRunning || queueActionLoading || queueModes.length === 0}
              >
                {queueModes.length === 0 ? (
                  <option value="">No modes</option>
                ) : queueModes.map((mode) => (
                  <option key={mode.queueId} value={mode.queueId}>{queueLabel(mode.queueId)}</option>
                ))}
              </select>
              <button className="btn btn-primary" onClick={joinQueue} disabled={!status.valorantRunning || queueActionLoading || !selectedQueueId} type="button">
                {queueActionLoading ? 'Starting…' : 'Queue'}
              </button>
            </div>

            <span className="topbar-divider" />

            <button
              type="button"
              className={`icon-button ${autoRefresh ? 'active' : ''}`}
              onClick={() => setAutoRefresh((value) => !value)}
              aria-pressed={autoRefresh}
              title={autoRefresh ? 'Auto-refresh on' : 'Auto-refresh off'}
              aria-label="Auto-refresh"
            >
              <Icon name="pulse" size={16} />
            </button>
            {!pregameData?.inPregame && activeTab !== 'account' && (
              <button className="icon-button" type="button" onClick={handleRefresh} title="Refresh now" aria-label="Refresh now">
                <Icon name="refresh" size={16} />
              </button>
            )}
            <button className={`account-button ${authStatus.loggedIn ? 'connected' : ''}`} onClick={loginLocal} disabled={authLoading} type="button" title={authStatus.loggedIn ? 'Reconnect account' : 'Connect account'}>
              <span className="account-initial">{authStatus?.user?.gameName ? authStatus.user.gameName.slice(0, 1).toUpperCase() : <Icon name="user" size={13} />}</span>
              <span className="account-name">{authLoading ? 'Connecting…' : accountName}</span>
            </button>
          </div>
        </header>

        {(queueActionMessage || authMessage) && (
          <div className="notification-stack" role="status">
            {queueActionMessage && <div className="toast-message">{queueActionMessage}</div>}
            {authMessage && <div className="toast-message">{authMessage}</div>}
          </div>
        )}

        <main className="main-content">
          <div className="content-stage">
            {activeTab === 'account' ? (
              <AccountHub apiUrl={apiUrl} enabled={authStatus.loggedIn} />
            ) : activeTab === 'live-demo' ? (
              <MatchOverview matchData={demoMatchData} selectedWeapons={selectedWeapons} />
            ) : (
              <>
                {!status.valorantRunning && (
                  <div className="empty-state">
                    <h2>VALORANT isn't running</h2>
                    <p>Open the Riot Client, launch VALORANT and sign in. The tracker connects automatically.</p>
                  </div>
                )}

                {status.valorantRunning && loading && !matchData && (
                  <div className="empty-state"><div className="loader" /><p>Loading match…</p></div>
                )}

                {status.valorantRunning && !loading && !matchData && !error && (
                  pregameData?.inPregame ? <PregameLobby data={pregameData} /> : (
                    <div className="empty-state">
                      <h2>No active match</h2>
                      <p>Players show up here once you reach agent select.</p>
                    </div>
                  )
                )}

                {error && <div className="empty-state error"><h2>Couldn't reach the tracker</h2><p>{error}</p></div>}
                {matchData && matchData.inGame && <MatchOverview matchData={matchData} selectedWeapons={selectedWeapons} />}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
