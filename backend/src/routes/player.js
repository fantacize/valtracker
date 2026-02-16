const express = require('express');
const router = express.Router();
const henrikService = require('../services/henrik');
const trackerService = require('../services/tracker');
const cacheService = require('../services/cache');
const valorantService = require('../services/valorant');

const parsePatchedRankTier = (patchedTier) => {
  if (!patchedTier || typeof patchedTier !== 'string') return null;
  const m = patchedTier.match(/(Iron|Bronze|Silver|Gold|Platinum|Diamond|Ascendant|Immortal|Radiant)\s*(\d)?/i);
  if (!m) return null;
  return `${m[1][0].toUpperCase()}${m[1].slice(1).toLowerCase()}${m[2] ? ` ${m[2]}` : ''}`;
};

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const computeHenrikOverviewFromMatches = (matches, puuid) => {
  const list = Array.isArray(matches) ? matches : [];
  let kills = 0;
  let deaths = 0;
  let assists = 0;
  let score = 0;
  let damageMade = 0;
  let damageReceived = 0;
  let headshots = 0;
  let bodyshots = 0;
  let legshots = 0;
  let roundsPlayed = 0;
  let wins = 0;

  for (const match of list) {
    const players = match?.players?.all_players || [];
    const me = players.find((p) => p?.puuid === puuid);
    if (!me) continue;

    const stats = me.stats || {};
    kills += toNumber(stats.kills, 0);
    deaths += toNumber(stats.deaths, 0);
    assists += toNumber(stats.assists, 0);
    score += toNumber(stats.score, 0);
    damageMade += toNumber(stats.damage_made, 0);
    damageReceived += toNumber(stats.damage_received, 0);
    headshots += toNumber(stats.headshots, 0);
    bodyshots += toNumber(stats.bodyshots, 0);
    legshots += toNumber(stats.legshots, 0);

    const redWon = toNumber(match?.teams?.red?.rounds_won, 0);
    const blueWon = toNumber(match?.teams?.blue?.rounds_won, 0);
    roundsPlayed += redWon + blueWon;

    const winningTeam = match?.teams?.red?.has_won ? 'Red' : 'Blue';
    if (me.team === winningTeam) wins += 1;
  }

  const games = list.length;
  const shots = headshots + bodyshots + legshots;
  const kd = deaths > 0 ? kills / deaths : kills;
  const hsPct = shots > 0 ? (headshots / shots) * 100 : null;
  const winRate = games > 0 ? (wins / games) * 100 : null;
  const adr = roundsPlayed > 0 ? damageMade / roundsPlayed : null;
  const ddaPerRound = roundsPlayed > 0 ? (damageMade - damageReceived) / roundsPlayed : null;
  const scorePerRound = roundsPlayed > 0 ? score / roundsPlayed : null;

  return {
    kills,
    deaths,
    assists,
    kd: Number.isFinite(kd) ? Number(kd.toFixed(2)) : null,
    headshotPct: hsPct === null ? null : Number(hsPct.toFixed(1)),
    damagePerRound: adr === null ? null : Number(adr.toFixed(1)),
    scorePerRound: scorePerRound === null ? null : Number(scorePerRound.toFixed(1)),
    matchesPlayed: games,
    matchesWon: wins,
    matchesLost: Math.max(0, games - wins),
    winRate: winRate === null ? null : Number(winRate.toFixed(1)),
    roundsPlayed,
    roundsWon: null,
    score,
    timePlayed: null,
    kast: null,
    ddaPerRound: ddaPerRound === null ? null : Number(ddaPerRound.toFixed(0)),
    kdTopPct: null,
    headshotTopPct: null,
    winRateTopPct: null,
    damagePerRoundTopPct: null,
    kastTopPct: null,
    ddaPerRoundTopPct: null
  };
};

const isUnrankedLabel = (value) => String(value || '').toLowerCase().includes('unranked');

