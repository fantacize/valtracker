const sessionStateOf = (presence) => presence?.matchPresenceData?.sessionLoopState || presence?.sessionLoopState || null;

const extractMatchScore = (presence) => {
  if (sessionStateOf(presence) !== 'INGAME') return null;

  const source = presence?.partyPresenceData || presence;
  const ally = Number(source?.partyOwnerMatchScoreAllyTeam);
  const enemy = Number(source?.partyOwnerMatchScoreEnemyTeam);
  if (source?.partyOwnerMatchScoreAllyTeam === undefined || !Number.isFinite(ally) || !Number.isFinite(enemy)) return null;

  return { ally, enemy, round: ally + enemy + 1 };
};

module.exports = { extractMatchScore };
