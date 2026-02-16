import { useState } from 'react';
import PlayerCard from './PlayerCard';
import './MatchOverview.css';

function MatchOverview({ matchData, selectedWeapons = [] }) {
  const MAP_CODENAME_TO_NAME = {
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
    HURM_Alley: 'District',
    HURM_Helix: 'Drift',
    HURM_Bowl: 'Kasbah',
    HURM_Yard: 'Piazza',
    Poveglia: 'Range',
    Rook: 'Corrode'
  };

  const isDeathmatchMode = String(matchData?.mode || '').toLowerCase().includes('deathmatch');

  // Split players by team
  const teamRed = matchData.players.filter(p => p.teamId === 'Red');
  const teamBlue = matchData.players.filter(p => p.teamId === 'Blue');
  const allPlayers = [...(matchData.players || [])].sort((a, b) =>
    String(a.gameName || a.name || '').localeCompare(String(b.gameName || b.name || ''))
  );

  // Determine user's team
  const userTeam = matchData.userTeam; // 'Red' or 'Blue'

  // Get map name from map ID
  const getMapName = (mapId) => {
    const raw = String(mapId || '');
    if (!raw) return 'Unknown Map';
    const lowerRaw = raw.toLowerCase();
    for (const [code, name] of Object.entries(MAP_CODENAME_TO_NAME)) {
      if (lowerRaw.includes(code.toLowerCase())) {
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
    if (modeId.includes('_NewMap')) return 'Unrated';
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
              {userTeam === 'Red' ? 'ATTACKERS' : 'DEFENDERS'}
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
            <div className="team team-red">
              <h3 className="team-header">
                <span className="team-indicator red"></span>
                Attackers ({teamRed.length})
              </h3>
              <div className="players-grid">
                {teamRed.map(player => (
                  <PlayerCard 
                    key={player.puuid} 
                    player={player}
                    selectedWeapons={selectedWeapons}
                  />
                ))}
              </div>
            </div>

            {/* Team Blue */}
            <div className="team team-blue">
              <h3 className="team-header">
                <span className="team-indicator blue"></span>
                Defenders ({teamBlue.length})
              </h3>
              <div className="players-grid">
                {teamBlue.map(player => (
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