router.get('/yoink/:puuid', async (req, res) => {
  try {
    const { puuid } = req.params;
    if (!puuid) {
      return res.status(400).json({ error: 'puuid is required' });
    }

    const cacheKey = `player_yoink_${puuid}`;
    const cached = cacheService.get(cacheKey);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    const yoink = await valorantService.getYoinkStatsForPlayer(puuid);
    const response = {
      stats: {
        kd: yoink?.kd ?? null,
        headshotPct: yoink?.hsPct ?? null,
        winRate: yoink?.winRate ?? null,
        damagePerRound: null,
        scorePerRound: null,
        kast: null,
        ddaPerRound: null,
        kdTopPct: null,
        headshotTopPct: null,
        winRateTopPct: null,
        damagePerRoundTopPct: null,
        kastTopPct: null,
        ddaPerRoundTopPct: null
      },
      rank: {
        tier: yoink?.rankName || 'Unranked',
        rr: yoink?.rr ?? 0,
        peakRank: yoink?.peakRankName || 'Unranked'
      },
      yoink: {
        games: yoink?.games ?? 0,
        deltaRrLabel: yoink?.deltaRr === null || yoink?.deltaRr === undefined
          ? 'N/A'
          : `${yoink.deltaRr >= 0 ? '+' : ''}${yoink.deltaRr} (${yoink.afkPenalty ?? 0})`,
        rrHistory: Array.isArray(yoink?.rrHistory) ? yoink.rrHistory : [],
        peakActEpisode: yoink?.peakActEpisode || null
      },
      trackerUnavailableReason: 'using_yoink_only',
      timestamp: Date.now()
    };

    cacheService.set(cacheKey, response, 60 * 1000);
    return res.json(response);
  } catch (error) {
    console.error('Error in /api/player/yoink/:puuid:', error);
    return res.status(500).json({
      error: 'Failed to fetch yoink stats',
      message: error.message
    });
  }
});

router.get('/henrik/:puuid', async (req, res) => {
  try {
    const { puuid } = req.params;
    const region = String(req.query.region || 'na').toLowerCase();
    const size = Number(req.query.size || 10);
    const cacheKey = `player_henrik_${puuid}_${region}_${size}`;
    const cached = cacheService.get(cacheKey);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    const [account, mmr, matches, mmrHistory] = await Promise.all([
      henrikService.getAccountByPuuid(puuid, region),
      henrikService.getMmrByPuuid(puuid, region),
      henrikService.getMatchHistoryByPuuid(puuid, region, 'competitive', size),
      henrikService.getMmrHistoryByPuuid(puuid, region)
    ]);

    const overview = computeHenrikOverviewFromMatches(matches, puuid);
    const peakFromMmr = mmr?.highest_rank?.patched_tier || mmr?.highest_rank?.tier?.name || null;
    const currentTierPatched = mmr?.currenttierPatched || 'Unranked';
    const rankingInTier = toNumber(mmr?.ranking_in_tier, 0);
    const rrHistory = Array.isArray(mmrHistory)
      ? mmrHistory.slice(0, 5).map((entry) => ({
          matchId: entry?.match_id || null,
          mapId: entry?.map?.id || null,
          seasonId: entry?.season_id || null,
          startTime: entry?.date?.start || null,
          rrDelta: entry?.mmr_change_to_last_game ?? null,
          afkPenalty: null
        }))
      : [];

    const response = {
      account: account || null,
      mmr: mmr || null,
      stats: overview,
      rank: {
        tier: parsePatchedRankTier(currentTierPatched) || currentTierPatched || 'Unranked',
        rr: rankingInTier,
        peakRank: parsePatchedRankTier(peakFromMmr) || peakFromMmr || parsePatchedRankTier(currentTierPatched) || currentTierPatched || 'Unranked'
      },
      yoink: {
        games: overview.matchesPlayed ?? 0,
        deltaRrLabel: rrHistory[0]?.rrDelta === null || rrHistory[0]?.rrDelta === undefined
          ? 'N/A'
          : `${rrHistory[0].rrDelta >= 0 ? '+' : ''}${rrHistory[0].rrDelta} (0)`,
        rrHistory,
        peakActEpisode: null
      },
      trackerUnavailableReason: 'using_henrik_only',
      timestamp: Date.now()
    };

    cacheService.set(cacheKey, response, 2 * 60 * 1000);
    return res.json(response);
  } catch (error) {
    console.error('Error in /api/player/henrik/:puuid:', error);
    return res.status(500).json({
      error: 'Failed to fetch henrik stats',
      message: error.message
    });
  }
});

