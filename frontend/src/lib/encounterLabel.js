const DAY_MS = 24 * 60 * 60 * 1000;

const record = (side) => `${side.wins}W ${side.losses}L`;

const ago = (startedAt, now) => {
  const days = Math.floor((now - startedAt) / DAY_MS);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
};

const describeLast = (last, now) =>
  `Last: ${last.sameTeam ? 'with' : 'against'} you on ${last.map}, ${ago(last.startedAt, now)} (you ${last.won ? 'won' : 'lost'})`;

export const describeEncounter = (summary, { now, currentName }) => {
  if (!summary?.games) return null;

  const lines = [
    summary.with?.games ? `With you: ${record(summary.with)}` : null,
    summary.against?.games ? `Against you: ${record(summary.against)}` : null,
    summary.last ? describeLast(summary.last, now) : null,
    summary.lastName && currentName && summary.lastName !== currentName ? `Was ${summary.lastName}` : null
  ].filter(Boolean);

  const wins = (summary.with?.wins || 0) + (summary.against?.wins || 0);
  const losses = (summary.with?.losses || 0) + (summary.against?.losses || 0);

  return {
    label: `Seen ${summary.games}×`,
    short: `${summary.games}× · ${wins}W ${losses}L`,
    details: lines.join('\n')
  };
};
