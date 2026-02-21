import { useState, useEffect } from 'react';
import './PlayerCard.css';

function PlayerCard({ player, selectedWeapons = [] }) {
  const buildYoinkFallback = () => {
    if (!player?.yoinkStats) return null;
    return {
      stats: {
        kd: player.yoinkStats.kd ?? null,
        headshotPct: player.yoinkStats.hsPct ?? null,
        winRate: player.yoinkStats.winRate ?? null,
        damagePerRound: null,
        scorePerRound: null
      },
      rank: {
        tier: player.yoinkStats.rankName || 'Unranked',
        rr: player.yoinkStats.rr ?? 0,
        peakRank: player.yoinkStats.peakRankName || 'Unranked'
      },
      yoink: {
        games: player.yoinkStats.games ?? 0,
        deltaRrLabel: player.yoinkStats.deltaRrLabel || null,
        rrHistory: Array.isArray(player.yoinkStats.rrHistory) ? player.yoinkStats.rrHistory : [],
        peakActEpisode: player.yoinkStats.peakActEpisode || null
      },
      trackerUnavailableReason: null
    };
  };

  const buildInitialStats = () => {
    if (player.demoStats) return player.demoStats;
    return buildYoinkFallback();
  };

  const [playerStats, setPlayerStats] = useState(() => buildInitialStats());
  const [showSkins, setShowSkins] = useState(false);
  const [skinRarityFilter, setSkinRarityFilter] = useState('All');
  const [note, setNote] = useState('');
  const [noteStatus, setNoteStatus] = useState('idle');
  const [showNotes, setShowNotes] = useState(false);

  // Check if player name is hidden
  const isDemo = player.isDemo;
  const isHidden = !player.gameName || player.gameName === 'Unknown' || player.gameName.includes('Player');

  useEffect(() => {
    // Always reflect latest yoink payload from parent poll.
    setPlayerStats(buildInitialStats());
  }, [player.puuid, player.yoinkStats, player.demoStats]);

  useEffect(() => {
    if (isDemo) return;
    setPlayerStats(buildInitialStats());
  }, [player.puuid, player.yoinkStats, isDemo]);

  const noteKey = player?.puuid
    ? `playerNote:${player.puuid}`
    : `playerNote:${player.gameName || 'Unknown'}#${player.tagLine || '0000'}`;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(noteKey);
      setNote(saved || '');
    } catch (err) {
      console.error('Error loading note:', err);
    }
  }, [noteKey]);

  const saveNote = () => {
    try {
      localStorage.setItem(noteKey, note);
      setNoteStatus('saved');
      setTimeout(() => setNoteStatus('idle'), 1000);
    } catch (err) {
      console.error('Error saving note:', err);
      setNoteStatus('error');
    }
  };


  const loadoutWeapons = player.loadout?.weapons ? Object.entries(player.loadout.weapons) : [];
  const availableRarities = Array.from(
    new Set(loadoutWeapons.map(([, skin]) => skin.rarity || 'Unknown'))
  ).sort();
  const filteredWeapons = loadoutWeapons.filter(([, skin]) => {
    const rarity = skin.rarity || 'Unknown';
    if (skinRarityFilter !== 'All' && rarity !== skinRarityFilter) return false;
    return true;
  });
  const featuredWeaponSkins = selectedWeapons
    .map((weapon) => ({ weapon, skin: player.loadout?.weapons?.[weapon] || null }))
    .filter((entry) => entry.skin);

  // Generate vtl.lol link
  const getVtlLink = () => {
    if (!isHidden && player?.gameName && player?.tagLine) {
      // Format: username with spaces as +, then _tagline
      const username = player.gameName.replace(/ /g, '+');
      return `https://vtl.lol/id/${username}_${player.tagLine}`;
    }
    if (player?.puuid) {
      // Hidden fallback: keep a direct identifier link available.
      return `https://vtl.lol/id/${player.puuid}`;
    }
    return null;
  };

  const getTrackerLink = () => {
    let gameName = player?.gameName || '';
    let tagLine = player?.tagLine || '';

    if ((!gameName || !tagLine) && typeof player?.name === 'string') {
      const nameParts = player.name.split('#');
      if (nameParts.length >= 2) {
        gameName = gameName || nameParts.slice(0, -1).join('#');
        tagLine = tagLine || nameParts[nameParts.length - 1];
      }
    }

    if (!gameName || !tagLine) return null;
    const riotId = `${gameName}#${tagLine}`;
    return `https://tracker.gg/valorant/profile/riot/${encodeURIComponent(riotId)}/overview`;
  };

  // Get rank icon path
  const getRankIcon = (rankTier) => {
    if (!rankTier || rankTier === 'Unranked') return null;
    
    // Convert rank tier to filename format
    // E.g., "Diamond 3" -> "Diamond_3_Rank.png"
    // "Radiant" -> "Radiant_Rank.png"
    
    const rankMap = {
      'Radiant': 'Radiant_Rank.png',
      'Immortal 1': 'Immortal_1_Rank.png',
      'Immortal 2': 'Immortal_2_Rank.png',
      'Immortal 3': 'Immortal_3_Rank.png',
      'Ascendant 1': 'Ascendant_1_Rank.png',
      'Ascendant 2': 'Ascendant_2_Rank.png',
      'Ascendant 3': 'Ascendant_3_Rank.png',
      'Diamond 1': 'Diamond_1_Rank.png',
      'Diamond 2': 'Diamond_2_Rank.png',
      'Diamond 3': 'Diamond_3_Rank.png',
      'Platinum 1': 'Platinum_1_Rank.png',
      'Platinum 2': 'Platinum_2_Rank.png',
      'Platinum 3': 'Platinum_3_Rank.png',
      'Gold 1': 'Gold_1_Rank.png',
      'Gold 2': 'Gold_2_Rank.png',
      'Gold 3': 'Gold_3_Rank.png',
      'Silver 1': 'Silver_1_Rank.png',
      'Silver 2': 'Silver_2_Rank.png',
      'Silver 3': 'Silver_3_Rank.png',
      'Bronze 1': 'Bronze_1_Rank.png',
      'Bronze 2': 'Bronze_2_Rank.png',
      'Bronze 3': 'Bronze_3_Rank.png',
      'Iron 1': 'Iron_1_Rank.png',
      'Iron 2': 'Iron_2_Rank.png',
      'Iron 3': 'Iron_3_Rank.png'
    };

    const filename = rankMap[rankTier];
    return filename ? `/ranks/${filename}` : null;
  };

  const getRankBadgeClass = (rankTier) => {
    const tier = String(rankTier || '').toLowerCase();
    if (tier.includes('radiant')) return 'rank-radiant';
    if (tier.includes('immortal')) return 'rank-immortal';
    if (tier.includes('ascendant')) return 'rank-ascendant';
    if (tier.includes('diamond')) return 'rank-diamond';
    if (tier.includes('platinum')) return 'rank-platinum';
    if (tier.includes('gold')) return 'rank-gold';
    if (tier.includes('silver')) return 'rank-silver';
    if (tier.includes('bronze')) return 'rank-bronze';
    if (tier.includes('iron')) return 'rank-iron';
    return 'rank-unranked';
  };

  const getRankTextClass = (rankTier) => {
    return getRankBadgeClass(rankTier);
  };

  const formatNumber = (value, decimals = 1, suffix = '') => {
    if (value === null || value === undefined) return 'N/A';
    const n = Number(value);
    if (Number.isNaN(n)) return String(value);
    return `${n.toFixed(decimals)}${suffix}`;
  };

  const rrHistoryLabel = (() => {
    const history = playerStats?.yoink?.rrHistory;
    if (!Array.isArray(history) || history.length === 0) return null;
    const compact = history
      .map((entry) => entry?.rrDelta)
      .filter((v) => v !== null && v !== undefined)
      .slice(0, 5)
      .map((v) => `${v >= 0 ? '+' : ''}${v}`);
    return compact.length > 0 ? compact.join(' ') : null;
  })();

  const trackerReason = playerStats?.trackerUnavailableReason || null;
  const trackerReasonLabel = (() => {
    if (
      !trackerReason ||
      trackerReason === 'using_yoink_only' ||
      trackerReason === 'using_henrik_only' ||
      trackerReason === 'using_henrik_and_yoink'
    ) return null;
    const map = {
      using_yoink_only: 'Using yoink source only (Riot local APIs).',
      tracker_key_missing: 'Tracker stats unavailable: TRACKER_API_KEY missing in backend.',
      tracker_auth_failed: 'Tracker stats unavailable: invalid Tracker API key.',
      tracker_rate_limited: 'Tracker stats unavailable: Tracker rate limited.',
      tracker_profile_not_found: 'Tracker stats unavailable: profile not found.',
      tracker_unavailable: 'Tracker stats unavailable: Tracker service error.'
    };
    return map[trackerReason] || 'Tracker stats unavailable.';
  })();

  const peakActEpisodeLabel = (() => {
    const peakMeta = playerStats?.yoink?.peakActEpisode;
    if (!peakMeta) return null;
    const ep = peakMeta.episodeNumber;
    let act = peakMeta.actNumber;

    if (!act && peakMeta.actName) {
      const match = String(peakMeta.actName).match(/(\d+)/);
      if (match) act = Number(match[1]);
    }

    if (ep && act) return `EP. ${ep} A${act}`;
    if (act) return `A${act}`;
    return peakMeta.actName || null;
  })();
  const vtlLink = getVtlLink();
  const trackerLink = getTrackerLink();

  return (
    <div className="player-card">
      {player.partyBadge && (
        <div
          className="party-badge"
          style={{
            '--party-color': player.partyBadge.color
          }}
          title={`Party ${player.partyBadge.partyNumber}`}
          aria-label={`Party ${player.partyBadge.partyNumber}`}
        >
          {player.partyBadge.label}
        </div>
      )}
      <div className="player-header">
        <div className="player-info">
          <div className="player-name-row">
            <h4 className="player-name">
              {isHidden ? (
                <span className="hidden-name">Hidden Profile</span>
              ) : (
                player.name
              )}
            </h4>
            <div className="player-links">
              {trackerLink && (
                <a
                  href={trackerLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tracker-link"
                >
                  TRN
                </a>
              )}
              {vtlLink && (
                <a
                  href={vtlLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="vtl-link"
                >
                  VTL
                </a>
              )}
            </div>
          </div>
          <p className="player-level">
            {player.accountLevel === null || player.accountLevel === undefined
              ? 'Level Hidden'
              : `Level ${player.accountLevel}`}
          </p>
          <p className="player-agent">{player.agentName || 'Unknown Agent'}</p>
        </div>
      </div>

      {/* Main Stats Display - Show immediately */}
      {playerStats && playerStats.stats && (
        <div className="player-main-stats">
          <div className={`stat-badge rank-badge ${getRankBadgeClass(playerStats.rank?.tier)}`}>
            {/* Rank Icon */}
            {getRankIcon(playerStats.rank?.tier) && (
              <img 
                src={getRankIcon(playerStats.rank?.tier)}
                alt={playerStats.rank?.tier}
                className="rank-icon"
              />
            )}
            
            <span className="stat-label">Rank</span>
            <span className="stat-value-large">
              {playerStats.rank?.tier || 'Unranked'}
            </span>
            
            {/* RR Progress Bar or RR Number */}
            {playerStats.rank?.rr >= 0 && (
              <div className="rr-container">
                {/* For Immortal and Radiant, just show the number */}
                {(playerStats.rank?.tier === 'Radiant' || 
                  playerStats.rank?.tier?.includes('Immortal')) ? (
                  <div className="rr-number-only">
                    {playerStats.rank.rr} RR
                  </div>
                ) : (
                  /* For all other ranks, show standard 0-100 bar */
                  <div className="rr-bar-wrapper">
                    <div 
                      className="rr-bar-fill" 
                      style={{ width: `${playerStats.rank.rr}%` }}
                    ></div>
                    <span className="rr-text">{playerStats.rank.rr} / 100 RR</span>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="stats-grid">
            <div className="stat-item stat-item-small kd-stat">
              <span className="stat-label">K/D</span>
              <span className="stat-value">{formatNumber(playerStats.stats.kd, 2)}</span>
            </div>
            <div className="stat-item stat-item-small">
              <span className="stat-label">HS%</span>
              <span className="stat-value">{formatNumber(playerStats.stats.headshotPct, 1, '%')}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Win Rate</span>
              <span className="stat-value">{formatNumber(playerStats.stats.winRate, 1, '%')}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Peak</span>
              <span className={`stat-value peak-rank ${getRankTextClass(playerStats.rank?.peakRank)}`}>
                {playerStats.rank?.peakRank || 'N/A'}
              </span>
              <span className="stat-subvalue">{peakActEpisodeLabel || '-'}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Games</span>
              <span className="stat-value">{playerStats.yoink?.games ?? 'N/A'}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">dRR</span>
              <span className="stat-value">{playerStats.yoink?.deltaRrLabel || 'N/A'}</span>
              <span className="stat-subvalue">{rrHistoryLabel || '-'}</span>
            </div>
          </div>
          {trackerReasonLabel && (
            <div className="tracker-warning">{trackerReasonLabel}</div>
          )}
          {featuredWeaponSkins.length > 0 && (
            <div className="featured-skins-row">
              {featuredWeaponSkins.map(({ weapon, skin }) => (
                <div key={weapon} className="featured-skin-item">
                  <span className="featured-skin-weapon">{weapon}</span>
                  <span className="featured-skin-name">{skin?.skinName || 'Standard'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Show button to load stats if not loaded for hidden profiles */}
      {isHidden && !playerStats && (
        <div className="hidden-profile-notice">
          <p>This profile is hidden</p>
          <p className="notice-subtext">View match history to identify player</p>
        </div>
      )}

      <div className="utility-row">
        {/* Skins - Collapsible */}
        {loadoutWeapons.length > 0 && (
          <div className="skin-text-display utility-card">
            <button
              className={`skin-toggle ${showSkins ? 'open' : ''}`}
              onClick={() => setShowSkins(!showSkins)}
              type="button"
            >
              <span>Skins</span>
              <span className="skin-toggle-meta">
                {filteredWeapons.length}/{loadoutWeapons.length}
                <span className="skin-toggle-caret">{showSkins ? '^' : 'V'}</span>
              </span>
            </button>

            {showSkins && (
              <>
                <div className="skin-filters">
                  <label className="skin-filter">
                    <span>Rarity</span>
                    <select
                      value={skinRarityFilter}
                      onChange={(e) => setSkinRarityFilter(e.target.value)}
                    >
                      <option value="All">All</option>
                      {availableRarities.map((rarity) => (
                        <option key={rarity} value={rarity}>
                          {rarity}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {filteredWeapons.length === 0 ? (
                  <div className="skin-text-empty">No skins match the filters.</div>
                ) : (
                  filteredWeapons.map(([weapon, skin]) => (
                    <div key={weapon} className="skin-text-item">
                      <span className="skin-list-name">{skin.skinName}</span>
                      <span className="skin-list-divider">-</span>
                      <span className="skin-list-weapon">{weapon}</span>
                      <span className="skin-list-rarity">{skin.rarity || 'Unknown'}</span>
                    </div>
                  ))
                )}
              </>
            )}
          </div>
        )}

        <div className="player-notes utility-card">
          <button
            className={`notes-tab-toggle ${showNotes ? 'open' : ''}`}
            type="button"
            onClick={() => setShowNotes((prev) => !prev)}
          >
            <span>Player Notes</span>
            <span className="notes-toggle-meta">{showNotes ? 'Hide' : 'Open'}</span>
          </button>
          {showNotes && (
            <>
              <div className="notes-header">
                <span>Local Note</span>
                <span className={`notes-status ${noteStatus}`}>{noteStatus === 'saved' ? 'Saved' : ''}</span>
              </div>
              <textarea
                className="notes-textarea"
                placeholder="Add a quick note (local only)..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <button className="notes-save-btn" type="button" onClick={saveNote}>
                Save Note
              </button>
            </>
          )}
        </div>
      </div>

    </div>
  );
}

export default PlayerCard;
