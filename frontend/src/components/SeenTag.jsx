import { describeEncounter } from '../lib/encounterLabel';

function SeenTag({ player }) {
  const currentName = player?.gameName ? `${player.gameName}#${player.tagLine}` : null;
  const encounter = describeEncounter(player?.encounters, { now: Date.now(), currentName });
  if (!encounter) return null;
  return <span className="seen-tag" title={encounter.details}>{encounter.label}</span>;
}

export default SeenTag;