router.get('/combined/:puuid', async (req, res) => {
  try {
    const { puuid } = req.params;
    const cacheKey = `player_combined_${puuid}`;
    const cached = cacheService.get(cacheKey);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    const previous = cacheService.get(cacheKey) || null;
    const yoink = await valorantService.getYoinkStatsForPlayer(puuid);
    if (!yoink && previous) {
      return res.json({ ...previous, stale: true, timestamp: Date.now() });
    }

    const rrHistory = Array.isArray(yoink?.rrHistory) ? yoink.rrHistory : [];
    const latestRrDelta = rrHistory[0]?.rrDelta;
    const latestAfkPenalty = rrHistory[0]?.afkPenalty ?? yoink?.afkPenalty ?? 0;

    const response = {
      account: previous?.account || null,
      mmr: previous?.mmr || null,
      stats: {
        kd: yoink?.kd ?? null,
        headshotPct: yoink?.hsPct ?? null,
        winRate: yoink?.winRate ?? null,
        matchesPlayed: yoink?.games ?? 0
      },
      rank: {
        tier: yoink?.rankName || 'Unranked',
        rr: toNumber(yoink?.rr, 0),
        peakRank: yoink?.peakRankName || 'Unranked'
      },
      yoink: {
        games: (yoink?.games ?? null) !== null && (yoink?.games ?? null) !== undefined
          ? yoink.games
          : 0,
        deltaRrLabel: latestRrDelta === null || latestRrDelta === undefined
          ? 'N/A'
          : `${latestRrDelta >= 0 ? '+' : ''}${latestRrDelta} (${latestAfkPenalty})`,
        rrHistory,
        peakActEpisode: yoink?.peakActEpisode || null
      },
      trackerUnavailableReason: 'using_yoink_only',
      timestamp: Date.now()
    };

    const mergeNonNull = (baseObj, incomingObj) => {
      const base = baseObj || {};
      const incoming = incomingObj || {};
      const merged = { ...base };
      const isUnavailable = (value) => value === null || value === undefined || value === 'N/A';
      for (const [key, value] of Object.entries(incoming)) {
        if (!isUnavailable(value)) {
          merged[key] = value;
        }
      }
      return merged;
    };

    const stabilized = {
      ...response,
      account: response.account || previous?.account || null,
      mmr: previous?.mmr || null,
      stats: mergeNonNull(previous?.stats, response.stats),
      rank: (() => {
        const rankMerged = mergeNonNull(previous?.rank, response.rank);
        const prevRank = previous?.rank || null;
        if (isUnrankedLabel(rankMerged?.peakRank) && !isUnrankedLabel(prevRank?.peakRank)) {
          rankMerged.peakRank = prevRank?.peakRank;
        }
        if (isUnrankedLabel(rankMerged?.tier) && !isUnrankedLabel(prevRank?.tier)) {
          rankMerged.tier = prevRank?.tier;
        }
        return rankMerged;
      })(),
      yoink: {
        ...mergeNonNull(previous?.yoink, response.yoink),
        rrHistory:
          Array.isArray(response?.yoink?.rrHistory) && response.yoink.rrHistory.length > 0
            ? response.yoink.rrHistory
            : Array.isArray(previous?.yoink?.rrHistory)
              ? previous.yoink.rrHistory
              : []
      },
      timestamp: Date.now()
    };

    const shortRetry =
      stabilized?.stats?.kd === 'N/A' || stabilized?.stats?.headshotPct === 'N/A';
    cacheService.set(cacheKey, stabilized, shortRetry ? 10 * 1000 : 2 * 60 * 1000);
    return res.json(stabilized);
  } catch (error) {
    console.error('Error in /api/player/combined/:puuid:', error);
    return res.status(500).json({
      error: 'Failed to fetch combined player stats',
      message: error.message
    });
  }
});

/**
 * GET /api/player/:name/:tag
 * Get comprehensive player stats using both Henrik and Tracker APIs
 */
router.get('/:name/:tag', async (req, res) => {
  try {
    const { name, tag } = req.params;
    const cacheKey = `player_${name}_${tag}`;

    // Check cache (player stats can be cached longer)
    const cached = cacheService.get(cacheKey);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    // Get account info from Henrik
    const henrikAccount = await henrikService.getAccountByName(name, tag);
    
    if (!henrikAccount) {
      return res.status(404).json({ 
        error: 'Player not found',
        message: `Could not find player ${name}#${tag}` 
      });
    }

    // Get MMR/rank from Henrik
    const henrikMmr = await henrikService.getMmrByPuuid(
      henrikAccount.puuid, 
      henrikAccount.region
    );

    // Get detailed stats from Tracker.gg
    const trackerResult = await trackerService.getPlayerStats(name, tag);
    const trackerStats = trackerResult?.data || null;

    const response = {
      account: henrikAccount,
      mmr: henrikMmr,
      stats: trackerStats ? trackerStats.overview : null,
      rank: trackerStats ? trackerStats.rank : null,
      agents: trackerStats ? trackerStats.agents : null,
      rawOverview: trackerStats ? trackerStats.rawOverview : null,
      trackerUnavailableReason: trackerResult?.unavailableReason || null,
      timestamp: Date.now()
    };

    // Cache for 10 minutes
    cacheService.set(cacheKey, response, 10 * 60 * 1000);

    res.json(response);
  } catch (error) {
    console.error('Error in /api/player/:name/:tag:', error);
    res.status(500).json({ 
      error: 'Failed to fetch player data',
      message: error.message 
    });
  }
});

