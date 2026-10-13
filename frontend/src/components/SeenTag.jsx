import { describeEncounter } from '../lib/encounterLabel';

function SeenTag({ player, compact = false }) {
  const currentName = player?.gameName ? `${player.gameName}#${player.tagLine}` : null;
  const encounter = describeEncounter(player?.encounters, { now: Date.now(), currentName });
  if (!encounter) return compact ? <span className="seen-none">—</span> : null;
  return <span className="seen-tag" title={encounter.details}>{compact ? encounter.short : encounter.label}</span>;
}

export default SeenTag;
