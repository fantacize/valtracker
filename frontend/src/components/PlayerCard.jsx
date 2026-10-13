import { useState, useEffect } from 'react';
import './PlayerCard.css';
import { getRrDisplay } from '../lib/rrStyle';
import SeenTag from './SeenTag';
import { formatActLabel } from '../lib/actLabel';
import { statTone } from '../lib/statTone';
import AgentAvatar from './AgentAvatar';

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
        statMatches: player.yoinkStats.statMatches ?? 0,
        statScope: player.yoinkStats.statScope || 'recent',
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

  const isDemo = player.isDemo;
  const isHidden = !player.gameName;

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

  const getVtlLink = () => {
    if (player?.puuid) return `https://vtl.lol/id/${player.puuid}`;
    if (player?.gameName && player?.tagLine) return `https://vtl.lol/id/${player.gameName.replace(/ /g, '+')}_${player.tagLine}`;
    return null;
  };

  const getTrackerLink = () => {
    if (!player?.gameName || !player?.tagLine) return null;
    const riotId = `${player.gameName}#${player.tagLine}`;
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
      trackerReason === 'usingYoinkOnly' ||
      trackerReason === 'usingHenrikOnly' ||
      trackerReason === 'usingHenrikAndYoink'
    ) return null;
    const map = {
      usingYoinkOnly: 'Using yoink source only (Riot local APIs).',
      trackerKeyMissing: 'Tracker stats unavailable: TRACKER_API_KEY missing in backend .env.',
      trackerAuthFailed: 'Tracker stats unavailable: invalid Tracker API key.',
      trackerRateLimited: 'Tracker stats unavailable: Tracker rate limited.',
      trackerProfileNotFound: 'Tracker stats unavailable: profile not found.',
      trackerUnavailable: 'Tracker stats unavailable: Tracker service error.'
    };
    return map[trackerReason] || 'Tracker stats unavailable.';
  })();

  const peakAct = formatActLabel(playerStats?.yoink?.peakActEpisode);
  const hasValue = (value) => value !== null && value !== undefined && value !== '' && value !== 'N/A';
  const statMatches = playerStats?.yoink?.statMatches || 0;
  const recentLabel = !statMatches ? null : playerStats.yoink.statScope === 'act'
    ? `This act · ${statMatches} games`
    : `Last ${statMatches} games (whole act loading)`;
  const statItems = playerStats?.stats ? [
    { label: 'K/D', value: formatNumber(playerStats.stats.kd, 2), className: 'kd-stat', subvalue: recentLabel },
    { label: 'HS%', value: formatNumber(playerStats.stats.headshotPct, 0, '%'), subvalue: recentLabel },
    { label: 'Win rate', value: formatNumber(playerStats.stats.winRate, 0, '%'), subvalue: 'This act' },
    {
      label: 'Peak',
      value: playerStats.rank?.peakRank && playerStats.rank.peakRank !== 'Unranked' ? playerStats.rank.peakRank : null,
      valueClassName: `peak-rank ${getRankTextClass(playerStats.rank?.peakRank)}`,
      subvalue: peakAct?.long
    },
    { label: 'Games', value: playerStats.yoink?.games || null },
    { label: 'ΔRR', value: playerStats.yoink?.deltaRrLabel || null, subvalue: rrHistoryLabel }
  ].filter((item) => hasValue(item.value)) : [];
  const trackerLink = getTrackerLink();
  const vtlLink = getVtlLink();
  const rrDisplay = playerStats?.rank?.rr >= 0 ? getRrDisplay({ tier: playerStats.rank.tier, rr: playerStats.rank.rr }) : null;

  const statValue = (label) => statItems.find((item) => item.label === label) || null;
  const peakItem = statValue('Peak');
  const statCell = (label, tone, emphasis = 'secondary') => {
    const item = statValue(label);
    return <span className={`pr-stat ${emphasis} tone-${item ? tone : 'neutral'}`} title={item?.subvalue || undefined}>{item ? item.value : '—'}</span>;
  };

  return (
    <div className={`player-row ${showSkins ? 'expanded' : ''}`}>
      <div className="pr-main">
        <AgentAvatar characterId={player.characterId} agentName={player.agentName} size={34} />

        <div className="pr-identity">
          <div className="player-name-row">
            <span className="player-name">
              {isHidden ? (
                <span className="hidden-name">Hidden player</span>
              ) : trackerLink ? (
                <a href={trackerLink} target="_blank" rel="noopener noreferrer" title="Open on tracker.gg">
                  {player.gameName}<span className="player-tag">#{player.tagLine}</span>
                </a>
              ) : (
                <>{player.gameName}<span className="player-tag">#{player.tagLine}</span></>
              )}
            </span>
            {player.nameHidden && !isHidden && (
              <span className="hidden-tag" title="Streamer mode is on. Name revealed by lookup.">hidden</span>
            )}
            <SeenTag player={player} />
          </div>
          <div className="player-meta">
            <span className="player-agent">{player.agentName || 'Unknown agent'}</span>
            <span className="player-level">{player.accountLevel === null || player.accountLevel === undefined ? 'Lv ?' : `Lv ${player.accountLevel}`}</span>
            {vtlLink && (
              <a href={vtlLink} target="_blank" rel="noopener noreferrer" className="vtl-link" title="Open on vtl.lol">VTL ↗</a>
            )}
          </div>
          {featuredWeaponSkins.length > 0 && (
            <div className="pr-skins">
              {featuredWeaponSkins.map(({ weapon, skin }) => (
                <span key={weapon}><span className="pr-skin-weapon">{weapon}</span> {skin?.skinName || 'Standard'}</span>
              ))}
            </div>
          )}
        </div>

        <div className="pr-rank">
          {getRankIcon(playerStats?.rank?.tier) ? (
            <img src={getRankIcon(playerStats.rank.tier)} alt="" className="rank-icon" />
          ) : <span className="rank-icon" />}
          <div className="pr-rank-text">
            <span className={`pr-rank-tier ${getRankTextClass(playerStats?.rank?.tier)}`}>{playerStats?.rank?.tier || 'Unranked'}</span>
            {rrDisplay && (rrDisplay.kind === 'number' ? (
              <span className={`rr-number-only ${rrDisplay.tone}`}>{playerStats.rank.rr} RR</span>
            ) : (
              <span className="rr-bar-wrapper" title={`${playerStats.rank.rr} / 100 RR`}>
                <span className="rr-bar-fill" style={{ width: `${rrDisplay.width}%`, background: rrDisplay.background }} />
                <span className="rr-text" style={{ color: rrDisplay.color }}>{playerStats.rank.rr}</span>
              </span>
            ))}
          </div>
        </div>

        {statCell('K/D', statTone('kd', playerStats?.stats?.kd), 'primary')}
        {statCell('HS%', statTone('hs', playerStats?.stats?.headshotPct))}
        {statCell('Win rate', statTone('winRate', playerStats?.stats?.winRate))}
        <span className="pr-peak" title={peakItem?.subvalue || undefined}>
          <span className={`pr-peak-tier ${peakItem?.valueClassName || ''}`}>{peakItem ? peakItem.value : '—'}</span>
          {peakItem && peakAct && <span className="pr-peak-act">{peakAct.short}</span>}
        </span>

        <button
          type="button"
          className={`pr-more ${showSkins ? 'open' : ''} ${note ? 'has-note' : ''}`}
          onClick={() => setShowSkins(!showSkins)}
          aria-expanded={showSkins}
          aria-label={showSkins ? 'Hide skins and notes' : 'Show skins and notes'}
          title={note ? `Note: ${note}` : 'Skins and notes'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
        </button>
      </div>

      {trackerReasonLabel && <div className="tracker-warning">{trackerReasonLabel}</div>}

      {showSkins && (
        <div className="pr-panel">
          {loadoutWeapons.length > 0 && (
            <>
              <label className="skin-filter">
                <span>Rarity</span>
                <select value={skinRarityFilter} onChange={(e) => setSkinRarityFilter(e.target.value)}>
                  <option value="All">All</option>
                  {availableRarities.map((rarity) => (
                    <option key={rarity} value={rarity}>{rarity}</option>
                  ))}
                </select>
              </label>
              {filteredWeapons.length === 0 ? (
                <div className="skin-text-empty">No skins match the filters.</div>
              ) : (
                <div className="skin-list">
                  {filteredWeapons.map(([weapon, skin]) => (
                    <div key={weapon} className="skin-text-item">
                      <span className="skin-list-weapon">{weapon}</span>
                      <span className="skin-list-name">{skin.skinName}</span>
                      <span className="skin-list-rarity">{skin.rarity || 'Unknown'}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          <textarea
            className="notes-textarea"
            placeholder="Add a note… (saved on this PC)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="notes-footer">
            <span className={`notes-status ${noteStatus}`}>{noteStatus === 'saved' ? 'Saved' : ''}</span>
            <button className="btn" type="button" onClick={saveNote}>Save note</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PlayerCard;