/**
 * GET /api/player/puuid/:puuid
 * Get player info by PUUID (useful for hidden profiles)
 */
router.get('/puuid/:puuid', async (req, res) => {
  try {
    const { puuid } = req.params;
    const { region = 'na' } = req.query;
    const cacheKey = `player_puuid_${puuid}`;

    // Check cache
    const cached = cacheService.get(cacheKey);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    // Get account from Henrik
    const account = await henrikService.getAccountByPuuid(puuid, region);
    
    if (!account) {
      return res.status(404).json({ 
        error: 'Player not found',
        message: `Could not find player with PUUID ${puuid}` 
      });
    }

    // Get MMR
    const mmr = await henrikService.getMmrByPuuid(puuid, region);

    // Get Tracker stats
    const trackerResult = await trackerService.getPlayerStats(account.name, account.tag);
    const trackerStats = trackerResult?.data || null;

    const response = {
      account,
      mmr,
      stats: trackerStats ? trackerStats.overview : null,
      rank: trackerStats ? trackerStats.rank : null,
      agents: trackerStats ? trackerStats.agents : null,
      rawOverview: trackerStats ? trackerStats.rawOverview : null,
      trackerUnavailableReason: trackerResult?.unavailableReason || null,
      timestamp: Date.now()
    };

    // Cache for 10 minutes
    cacheService.set(cacheKey, response, 10 * 60 * 1000);

    res.json(response);
  } catch (error) {
    console.error('Error in /api/player/puuid/:puuid:', error);
    res.status(500).json({ 
      error: 'Failed to fetch player data',
      message: error.message 
    });
  }
});

/**
 * GET /api/player/match-history/:name/:tag
 * Get match history for a player
 */
router.get('/match-history/:name/:tag', async (req, res) => {
  try {
    const { name, tag } = req.params;
    const { mode = 'competitive', size = 5, region = 'na' } = req.query;
    const cacheKey = `match_history_${name}_${tag}_${mode}_${size}`;

    // Check cache
    const cached = cacheService.get(cacheKey);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    // Get account to get PUUID
    const account = await henrikService.getAccountByName(name, tag);
    
    if (!account) {
      return res.status(404).json({ 
        error: 'Player not found',
        message: `Could not find player ${name}#${tag}` 
      });
    }

    // Get match history
    const matches = await henrikService.getMatchHistoryByPuuid(
      account.puuid, 
      region, 
      mode, 
      parseInt(size)
    );

    const response = {
      account: {
        name: account.name,
        tag: account.tag,
        puuid: account.puuid
      },
      matches,
      timestamp: Date.now()
    };

    // Cache for 5 minutes
    cacheService.set(cacheKey, response, 5 * 60 * 1000);

    res.json(response);
  } catch (error) {
    console.error('Error in /api/player/match-history:', error);
    res.status(500).json({ 
      error: 'Failed to fetch match history',
      message: error.message 
    });
  }
});

/**
 * GET /api/player/match-history-puuid/:puuid
 * Get match history by PUUID (for hidden profiles)
 */
router.get('/match-history-puuid/:puuid', async (req, res) => {
  try {
    const { puuid } = req.params;
    const { mode = 'competitive', size = 5, region = 'na' } = req.query;
    const cacheKey = `match_history_puuid_${puuid}_${mode}_${size}`;

    // Check cache
    const cached = cacheService.get(cacheKey);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    // Get match history directly by PUUID
    const matches = await henrikService.getMatchHistoryByPuuid(
      puuid, 
      region, 
      mode, 
      parseInt(size)
    );

    const response = {
      puuid,
      matches,
      timestamp: Date.now()
    };

    // Cache for 5 minutes
    cacheService.set(cacheKey, response, 5 * 60 * 1000);

    res.json(response);
  } catch (error) {
    console.error('Error in /api/player/match-history-puuid:', error);
    res.status(500).json({ 
      error: 'Failed to fetch match history',
      message: error.message 
    });
  }
});

module.exports = router;
