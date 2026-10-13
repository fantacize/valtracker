import './PregameLobby.css';
import SeenTag from './SeenTag';
import AgentAvatar from './AgentAvatar';
import MapBanner from './MapBanner';

function PregameLobby({ data }) {
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

  if (!data?.inPregame) return null;

  const teams = { Red: [], Blue: [] };
  for (const player of data.players || []) {
    const key = player.teamId === 'Red' ? 'Red' : 'Blue';
    teams[key].push(player);
  }

  const stateLabel = (state) => {
    if (!state) return 'none';
    const value = String(state).toLowerCase();
    if (value === 'locked') return 'locked';
    if (value === 'selected') return 'hovering';
    return value;
  };

  const getVtlLink = (player) => {
    if (player?.gameName && player?.tagLine) {
      const username = String(player.gameName).replace(/ /g, '+');
      return `https://vtl.lol/id/${username}_${player.tagLine}`;
    }
    if (player?.puuid) {
      return `https://vtl.lol/id/${player.puuid}`;
    }
    return null;
  };

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
    return raw.split('/').filter(Boolean).pop() || raw;
  };

  return (
    <div className="pregame-lobby">
      <MapBanner mapPath={data.map}>
        <div className="pregame-header">
          <div>
            <h2>{getMapName(data.map)}</h2>
            <p>Agent select</p>
          </div>
          <div className="pregame-count"><strong>{(data.players || []).length}</strong><span>players</span></div>
        </div>
      </MapBanner>
      <div className="pregame-teams">
        {['Red', 'Blue'].map((team) => (
          <div key={team} className={`pregame-team ${team.toLowerCase()}`}>
            <h3><span>{team === 'Red' ? 'Attackers' : 'Defenders'}</span><small>{teams[team].length}/5</small></h3>
            {(teams[team] || []).map((player) => (
              <div className="pregame-player" key={player.puuid}>
                <AgentAvatar characterId={player.characterId} agentName={player.agentName} size={36} />
                <span className="pregame-identity"><strong>{player.gameName ? `${player.gameName}#${player.tagLine}` : 'Hidden player'}{player.nameHidden && player.gameName && <span className="hidden-tag" title="Streamer mode is on. Name revealed by lookup.">hidden</span>}<SeenTag player={player} /></strong><small>{player.agentName || 'Choosing agent'}</small></span>
                <span className={`pregame-state ${stateLabel(player.selectionState)}`}>
                  {stateLabel(player.selectionState)}
                </span>
                {getVtlLink(player) && (
                  <a
                    href={getVtlLink(player)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pregame-vtl-link"
                  >
                    VTL ↗
                  </a>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default PregameLobby;
