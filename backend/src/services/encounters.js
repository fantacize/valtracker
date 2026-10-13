const TEAMLESS_QUEUES = new Set(['deathmatch']);

const mapNameFromPath = (mapId) => String(mapId || '').split('/').filter(Boolean).pop() || 'Unknown';

const toMatchRecord = (matchDetails) => {
  const info = matchDetails?.matchInfo || {};
  if (!info.matchId || TEAMLESS_QUEUES.has(info.queueID)) return null;

  const winningTeam = (matchDetails?.teams || []).find((team) => team?.won)?.teamId || null;
  return {
    matchId: info.matchId,
    startedAt: Number(info.gameStartMillis || 0),
    queue: info.queueID || '',
    map: mapNameFromPath(info.mapId),
    winningTeam,
    players: (matchDetails?.players || []).map((player) => ({
      puuid: player.subject,
      team: player.teamId,
      name: player.gameName ? `${player.gameName}#${player.tagLine || ''}` : null
    }))
  };
};

const emptySide = () => ({ games: 0, wins: 0, losses: 0 });
const addResult = (side, won) => ({
  games: side.games + 1,
  wins: side.wins + (won ? 1 : 0),
  losses: side.losses + (won ? 0 : 1)
});

const summarizeEncounters = ({ records, selfPuuid, puuids }) => {
  const wanted = new Set(puuids.filter((puuid) => puuid !== selfPuuid));
  const chronological = [...(records || [])].filter(Boolean).sort((a, b) => a.startedAt - b.startedAt);

  return chronological.reduce((summaries, record) => {
    const self = record.players.find((player) => player.puuid === selfPuuid);
    if (!self) return summaries;
    const won = record.winningTeam === self.team;

    return record.players
      .filter((player) => wanted.has(player.puuid))
      .reduce((acc, player) => {
        const previous = acc[player.puuid] || { games: 0, with: emptySide(), against: emptySide(), last: null, lastName: null };
        const sameTeam = player.team === self.team;
        return {
          ...acc,
          [player.puuid]: {
            games: previous.games + 1,
            with: sameTeam ? addResult(previous.with, won) : previous.with,
            against: sameTeam ? previous.against : addResult(previous.against, won),
            last: { startedAt: record.startedAt, map: record.map, sameTeam, won, queue: record.queue },
            lastName: player.name || previous.lastName
          }
        };
      }, summaries);
  }, {});
};

const MAX_RECORDS = 500;
const HENRIK_TEAMLESS_MODES = new Set(['Deathmatch']);

const pickMatchIds = ({ riotIds, henrikMatches, limit }) => [...new Set([
  ...(riotIds || []),
  ...(henrikMatches || [])
    .filter((match) => !HENRIK_TEAMLESS_MODES.has(match?.meta?.mode))
    .map((match) => match?.meta?.id)
])].filter(Boolean).slice(0, limit);

const pause = (ms) => (ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve());
const chunk = (list, size) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));
const BACKGROUND_REFRESH_GAP_MS = 2 * 60 * 1000;

const createEncounterStore = ({ load, save, fetchRecentMatchIds, fetchMatchDetails, saveEvery = 25, pauseMs = 100 }) => {
  const loaded = (() => {
    try {
      const saved = load();
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  })();
  let records = loaded;
  let inflight = null;
  let lastRefreshAt = 0;

  const downloadRecord = async (matchId) => {
    try {
      const record = toMatchRecord(await fetchMatchDetails(matchId));
      await pause(pauseMs);
      return record;
    } catch {
      return null;
    }
  };

  const addRecords = (newRecords) => {
    records = [...records, ...newRecords]
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, MAX_RECORDS);
    save(records);
  };

  const refresh = async (selfPuuid) => {
    const known = new Set(records.map((record) => record.matchId));
    const missing = (await fetchRecentMatchIds(selfPuuid)).filter((matchId) => !known.has(matchId));
    if (missing.length === 0) return records;

    await chunk(missing, saveEvery).reduce(async (previous, batch) => {
      await previous;
      const downloaded = await batch.reduce(async (collected, matchId) => {
        const list = await collected;
        const record = await downloadRecord(matchId);
        return record ? [...list, record] : list;
      }, Promise.resolve([]));
      addRecords(downloaded);
    }, Promise.resolve());
    return records;
  };

  const refreshInBackground = (selfPuuid) => {
    if (!selfPuuid || inflight || Date.now() - lastRefreshAt < BACKGROUND_REFRESH_GAP_MS) return;
    lastRefreshAt = Date.now();
    inflight = refresh(selfPuuid)
      .catch((error) => console.warn('Encounter history refresh failed:', error.message))
      .finally(() => { inflight = null; });
  };

  const summariesFor = (selfPuuid, puuids) => summarizeEncounters({ records, selfPuuid, puuids });

  return { refresh, refreshInBackground, summariesFor };
};

module.exports = { toMatchRecord, summarizeEncounters, createEncounterStore, pickMatchIds };
