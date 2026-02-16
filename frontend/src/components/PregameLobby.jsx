import './PregameLobby.css';

function PregameLobby({ data }) {
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
    for (const [code, name] of Object.entries(MAP_CODENAME_TO_NAME)) {
      if (lowerRaw.includes(code.toLowerCase())) {
        return name;
      }
    }
    return raw;
  };

  return (
    <div className="pregame-lobby">
      <div className="pregame-header">
        <h2>Pregame Lobby</h2>
        <p>{getMapName(data.map)}</p>
      </div>
      <div className="pregame-teams">
        {['Red', 'Blue'].map((team) => (
          <div key={team} className={`pregame-team ${team.toLowerCase()}`}>
            <h3>{team === 'Red' ? 'Attackers' : 'Defenders'}</h3>
            {(teams[team] || []).map((player) => (
              <div className="pregame-player" key={player.puuid}>
                <span className="pregame-agent">{player.agentName || 'No Agent'}</span>
                <span className="pregame-name">{player.gameName}</span>
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
                    VTL
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
