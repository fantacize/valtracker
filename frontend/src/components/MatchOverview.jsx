import PlayerCard from './PlayerCard';
import MapBanner from './MapBanner';
import { mapName, modeName } from '../lib/gameNames';
import { teamAverages } from '../lib/teamStats';
import './MatchOverview.css';

const attackingTeamForRound = (round) => {
  const r = Number(round || 0);
  if (!Number.isFinite(r) || r <= 12) return 'Red';
  if (r <= 24) return 'Blue';
  return (r - 25) % 2 === 0 ? 'Red' : 'Blue';
};

const formatAverage = (value, { decimals = 0, suffix = '' } = {}) =>
  value === null ? '—' : `${value.toFixed(decimals)}${suffix}`;

function MatchupCell({ attack, defense, attackColor, defenseColor, format }) {
  return (
    <span className="matchup-cell">
      <span className={`matchup-${attackColor}`}>{formatAverage(attack, format)}</span>
      <span className="matchup-sep">·</span>
      <span className={`matchup-${defenseColor}`}>{formatAverage(defense, format)}</span>
    </span>
  );
}

function MatchOverview({ matchData, selectedWeapons = [] }) {
  const isDeathmatch = String(matchData?.mode || '').toLowerCase().includes('deathmatch');
  const currentRound = Number(matchData?.round || 0);
  const attackingTeamId = attackingTeamForRound(currentRound);
  const attackColor = attackingTeamId === 'Red' ? 'red' : 'blue';
  const defenseColor = attackColor === 'red' ? 'blue' : 'red';

  const players = Array.isArray(matchData?.players) ? matchData.players : [];
  const attackers = players.filter((p) => p.teamId === attackingTeamId);
  const defenders = players.filter((p) => p.teamId && p.teamId !== attackingTeamId);
  const everyone = [...players].sort((a, b) => String(a.gameName || '').localeCompare(String(b.gameName || '')));

  const userSide = matchData.userTeam && !isDeathmatch
    ? (matchData.userTeam === attackingTeamId ? 'attacking' : 'defending')
    : null;
  const subtitle = [
    modeName({ queueId: matchData.queueId, modeId: matchData.mode }),
    currentRound ? `Round ${currentRound}` : null,
    userSide ? `You're ${userSide}` : null
  ].filter(Boolean).join(' · ');

  const attackAverages = teamAverages(attackers);
  const defenseAverages = teamAverages(defenders);
  const renderRows = (list, color) => list.map((player) => (
    <PlayerCard key={player.puuid} player={player} selectedWeapons={selectedWeapons} teamColor={color} />
  ));

  return (
    <div className="match-overview">
      <MapBanner mapPath={matchData.map} variant="hero">
        <div className="match-hero">
          <div>
            <p className="match-subtitle">{subtitle}</p>
            <h2>{mapName(matchData.map)}</h2>
          </div>
          {matchData.score && (
            <div className="scoreline" aria-label={`Score ${matchData.score.ally} to ${matchData.score.enemy}`}>
              <span className={matchData.score.ally > matchData.score.enemy ? 'score-lead' : ''}>{matchData.score.ally}</span>
              <span className="scoreline-round">Round<br />{matchData.score.round}</span>
              <span className={matchData.score.enemy > matchData.score.ally ? 'score-trail' : ''}>{matchData.score.enemy}</span>
            </div>
          )}
        </div>
      </MapBanner>

      <div className="match-table-wrap">
        <div className="match-table">
          <div className="match-table-head">
            <span>Player</span>
            <span>Rank</span>
            <span title="Whole act once loaded. Hover a value for details.">K/D</span>
            <span title="Whole act once loaded. Hover a value for details.">HS%</span>
            <span title="This act">WR</span>
            <span>Peak</span>
            <span title="Matches you've played with or against them">Seen</span>
            <span />
          </div>

          {isDeathmatch ? renderRows(everyone, 'neutral') : (
            <>
              {renderRows(attackers, attackColor)}
              <div className="matchup-row">
                <span className="matchup-label">Matchup</span>
                <span className="matchup-teams">
                  <span className={`matchup-${attackColor}`}>Attack</span> vs <span className={`matchup-${defenseColor}`}>Defense</span>
                </span>
                <MatchupCell attack={attackAverages.kd} defense={defenseAverages.kd} attackColor={attackColor} defenseColor={defenseColor} format={{ decimals: 2 }} />
                <MatchupCell attack={attackAverages.hs} defense={defenseAverages.hs} attackColor={attackColor} defenseColor={defenseColor} format={{ suffix: '%' }} />
                <MatchupCell attack={attackAverages.wr} defense={defenseAverages.wr} attackColor={attackColor} defenseColor={defenseColor} format={{ suffix: '%' }} />
                <span />
                <span />
                <span />
              </div>
              {renderRows(defenders, defenseColor)}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default MatchOverview;
