const PLACEHOLDER_NAMES = new Set(['', 'unknown']);

const hasRealName = (entry) =>
  Boolean(entry?.name) && !PLACEHOLDER_NAMES.has(String(entry.name).trim().toLowerCase());

const safeLookup = async (lookup, puuids) => {
  try {
    return (await lookup(puuids)) || {};
  } catch (error) {
    console.warn('Player name lookup failed:', error.message);
    return {};
  }
};

async function resolvePlayerNames({ puuids, riotLookup, fallbackLookup }) {
  const riotNames = await safeLookup(riotLookup, puuids);
  const hiddenPuuids = puuids.filter((puuid) => !hasRealName(riotNames[puuid]));
  const fallbackNames = hiddenPuuids.length > 0 ? await safeLookup(fallbackLookup, hiddenPuuids) : {};

  return Object.fromEntries(puuids.map((puuid) => {
    if (hasRealName(riotNames[puuid])) {
      return [puuid, { name: riotNames[puuid].name, tag: riotNames[puuid].tag || '', hidden: false }];
    }
    const revealed = fallbackNames[puuid];
    return [puuid, hasRealName(revealed)
      ? { name: revealed.name, tag: revealed.tag || '', hidden: true }
      : { name: null, tag: null, hidden: true }];
  }));
}

const findRiotIdInMatch = (matchDetails, puuid) => {
  const players = Array.isArray(matchDetails?.players) ? matchDetails.players : [];
  const player = players.find((entry) => entry?.subject === puuid);
  return hasRealName({ name: player?.gameName }) ? { name: player.gameName, tag: player.tagLine || '' } : null;
};

const namesFromYoinkStats = (yoinkStatsByPuuid) => Object.fromEntries(
  Object.entries(yoinkStatsByPuuid || {})
    .filter(([, stats]) => hasRealName(stats?.riotId))
    .map(([puuid, stats]) => [puuid, stats.riotId])
);

const combineLookups = (lookups) => async (puuids) => lookups.reduce(async (foundSoFar, lookup) => {
  const found = await foundSoFar;
  const remaining = puuids.filter((puuid) => !hasRealName(found[puuid]));
  if (remaining.length === 0) return found;
  return { ...found, ...(await safeLookup(lookup, remaining)) };
}, Promise.resolve({}));

module.exports = { resolvePlayerNames, findRiotIdInMatch, namesFromYoinkStats, combineLookups };
