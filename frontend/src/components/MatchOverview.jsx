import PlayerCard from './PlayerCard';
import './MatchOverview.css';

function MatchOverview({ matchData, selectedWeapons = [] }) {
  const partyColors = [
    '#ff6b6b',
    '#4dabf7',
    '#51cf66',
    '#fcc419',
    '#b197fc',
    '#ff922b',
    '#63e6be',
    '#f06595'
  ];

  const mapCodenameToName = {
    Infinity: 'Abyss',
    Ascent: 'Ascent',
    Duality: 'Bind',
    Foxtrot: 'Breeze',
    Canyon: 'Fracture',
    Triad: 'Haven',
    Port: 'Icebox',
    Jam: 'Lotus',
    Pitt: 'Pearl',
    Bonsai: 'Split',
    Juliett: 'Sunset',
    HURMAlley: 'District',
    HURMHelix: 'Drift',
    HURMBowl: 'Kasbah',
    HURMYard: 'Piazza',
    Poveglia: 'Range',
    Rook: 'Corrode'
  };

  const isDeathmatchMode = String(matchData?.mode || '').toLowerCase().includes('deathmatch');
  const currentRound = Number(matchData?.round || 0);
  const getAttackingTeamId = (round) => {
    const r = Number(round || 0);
    if (!Number.isFinite(r) || r <= 0) return 'Red';
    if (r <= 12) return 'Red';
    if (r <= 24) return 'Blue';
    return ((r - 25) % 2 === 0) ? 'Red' : 'Blue';
  };
  const attackingTeamId = getAttackingTeamId(currentRound);
  const defendingTeamId = attackingTeamId === 'Red' ? 'Blue' : 'Red';

  const toRoman = (num) => {
    const value = Number(num);
    if (!Number.isFinite(value) || value <= 0) return '';
    const pairs = [
      [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
      [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
      [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
    ];
    let n = Math.floor(value);
    let out = '';
    for (const [v, token] of pairs) {
      while (n >= v) {
        out += token;
        n -= v;
      }
    }
    return out;
  };

  const playersWithPartyBadges = (() => {
    const allPlayersRaw = Array.isArray(matchData?.players) ? matchData.players : [];
    const grouped = new Map();

    for (const p of allPlayersRaw) {
      const partyId = p?.partyId ? String(p.partyId) : '';
      if (!partyId) continue;
      if (!grouped.has(partyId)) grouped.set(partyId, []);
      grouped.get(partyId).push(p);
    }

    const partyMetaById = new Map();
    let idx = 0;
    for (const [partyId, members] of grouped.entries()) {
      if (!Array.isArray(members) || members.length < 2) continue;
      const partyNumber = idx + 1;
      partyMetaById.set(partyId, {
        partyNumber,
        label: toRoman(partyNumber),
        color: partyColors[idx % partyColors.length]
      });
      idx += 1;
    }

    return allPlayersRaw.map((p) => {
      const partyId = p?.partyId ? String(p.partyId) : '';
      return {
        ...p,
        partyBadge: partyId ? (partyMetaById.get(partyId) || null) : null
      };
    });
  })();

  // Split players by team
  const teamRed = playersWithPartyBadges.filter((p) => p.teamId === 'Red');
  const teamBlue = playersWithPartyBadges.filter((p) => p.teamId === 'Blue');
  const attackers = attackingTeamId === 'Red' ? teamRed : teamBlue;
  const defenders = attackingTeamId === 'Red' ? teamBlue : teamRed;
  const allPlayers = [...playersWithPartyBadges].sort((a, b) =>
    String(a.gameName || a.name || '').localeCompare(String(b.gameName || b.name || ''))
  );

  // Determine user's team
  const userTeam = matchData.userTeam; // 'Red' or 'Blue'

  // Get map name from map ID
  const getMapName = (mapId) => {
    const raw = String(mapId || '');
    if (!raw) return 'Unknown Map';
    const lowerRaw = raw.toLowerCase();
    const normalizedRaw = lowerRaw.replace(/_/g, '');
    for (const [code, name] of Object.entries(mapCodenameToName)) {
      const normalizedCode = String(code).toLowerCase().replace(/_/g, '');
      if (normalizedRaw.includes(normalizedCode)) {
        return name;
      }
    }
    return 'Unknown Map';
  };

  // Get mode name
  const getModeName = (modeId) => {
    if (modeId.includes('Bomb')) return 'Competitive';
    if (modeId.includes('Deathmatch')) return 'Deathmatch';
    if (modeId.includes('QuickBomb')) return 'Unrated';
    if (modeId.includes('SpikeRush')) return 'Spike Rush';
    if (String(modeId || '').toLowerCase().includes('newmap')) return 'Unrated';
    return 'Custom';
  };

  return (
    <div className="match-overview">
      <div className="match-header">
        <div className="map-info">
          <h2>{getMapName(matchData.map)}</h2>
          <p className="match-mode">{getModeName(matchData.mode)}</p>
        </div>
        
        {/* Display which team user is on */}
        {userTeam && !isDeathmatchMode && (
          <div className={`user-team-indicator ${userTeam.toLowerCase()}`}>
            <span className="team-label">You are on:</span>
            <span className="team-name">
              {userTeam === attackingTeamId ? 'ATTACKERS' : 'DEFENDERS'}
            </span>
          </div>
        )}
        
      </div>

      <div className="teams-container">
        {isDeathmatchMode ? (
          <div className="team">
            <h3 className="team-header">Players ({allPlayers.length})</h3>
            <div className="players-grid">
              {allPlayers.map(player => (
                <PlayerCard
                  key={player.puuid}
                  player={player}
                  selectedWeapons={selectedWeapons}
                />
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Team Red */}
            <div className={`team ${attackingTeamId === 'Red' ? 'team-red' : 'team-blue'}`}>
              <h3 className="team-header">
                <span className={`team-indicator ${attackingTeamId === 'Red' ? 'red' : 'blue'}`}></span>
                Attackers ({attackers.length})
              </h3>
              <div className="players-grid">
                {attackers.map(player => (
                  <PlayerCard 
                    key={player.puuid} 
                    player={player}
                    selectedWeapons={selectedWeapons}
                  />
                ))}
              </div>
            </div>

            {/* Team Blue */}
            <div className={`team ${defendingTeamId === 'Blue' ? 'team-blue' : 'team-red'}`}>
              <h3 className="team-header">
                <span className={`team-indicator ${defendingTeamId === 'Blue' ? 'blue' : 'red'}`}></span>
                Defenders ({defenders.length})
              </h3>
              <div className="players-grid">
                {defenders.map(player => (
                  <PlayerCard 
                    key={player.puuid} 
                    player={player}
                    selectedWeapons={selectedWeapons}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {matchData.cached && (
        <p className="cache-notice">⚡ Showing cached data</p>
      )}
    </div>
  );
}

export default MatchOverview;
