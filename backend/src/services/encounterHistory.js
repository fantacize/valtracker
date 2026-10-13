const fs = require('fs');
const path = require('path');
const valorantService = require('./valorant');
const henrikService = require('./henrik');
const { createEncounterStore, pickMatchIds } = require('./encounters');

const HISTORY_PAGE_SIZE = 20;
const HISTORY_PAGES = 2;
const MATCHES_TO_KEEP = 300;
const HENRIK_PAGES = 4;

const dataDir = path.join(
  process.env.LOCALAPPDATA || path.join(require('os').homedir(), 'AppData', 'Local'),
  'ValorantTracker'
);
const storePath = path.join(dataDir, 'encounters.json');

const fetchHenrikMatches = async (puuid, region) => {
  const loadPage = async (page, collected) => {
    const { matches, hasMore } = await henrikService.fetchStoredMatchesPage(puuid, region, page).catch(() => ({ matches: [], hasMore: false }));
    const all = [...collected, ...matches];
    return hasMore && page < HENRIK_PAGES && all.length < MATCHES_TO_KEEP ? loadPage(page + 1, all) : all;
  };
  return loadPage(1, []);
};

const fetchRiotMatchIds = async (puuid) => {
  const pages = await Promise.all(
    Array.from({ length: HISTORY_PAGES }, (_, page) => valorantService.makePdRequest(
      `/match-history/v1/history/${puuid}?startIndex=${page * HISTORY_PAGE_SIZE}&endIndex=${(page + 1) * HISTORY_PAGE_SIZE}`,
      'get'
    ).catch(() => null))
  );
  return pages.flatMap((page) => (page?.History || []).map((entry) => entry.MatchID)).filter(Boolean);
};

const fetchRecentMatchIds = async (puuid) => {
  const user = await valorantService.getCurrentUser().catch(() => null);
  const [riotIds, henrikMatches] = await Promise.all([
    fetchRiotMatchIds(puuid),
    fetchHenrikMatches(puuid, user?.region || 'na')
  ]);
  return pickMatchIds({ riotIds, henrikMatches, limit: MATCHES_TO_KEEP });
};

const encounterHistory = createEncounterStore({
  load: () => JSON.parse(fs.readFileSync(storePath, 'utf8')),
  save: (records) => {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(storePath, JSON.stringify(records));
  },
  fetchRecentMatchIds,
  fetchMatchDetails: (matchId) => valorantService.getMatchDetailsCached(matchId)
});

const encounterSummaries = async (puuids) => {
  try {
    const user = await valorantService.getCurrentUser();
    if (!user?.puuid) return {};
    encounterHistory.refreshInBackground(user.puuid);
    return encounterHistory.summariesFor(user.puuid, puuids);
  } catch {
    return {};
  }
};

module.exports = { encounterHistory, encounterSummaries };
