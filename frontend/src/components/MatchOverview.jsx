import PlayerCard from './PlayerCard';
import MapBanner from './MapBanner';
import { mapName, modeName } from '../lib/gameNames';
import './MatchOverview.css';

function MatchOverview({ matchData, selectedWeapons = [] }) {
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

  const players = Array.isArray(matchData?.players) ? matchData.players : [];
  const teamRed = players.filter((p) => p.teamId === 'Red');
  const teamBlue = players.filter((p) => p.teamId === 'Blue');
  const attackers = attackingTeamId === 'Red' ? teamRed : teamBlue;
  const defenders = attackingTeamId === 'Red' ? teamBlue : teamRed;
  const allPlayers = [...players].sort((a, b) =>
    String(a.gameName || a.name || '').localeCompare(String(b.gameName || b.name || ''))
  );

  // Determine user's team
  const userTeam = matchData.userTeam; // 'Red' or 'Blue'

  // Get map name from map ID
  // Get mode name
  const renderTeam = ({ title, color, players }) => (
    <section className={`team-panel ${color}`} key={title}>
      <header className="team-panel-header">
        <span className="team-title"><i className={`team-indicator ${color}`} />{title}</span>
        <span className="team-head-cols" aria-hidden="true">
          <span>Rank</span>
          <span title="Whole act once loaded. Hover a value for details.">K/D</span>
          <span title="Whole act once loaded. Hover a value for details.">HS%</span>
          <span title="This act">WR</span>
          <span>Peak</span>
          <span />
        </span>
      </header>
      {players.map((player) => (
        <PlayerCard key={player.puuid} player={player} selectedWeapons={selectedWeapons} />
      ))}
    </section>
  );

  return (
    <div className="match-overview">
      <MapBanner mapPath={matchData.map}>
        <div className="match-header">
          <div className="map-info">
            <div>
              <p className="match-mode">{modeName({ queueId: matchData.queueId, modeId: matchData.mode })}</p>
              <h2>{mapName(matchData.map)}</h2>
            </div>
            <dl className="match-facts">
              {matchData.score && (
                <div>
                  <dt>Score</dt>
                  <dd className="score-value">
                    <span className={matchData.score.ally > matchData.score.enemy ? 'score-lead' : ''}>{matchData.score.ally}</span>
                    <span className="score-sep">–</span>
                    <span className={matchData.score.enemy > matchData.score.ally ? 'score-trail' : ''}>{matchData.score.enemy}</span>
                  </dd>
                </div>
              )}
              <div><dt>Round</dt><dd>{currentRound || '—'}</dd></div>
              <div><dt>Players</dt><dd>{allPlayers.length}</dd></div>
              {userTeam && !isDeathmatchMode && (
                <div>
                  <dt>Your side</dt>
                  <dd className="side-value">
                    <i className={`side-dot ${userTeam.toLowerCase()}`} aria-hidden="true" />
                    {userTeam === attackingTeamId ? 'Attacking' : 'Defending'}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </MapBanner>

      <div className="teams-wrap">
      <div className={`teams-container ${isDeathmatchMode ? 'single' : ''}`}>
        {isDeathmatchMode
          ? renderTeam({ title: 'Free for all', color: 'neutral', players: allPlayers })
          : (
            <>
              {renderTeam({ title: 'Attackers', color: attackingTeamId === 'Red' ? 'red' : 'blue', players: attackers })}
              {renderTeam({ title: 'Defenders', color: defendingTeamId === 'Blue' ? 'blue' : 'red', players: defenders })}
            </>
          )}
      </div>
      </div>
    </div>
  );
}

export default MatchOverview;
