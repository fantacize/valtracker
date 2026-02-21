const express = require('express');
const router = express.Router();
const axios = require('axios');
const valorantService = require('../services/valorant');
const henrikService = require('../services/henrik');
const cacheService = require('../services/cache');
const lockfileService = require('../services/lockfile');

const AGENT_NAME_BY_UUID = {
  'add6443a-41bd-e414-f6ad-e58d267f4e95': 'Jett',
  'a3bfb853-43b2-7238-a4f1-ad90e9e46bcc': 'Reyna',
  '8e253930-4c05-31dd-1b6c-968525494517': 'Omen',
  '601dbbe7-43ce-be57-2a40-4abd24953621': 'KAY/O',
  'f94c3b30-42be-e959-889c-5aa313dba261': 'Raze',
  '95b78ed7-4637-86d9-7e41-71ba8c293152': 'Harbor',
  '9f0d8ba9-4140-b941-57d3-a7ad57c6b417': 'Brimstone',
  '7f94d92c-4234-0a36-9646-3a87eb8b5c89': 'Yoru',
  '41fb69c1-4189-7b37-f117-bcaf1e96f1bf': 'Astra',
  'cc8b64c8-4b25-4ff9-6e7f-37b4da43d235': 'Deadlock',
  'eb93336a-449b-9c1b-0a54-a891f7921d69': 'Phoenix',
  '569fdd95-4d10-43ab-ca70-79becc718b46': 'Sage',
  '9e3e74a2-4a27-5c22-9f51-d54f6a76e52c': 'Chamber',
  '707eab51-4836-f488-046a-cda6bf494859': 'Viper',
  '320b2a48-4d9b-a075-30f1-1f93a9b638fa': 'Sova',
  '6f2a04ca-43e0-be17-7f36-b3908627744d': 'Skye',
  '5f8d3a7f-467b-97f3-062c-13acf203c006': 'Breach',
  '117ed9e3-49f3-6512-3ccf-0cada7e3823b': 'Cypher',
  'dade69b4-4f5a-8528-247b-219e5a1facd6': 'Fade',
  'e370fa57-4757-3604-3648-499e1f642d3f': 'Gekko',
  'bb2a4828-46eb-8cd1-e765-15848195d751': 'Neon',
  '1e58de9c-4950-5125-93e9-a0aee9f98746': 'Killjoy',
  '0e38b510-4e61-1f13-272a-a5a5f7f3d780': 'Iso',
  '1dbf2edd-4729-0984-3115-daa5eed44993': 'Clove'
};

let agentMapLastHydratedAt = 0;
const AGENT_MAP_HYDRATE_TTL_MS = 6 * 60 * 60 * 1000;

const hydrateAgentNameMap = async () => {
  const now = Date.now();
  if (now - agentMapLastHydratedAt < AGENT_MAP_HYDRATE_TTL_MS) return;

  try {
    const response = await axios.get(
      'https://valorant-api.com/v1/agents?isPlayableCharacter=true',
      { timeout: 4000 }
    );
    const agents = Array.isArray(response?.data?.data) ? response.data.data : [];
    for (const agent of agents) {
      const uuid = String(agent?.uuid || '').toLowerCase();
      const name = agent?.displayName || null;
      if (uuid && name) {
        AGENT_NAME_BY_UUID[uuid] = name;
      }
    }
  } catch (error) {
    // Keep static map as fallback.
  } finally {
    agentMapLastHydratedAt = now;
  }
};

const getAgentName = (characterId) => {
  if (!characterId) return 'Not Selected';
  return AGENT_NAME_BY_UUID[String(characterId).toLowerCase()] || 'Unknown Agent';
};

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const toNullableNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const safeString = (value, fallback = '') => {
  if (value === null || value === undefined) return fallback;
  return String(value);
};

const parseHenrikMode = (modeValue) => {
  if (typeof modeValue === 'string') return modeValue;
  return safeString(
    modeValue?.mode_id
    || modeValue?.modeId
    || modeValue?.name
    || modeValue?.id
    || modeValue?.code,
    'Unknown Mode'
  );
};

const parseHenrikMap = (mapValue) => {
  if (typeof mapValue === 'string') return mapValue;
  return safeString(
    mapValue?.name
    || mapValue?.map_id
    || mapValue?.mapId
    || mapValue?.id
    || mapValue?.code,
    'Unknown Map'
  );
};

const inferQueueFromModeId = (modeId) => {
  const raw = String(modeId || '').toLowerCase();
  if (!raw) return null;
  if (raw.includes('quickbomb') || raw.includes('unrated')) return 'unrated';
  if (raw.includes('competitive') || raw.includes('bomb')) return 'competitive';
  if (raw.includes('swiftplay')) return 'swiftplay';
  if (raw.includes('spikerush')) return 'spikerush';
  if (raw.includes('deathmatch')) return 'deathmatch';
  if (raw.includes('escalation')) return 'escalation';
  if (raw.includes('replication')) return 'replication';
  return null;
};

const normalizeTeamId = (teamRaw) => {
  const v = String(teamRaw || '').toLowerCase();
  if (v === 'red') return 'Red';
  if (v === 'blue') return 'Blue';
  return null;
};

const defaultAttackingTeamForRound = (roundNumber) => {
  const r = Number(roundNumber || 0);
  if (!Number.isFinite(r) || r <= 0) return 'Red';
  if (r <= 12) return 'Red';
  if (r <= 24) return 'Blue';
  // OT fallback: alternate each round, starting with Red at round 25.
  return ((r - 25) % 2 === 0) ? 'Red' : 'Blue';
};

const sideForTeamAtRound = (teamId, roundNumber, attackingTeam = null) => {
  const team = normalizeTeamId(teamId);
  if (!team) return 'attack';
  const attacker = normalizeTeamId(attackingTeam) || defaultAttackingTeamForRound(roundNumber);
  return team === attacker ? 'attack' : 'defense';
};

const extractCoreGameRound = (matchData = {}) => {
  const directRound = toNumber(
    matchData?.Round
    ?? matchData?.RoundNumber
    ?? matchData?.round
    ?? matchData?.roundNumber,
    0
  );
  if (directRound > 0) return directRound;

  const teams = Array.isArray(matchData?.Teams) ? matchData.Teams : [];
  let inferred = 0;
  for (const team of teams) {
    const played = toNumber(team?.RoundsPlayed ?? team?.roundsPlayed, 0);
    const won = toNumber(team?.RoundsWon ?? team?.roundsWon, 0);
    const lost = toNumber(team?.RoundsLost ?? team?.roundsLost, 0);
    const total = Math.max(played, won + lost);
    inferred = Math.max(inferred, total);
  }

  return inferred;
};

const normalizeSeasonToken = (value) => String(value || '').trim().toLowerCase();

const extractSeasonTokensFromMatch = (match = {}) => {
  const season = match?.metadata?.season || {};
  const tokens = new Set();
  const values = [
    season?.id,
    season?.short,
    season?.name,
    match?.season_id,
    match?.seasonId,
    match?.season
  ];
  for (const v of values) {
    const token = normalizeSeasonToken(v);
    if (token) tokens.add(token);
  }
  return tokens;
};

const computeSeasonKdFromHenrikMatches = (matches, puuid, seasonTokens = new Set()) => {
  const list = Array.isArray(matches) ? matches : [];
  let kills = 0;
  let deaths = 0;
  let matchedGames = 0;

  for (const match of list) {
    if (seasonTokens.size > 0) {
      const matchTokens = extractSeasonTokensFromMatch(match);
      let intersects = false;
      for (const token of matchTokens) {
        if (seasonTokens.has(token)) {
          intersects = true;
          break;
        }
      }
      if (!intersects && matchTokens.size > 0) continue;
    }

    const players = Array.isArray(match?.players?.all_players)
      ? match.players.all_players
      : Array.isArray(match?.players)
        ? match.players
        : [];
    const me = players.find((p) => (p?.puuid || p?.subject) === puuid);
    if (!me) continue;

    kills += toNumber(me?.stats?.kills, 0);
    deaths += toNumber(me?.stats?.deaths, 0);
    matchedGames += 1;
  }

  if (matchedGames <= 0) return null;
  if (deaths <= 0) return Number(kills.toFixed(2));
  return Number((kills / deaths).toFixed(2));
};

/**
 * GET /api/match/status
 * Check if VALORANT is running
 */
router.get('/status', (req, res) => {
  const isRunning = lockfileService.isValorantRunning();
  res.json({ 
    valorantRunning: isRunning,
    timestamp: Date.now()
  });
});

/**
 * GET /api/match/queue-status
 * Get VALORANT queue status from Henrik API
 */
router.get('/queue-status', async (req, res) => {
  try {
    let region = String(req.query.region || '').toLowerCase().trim();
    if (!region) {
      try {
        const user = await valorantService.getCurrentUser();
        region = (user?.region || 'na').toLowerCase();
      } catch (error) {
        region = 'na';
      }
    }

    const cacheKey = `queue_status_${region}`;
    const cached = cacheService.get(cacheKey);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    const queueStatus = await henrikService.getQueueStatus(region);
    if (!queueStatus) {
      return res.status(502).json({
        error: 'Failed to fetch queue status from Henrik API'
      });
    }

    const response = {
      region,
      queues: queueStatus.queues || [],
      timestamp: Date.now()
    };

    // Queue status changes relatively slowly
    cacheService.set(cacheKey, response, 60 * 1000);
    res.json(response);
  } catch (error) {
    console.error('Error in /api/match/queue-status:', error);
    res.status(500).json({
      error: 'Failed to fetch queue status',
      message: error.message
    });
  }
});

/**
 * GET /api/match/queue/modes
 * Get locally available queue modes + current selected queue
 */
router.get('/queue/modes', async (req, res) => {
  try {
    const cacheKey = 'local_queue_modes';
    const cached = cacheService.get(cacheKey);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    const [modes, partyStatus] = await Promise.all([
      valorantService.getQueueModes(),
      valorantService.getCurrentPartyStatus()
    ]);

    const response = {
      modes,
      currentQueueId: partyStatus?.queueId || null,
      partyState: partyStatus?.partyState || null,
      inQueue: Boolean(partyStatus?.inQueue),
      queueStartedAt: partyStatus?.queueStartedAt || null,
      partySize: partyStatus?.partySize ?? null,
      leaderPuuid: partyStatus?.leaderPuuid || null,
      members: partyStatus?.members || [],
      timestamp: Date.now()
    };

    cacheService.set(cacheKey, response, 30 * 1000);
    res.json(response);
  } catch (error) {
    console.error('Error in /api/match/queue/modes:', error);
    res.status(500).json({
      error: 'Failed to fetch queue modes',
      message: error.message
    });
  }
});

/**
 * GET /api/match/pregame/current
 * Get pregame lobby info (agent select / lock state)
 */
router.get('/pregame/current', async (req, res) => {
  try {
    await hydrateAgentNameMap();
    const pregameInfo = await valorantService.getCurrentPregame();
    if (!pregameInfo || !pregameInfo.inPregame) {
      return res.json({
        inPregame: false,
        state: pregameInfo?.state || 'UNKNOWN',
        message: 'Not in pregame currently'
      });
    }

    const { matchId, matchData } = pregameInfo;
    const teams = Array.isArray(matchData?.Teams) ? matchData.Teams : [];
    const teamById = {};
    for (const team of teams) {
      if (!team?.TeamID) continue;
      teamById[team.TeamID] = team;
    }

    const allyPlayers = Array.isArray(matchData?.AllyTeam?.Players) ? matchData.AllyTeam.Players : [];
    const enemyPlayers = Array.isArray(matchData?.EnemyTeam?.Players) ? matchData.EnemyTeam.Players : [];
    const allPlayers = [...allyPlayers, ...enemyPlayers];
    const puuids = allPlayers.map((p) => p.Subject).filter(Boolean);
    const names = await valorantService.resolvePuuidsToNames(puuids);
    const yoinkStatsByPuuid = await valorantService.getYoinkStatsForPlayers(puuids);

    const normalizePregamePlayer = (player, defaultTeamId = null) => {
      const teamId = player?.TeamID || defaultTeamId || null;
      const nameData = names[player.Subject] || null;

      return {
        puuid: player.Subject,
        name: nameData ? `${nameData.name}#${nameData.tag}` : 'Unknown Player',
        gameName: nameData?.name || 'Unknown',
        tagLine: nameData?.tag || '',
        teamId,
        characterId: player?.CharacterID || null,
        agentName: getAgentName(player?.CharacterID || null),
        selectionState: player?.CharacterSelectionState || 'none',
        yoinkStats: yoinkStatsByPuuid[player.Subject] || null
      };
    };

    const allyTeamId = allyPlayers[0]?.TeamID || teams[0]?.TeamID || null;
    const enemyTeamId = enemyPlayers[0]?.TeamID || teams[1]?.TeamID || null;
    const players = [
      ...allyPlayers.map((p) => normalizePregamePlayer(p, allyTeamId)),
      ...enemyPlayers.map((p) => normalizePregamePlayer(p, enemyTeamId))
    ];

    const lockedPlayers = players.filter((p) => String(p.selectionState || '').toLowerCase().includes('lock'));

    res.json({
      inPregame: true,
      matchId,
      map: matchData?.MapID || null,
      mode: matchData?.QueueID || null,
      players,
      lockedPlayers,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error in /api/match/pregame/current:', error);
    res.status(500).json({
      error: 'Failed to fetch pregame data',
      message: error.message
    });
  }
});

/**
 * POST /api/match/queue/join
 * Join queue for selected mode
 */
router.post('/queue/join', async (req, res) => {
  try {
    const { queueId } = req.body || {};
    const result = await valorantService.joinQueue(queueId || null);

    // Invalidate queue mode cache because selected queue may have changed
    cacheService.delete('local_queue_modes');

    res.json({
      success: true,
      ...result,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error in /api/match/queue/join:', error);
    res.status(500).json({
      error: 'Failed to join queue',
      message: error.message
    });
  }
});

/**
 * GET /api/match/current
 * Get current match data with player loadouts and skins
 */
router.get('/current', async (req, res) => {
  try {
    await hydrateAgentNameMap();
    // Check cache first (short TTL since match data changes)
    const cacheKey = 'current_match';
    const cached = cacheService.get(cacheKey);
    
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    // Get current match
    const matchInfo = await valorantService.getCurrentMatch();
    
    if (!matchInfo || !matchInfo.inGame) {
      return res.json({
        inGame: false,
        state: matchInfo?.state || 'UNKNOWN',
        message: 'Not in a match currently'
      });
    }

    const { matchId, matchData, source = 'auto' } = matchInfo;

    // Get loadouts (THIS IS WHERE THE SKINS ARE)
    const loadouts = await valorantService.getMatchLoadouts(matchId, source);

    // Get player info
    const players = matchData.Players;

    // Enrich with skin data
    const enrichedPlayers = await valorantService.enrichLoadoutsWithSkinData(loadouts, players);

    // Get player names using Riot name-service (yoink approach)
    const puuids = players.map(p => p.Subject);
    const user = await valorantService.getCurrentUser();
    let playerNames = await valorantService.resolvePuuidsToNames(puuids);
    if (Object.keys(playerNames).length === 0) {
      playerNames = await henrikService.resolvePuuids(puuids, user.region || 'na');
    }
    const yoinkStatsByPuuid = await valorantService.getYoinkStatsForPlayers(puuids);

    // Henrik v4 match has party_id for each player, which we use to tag parties.
    let partyIdByPuuid = {};
    let queuePartyLimits = null;
    try {
      const queueStatusCacheKey = `queue_status_${(user.region || 'na').toLowerCase()}`;
      let queueStatusPayload = cacheService.get(queueStatusCacheKey);
      if (!queueStatusPayload) {
        const fetchedQueueStatus = await henrikService.getQueueStatus(user.region || 'na');
        if (fetchedQueueStatus) {
          queueStatusPayload = {
            region: user.region || 'na',
            queues: fetchedQueueStatus.queues || [],
            timestamp: Date.now()
          };
          cacheService.set(queueStatusCacheKey, queueStatusPayload, 60 * 1000);
        }
      }

      const henrikMatch = await henrikService.getMatchById(user.region || 'na', matchId);
      const henrikPlayers = Array.isArray(henrikMatch?.players?.all_players)
        ? henrikMatch.players.all_players
        : Array.isArray(henrikMatch?.players)
          ? henrikMatch.players
          : [];
      for (const hp of henrikPlayers) {
        const puuid = hp?.puuid || hp?.subject || null;
        if (!puuid) continue;
        partyIdByPuuid[puuid] = hp?.party_id || hp?.partyId || null;
      }

      const inferredQueue = inferQueueFromModeId(matchData?.ModeID);
      if (inferredQueue && Array.isArray(queueStatusPayload?.queues)) {
        const matchedQueue = queueStatusPayload.queues.find(
          (q) => String(q.queue || '').toLowerCase() === inferredQueue
        );
        if (matchedQueue) {
          queuePartyLimits = {
            queue: inferredQueue,
            minPartySize: matchedQueue.minPartySize ?? null,
            maxPartySize: matchedQueue.maxPartySize ?? null
          };
        }
      }
    } catch (partyError) {
      console.warn('Henrik party enrichment failed:', partyError.message);
      partyIdByPuuid = {};
      queuePartyLimits = null;
    }

    // Combine all data
    const finalPlayers = enrichedPlayers.map(player => {
      const nameData = playerNames[player.Subject];
      
      return {
        puuid: player.Subject,
        name: nameData ? `${nameData.name}#${nameData.tag}` : 'Unknown Player',
        gameName: nameData?.name || 'Unknown',
        tagLine: nameData?.tag || '',
        teamId: player.TeamID,
        characterId: player.CharacterID,
        agentName: getAgentName(player.CharacterID),
        playerIdentity: player.PlayerIdentity,
        accountLevel: player.PlayerIdentity?.AccountLevel ?? null,
        partyId: partyIdByPuuid[player.Subject] || null,
        yoinkStats: yoinkStatsByPuuid[player.Subject] || null,
        loadout: player.loadout
      };
    });

    // Find current user's team
    const currentUserPuuid = user.puuid;
    const currentUserPlayer = finalPlayers.find(p => p.puuid === currentUserPuuid);
    const userTeam = currentUserPlayer ? currentUserPlayer.teamId : null;
    const round = extractCoreGameRound(matchData);

    const response = {
      inGame: true,
      matchId,
      map: matchData.MapID,
      mode: matchData.ModeID,
      round,
      userTeam: userTeam, // Which team the user is on
      queuePartyLimits,
      players: finalPlayers,
      timestamp: Date.now()
    };

    // Cache for 10 seconds (match data updates frequently)
    cacheService.set(cacheKey, response, 10 * 1000);
    console.log(`Current match response ok: source=${source} players=${finalPlayers.length} map=${matchData.MapID}`);

    res.json(response);
  } catch (error) {
    console.error('Error in /api/match/current:', error);
    res.status(500).json({ 
      error: 'Failed to fetch current match data',
      message: error.message 
    });
  }
});

/**
 * GET /api/match/loadouts/:matchId
 * Get just the loadouts for a specific match
 */
router.get('/loadouts/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;
    const loadouts = await valorantService.getMatchLoadouts(matchId);
    res.json(loadouts);
  } catch (error) {
    console.error('Error fetching loadouts:', error);
    res.status(500).json({ 
      error: 'Failed to fetch loadouts',
      message: error.message 
    });
  }
});

/**
 * GET /api/match/scoreboard/current
 * Get live scoreboard data for current match
 */
router.get('/scoreboard/current', async (req, res) => {
  try {
    await hydrateAgentNameMap();
    const weaponName = String(req.query.weapon || 'Vandal');
    const source = String(req.query.source || 'local').toLowerCase();
    const matchInfo = await valorantService.getCurrentMatch();

    if (!matchInfo || !matchInfo.inGame) {
      return res.json({
        inGame: false,
        state: matchInfo?.state || 'UNKNOWN',
        message: 'Not in a match currently'
      });
    }

    const { matchId, matchData } = matchInfo;

    if (source === 'henrik') {
      const user = await valorantService.getCurrentUser();
      const region = String(user?.region || 'na').toLowerCase();
      const liveMatch = await henrikService.getMatchById(region, matchId);

      if (!liveMatch) {
        return res.status(502).json({
          error: 'Failed to fetch live match from Henrik API',
          matchId,
          region
        });
      }

      const allPlayers = Array.isArray(liveMatch?.players?.all_players)
        ? liveMatch.players.all_players
        : Array.isArray(liveMatch?.players)
          ? liveMatch.players
          : [];
      const puuids = allPlayers
        .map((p) => p?.puuid || p?.subject || null)
        .filter(Boolean);
      const yoinkStatsByPuuid = await valorantService.getYoinkStatsForPlayers(puuids);
      const metadata = liveMatch?.metadata || {};
      const seasonTokens = new Set();
      const seasonRawValues = [
        metadata?.season?.id,
        metadata?.season?.short,
        metadata?.season?.name
      ];
      for (const value of seasonRawValues) {
        const token = normalizeSeasonToken(value);
        if (token) seasonTokens.add(token);
      }

      const seasonKdByPuuid = {};
      const seasonKdCacheTtlMs = 30 * 60 * 1000;
      const playersToHydrate = [];
      for (const puuid of puuids) {
        const cacheKey = `henrik_season_kd_${region}_${puuid}_${Array.from(seasonTokens).join('|') || 'current'}`;
        const cachedKd = cacheService.get(cacheKey);
        if (cachedKd !== null && cachedKd !== undefined) {
          seasonKdByPuuid[puuid] = cachedKd;
        } else {
          playersToHydrate.push({ puuid, cacheKey });
        }
      }

      // Limit new Henrik history lookups per request to avoid hard API throttling.
      const hydrateLimit = 2;
      for (const item of playersToHydrate.slice(0, hydrateLimit)) {
        const matches = await henrikService.getMatchHistoryByPuuid(item.puuid, region, 'competitive', 20);
        const kd = computeSeasonKdFromHenrikMatches(matches, item.puuid, seasonTokens);
        if (kd !== null && kd !== undefined) {
          seasonKdByPuuid[item.puuid] = kd;
          cacheService.set(item.cacheKey, kd, seasonKdCacheTtlMs);
        }
      }
      const firstKillsByPuuid = {};
      const firstDeathsByPuuid = {};
      const rounds = Array.isArray(liveMatch?.rounds) ? liveMatch.rounds : [];
      const kills = Array.isArray(liveMatch?.kills) ? liveMatch.kills : [];
      const killsByRound = new Map();
      const attackingTeamByRound = new Map();
      const splitByPuuid = {};

      for (const p of allPlayers) {
        const puuid = p?.puuid || p?.subject || null;
        if (!puuid) continue;
        splitByPuuid[puuid] = {
          attackKills: 0,
          attackDeaths: 0,
          defenseKills: 0,
          defenseDeaths: 0
        };
      }

      for (const round of rounds) {
        const r = toNumber(round?.id, 0);
        if (!r) continue;
        const plantTeam = normalizeTeamId(round?.plant?.player?.team);
        const defuseTeam = normalizeTeamId(round?.defuse?.player?.team);
        const attacker = plantTeam
          || (defuseTeam ? (defuseTeam === 'Red' ? 'Blue' : 'Red') : null)
          || defaultAttackingTeamForRound(r);
        attackingTeamByRound.set(r, attacker);
      }

      for (const event of kills) {
        const roundRaw = event?.round;
        const roundNumber = Number(roundRaw);
        if (!Number.isFinite(roundNumber)) continue;
        if (!killsByRound.has(roundNumber)) killsByRound.set(roundNumber, []);
        killsByRound.get(roundNumber).push(event);
      }

      for (const [, roundKills] of killsByRound.entries()) {
        if (!Array.isArray(roundKills) || roundKills.length === 0) continue;
        roundKills.sort(
          (a, b) =>
            toNumber(a?.time_in_round_in_ms, Number.MAX_SAFE_INTEGER)
            - toNumber(b?.time_in_round_in_ms, Number.MAX_SAFE_INTEGER)
        );
        const firstEvent = roundKills[0];
        const killerPuuid = firstEvent?.killer?.puuid || null;
        const victimPuuid = firstEvent?.victim?.puuid || null;
        if (killerPuuid) firstKillsByPuuid[killerPuuid] = (firstKillsByPuuid[killerPuuid] || 0) + 1;
        if (victimPuuid) firstDeathsByPuuid[victimPuuid] = (firstDeathsByPuuid[victimPuuid] || 0) + 1;
      }

      for (const event of kills) {
        const r = toNumber(event?.round, 0);
        if (!r) continue;
        const attacker = attackingTeamByRound.get(r) || defaultAttackingTeamForRound(r);
        const killerPuuid = event?.killer?.puuid || null;
        const victimPuuid = event?.victim?.puuid || null;
        const killerTeam = normalizeTeamId(event?.killer?.team);
        const victimTeam = normalizeTeamId(event?.victim?.team);

        if (killerPuuid && splitByPuuid[killerPuuid]) {
          const side = sideForTeamAtRound(killerTeam, r, attacker);
          if (side === 'attack') splitByPuuid[killerPuuid].attackKills += 1;
          else splitByPuuid[killerPuuid].defenseKills += 1;
        }

        if (victimPuuid && splitByPuuid[victimPuuid]) {
          const side = sideForTeamAtRound(victimTeam, r, attacker);
          if (side === 'attack') splitByPuuid[victimPuuid].attackDeaths += 1;
          else splitByPuuid[victimPuuid].defenseDeaths += 1;
        }
      }

      const utilByPuuid = {};
      for (const player of allPlayers) {
        const puuid = player?.puuid || player?.subject || null;
        if (!puuid) continue;
        const casts = player?.ability_casts || {};
        utilByPuuid[puuid] = {
          c: toNumber(casts.grenade, 0),
          q: toNumber(casts.ability_1, 0),
          e: toNumber(casts.ability_2, 0),
          x: toNumber(casts.ultimate, 0)
        };
      }

      // Fallback util derivation by summing round stats when top-level casts are absent.
      if (Object.keys(utilByPuuid).length === 0 && rounds.length > 0) {
        for (const round of rounds) {
          const roundStats = Array.isArray(round?.stats) ? round.stats : [];
          for (const row of roundStats) {
            const puuid = row?.player?.puuid || null;
            if (!puuid) continue;
            if (!utilByPuuid[puuid]) {
              utilByPuuid[puuid] = { c: 0, q: 0, e: 0, x: 0 };
            }
            const casts = row?.ability_casts || {};
            utilByPuuid[puuid].c += toNumber(casts.grenade, 0);
            utilByPuuid[puuid].q += toNumber(casts.ability_1, 0);
            utilByPuuid[puuid].e += toNumber(casts.ability_2, 0);
            utilByPuuid[puuid].x += toNumber(casts.ultimate, 0);
          }
        }
      }

      const startedAtMs = metadata?.started_at ? Date.parse(metadata.started_at) : null;
      const elapsedByStart = Number.isFinite(startedAtMs) ? Math.max(0, Date.now() - startedAtMs) : null;
      const elapsedByApi = toNullableNumber(metadata?.game_length_in_ms);
      const matchDurationMs = elapsedByStart ?? elapsedByApi ?? 0;
      const roundFromTeams = Array.isArray(liveMatch?.teams)
        ? liveMatch.teams.reduce((sum, team) => {
            const won = toNumber(team?.rounds?.won, 0);
            const lost = toNumber(team?.rounds?.lost, 0);
            return Math.max(sum, won + lost);
          }, 0)
        : 0;
      const roundNumber = Math.max(roundFromTeams, rounds.length);

      const players = allPlayers.map((player) => {
        const stats = player?.stats || {};
        const headshots = toNumber(stats.headshots, 0);
        const bodyshots = toNumber(stats.bodyshots, 0);
        const legshots = toNumber(stats.legshots, 0);
        const totalShots = headshots + bodyshots + legshots;
        const hsPct = totalShots > 0 ? Number(((headshots / totalShots) * 100).toFixed(1)) : null;

        const puuid = player?.puuid || player?.subject || null;
        const teamRaw = String(player?.team || player?.team_id || player?.teamId || 'Blue').toLowerCase();
        const teamId = teamRaw === 'red' ? 'Red' : 'Blue';
        const characterName = safeString(
          player?.character
          || player?.character_name
          || player?.characterName
          || player?.agent
          || player?.agent_name
          || player?.agentName,
          'Unknown Agent'
        );
        const gameName = safeString(player?.name || player?.game_name || player?.gameName, 'Unknown');
        const tagLine = safeString(player?.tag || player?.tag_line || player?.tagLine, '');
        const util = utilByPuuid[puuid] || { c: 0, q: 0, e: 0, x: 0 };
        const yoink = yoinkStatsByPuuid[puuid] || null;
        const seasonKd = toNullableNumber(seasonKdByPuuid[puuid] ?? yoink?.kd);
        const split = splitByPuuid[puuid] || {
          attackKills: 0,
          attackDeaths: 0,
          defenseKills: 0,
          defenseDeaths: 0
        };
        const attackKd = split.attackDeaths > 0
          ? Number((split.attackKills / split.attackDeaths).toFixed(2))
          : Number(split.attackKills.toFixed(2));
        const defenseKd = split.defenseDeaths > 0
          ? Number((split.defenseKills / split.defenseDeaths).toFixed(2))
          : Number(split.defenseKills.toFixed(2));
        const currentSide = sideForTeamAtRound(teamId, roundNumber, attackingTeamByRound.get(roundNumber));
        const sideKdCurrent = currentSide === 'attack' ? attackKd : defenseKd;
        const totalKills = toNumber(stats.kills, 0);
        const totalDeaths = toNumber(stats.deaths, 0);
        const kd = totalDeaths > 0
          ? Number((totalKills / totalDeaths).toFixed(2))
          : Number(totalKills.toFixed(2));

        return {
          puuid,
          name: tagLine ? `${gameName}#${tagLine}` : gameName,
          gameName,
          tagLine,
          teamId,
          characterId: null,
          agentName: characterName || 'Unknown Agent',
          accountLevel: toNullableNumber(
            player?.account_level ?? player?.accountLevel ?? player?.level
          ),
          seasonKd,
          weaponSkin: null,
          utility: util,
          stats: {
            kills: totalKills,
            deaths: totalDeaths,
            assists: toNumber(stats.assists, 0),
            kd,
            sideKdCurrent,
            currentSide,
            attackKd,
            defenseKd,
            attackKills: split.attackKills,
            attackDeaths: split.attackDeaths,
            defenseKills: split.defenseKills,
            defenseDeaths: split.defenseDeaths,
            score: toNumber(stats.score, 0),
            firstKills: firstKillsByPuuid[puuid] || 0,
            firstDeaths: firstDeathsByPuuid[puuid] || 0,
            multi2: toNumber(stats.double_kills, 0),
            multi3: toNumber(stats.triple_kills, 0),
            multi4: toNumber(stats.quadra_kills, 0),
            multi5: toNumber(stats.penta_kills, 0),
            kpr: null,
            kast: null,
            esr: null,
            srv: null,
            hs: hsPct,
            clutches: null
          },
          rawStats: {
            ...stats
          }
        };
      });

      return res.json({
        inGame: true,
        matchId,
        map: parseHenrikMap(metadata?.map ?? liveMatch?.map),
        mode: parseHenrikMode(metadata?.mode ?? liveMatch?.mode),
        round: roundNumber,
        matchDurationMs,
        players,
        source: 'henrik',
        timestamp: Date.now()
      });
    }

    const liveSource = matchInfo.source || 'auto';
    const scoreboard = await valorantService.getMatchScoreboard(matchId, liveSource);
    const loadouts = await valorantService.getMatchLoadouts(matchId, liveSource);
    const enrichedLoadoutPlayers = await valorantService.enrichLoadoutsWithSkinData(
      loadouts,
      matchData.Players || []
    );

    const normalizeStats = (stats) => {
      if (!stats) return {};
      if (Array.isArray(stats)) {
        const mapped = {};
        for (const stat of stats) {
          const key = stat.statType || stat.StatType;
          const value = stat.value ?? stat.Value ?? stat.valueFloat ?? stat.ValueFloat;
          if (key) mapped[key] = value;
        }
        return mapped;
      }
      return stats;
    };

    const getStat = (stats, keys, fallback = 0) => {
      for (const key of keys) {
        if (stats[key] !== undefined && stats[key] !== null) return stats[key];
      }
      return fallback;
    };

    const toPrimitiveRawStats = (stats) => {
      const out = {};
      for (const [key, value] of Object.entries(stats || {})) {
        if (value === null || value === undefined) continue;
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          out[key] = value;
        }
      }
      return out;
    };

    const scoreboardPlayers = scoreboard.Players || [];
    const puuids = scoreboardPlayers.map((p) => p.Subject);
    const user = await valorantService.getCurrentUser();
    let playerNames = await valorantService.resolvePuuidsToNames(puuids);
    if (Object.keys(playerNames).length === 0) {
      playerNames = await henrikService.resolvePuuids(puuids, user.region || 'na');
    }
    const yoinkStatsByPuuid = await valorantService.getYoinkStatsForPlayers(puuids);
    const loadoutByPuuid = {};
    for (const p of enrichedLoadoutPlayers) {
      loadoutByPuuid[p.Subject] = p.loadout || null;
    }

    const players = scoreboardPlayers.map((player) => {
      const stats = normalizeStats(player.Stats);
      const nameData = playerNames[player.Subject];
      const yoink = yoinkStatsByPuuid[player.Subject] || null;
      const playerLoadout = loadoutByPuuid[player.Subject] || null;
      const chosenWeaponSkin = playerLoadout?.weapons?.[weaponName] || null;
      const deltaRr = yoink?.deltaRr;
      const afkPenalty = yoink?.afkPenalty;

      return {
        puuid: player.Subject,
        name: nameData ? `${nameData.name}#${nameData.tag}` : 'Unknown Player',
        gameName: nameData?.name || 'Unknown',
        tagLine: nameData?.tag || '',
        teamId: player.TeamID,
        characterId: player.CharacterID,
        agentName: getAgentName(player.CharacterID),
        accountLevel: player.PlayerIdentity?.AccountLevel ?? null,
        weaponSkin: chosenWeaponSkin ? {
          weapon: weaponName,
          skinName: chosenWeaponSkin.skinName || 'Unknown Skin',
          rarity: chosenWeaponSkin.rarity || null
        } : null,
        yoinkStats: yoink ? {
          rankTier: yoink.rankTier,
          rankName: yoink.rankName,
          rr: yoink.rr,
          leaderboard: yoink.leaderboard,
          peakRankTier: yoink.peakRankTier,
          peakRankName: yoink.peakRankName,
          winRate: yoink.winRate,
          games: yoink.games,
          hsPct: yoink.hsPct,
          kd: yoink.kd,
          deltaRr,
          afkPenalty,
          rrHistory: Array.isArray(yoink.rrHistory) ? yoink.rrHistory : [],
          peakSeasonId: yoink.peakSeasonId || null,
          peakActEpisode: yoink.peakActEpisode || null,
          deltaRrLabel: deltaRr === null || deltaRr === undefined
            ? 'N/A'
            : `${deltaRr >= 0 ? '+' : ''}${deltaRr} (${afkPenalty ?? 0})`
        } : null,
        stats: {
          kills: getStat(stats, ['Kills', 'Kill', 'kills'], 0),
          deaths: getStat(stats, ['Deaths', 'Death', 'deaths'], 0),
          assists: getStat(stats, ['Assists', 'Assist', 'assists'], 0),
          score: getStat(stats, ['Score', 'score'], 0),
          firstKills: getStat(stats, ['FirstKills', 'FirstBloods', 'FirstBloodKills', 'FirstBloodsCount'], 0),
          firstDeaths: getStat(stats, ['FirstDeaths', 'FirstBloodDeaths', 'FirstDeath', 'FirstDeathsCount'], 0),
          multi2: getStat(stats, ['DoubleKills', 'MultiKills2', 'TwoKills', 'TwoKill'], 0),
          multi3: getStat(stats, ['TripleKills', 'MultiKills3', 'ThreeKills', 'ThreeKill'], 0),
          multi4: getStat(stats, ['QuadraKills', 'MultiKills4', 'FourKills', 'FourKill'], 0),
          multi5: getStat(stats, ['PentaKills', 'MultiKills5', 'FiveKills', 'FiveKill'], 0),
          kpr: getStat(stats, ['KPR', 'KillsPerRound'], null),
          kast: getStat(stats, ['KAST', 'KASTPercent'], null),
          esr: getStat(stats, ['ESR', 'EntrySuccessRate'], null),
          srv: getStat(stats, ['SRV', 'SurvivalRate'], null),
          hs: getStat(stats, ['HS', 'HeadshotPct', 'HeadshotPercentage'], null),
          clutches: getStat(stats, ['Clutches', 'ClutchKills', 'Clutch'], null)
        },
        rawStats: toPrimitiveRawStats(stats)
      };
    });

    res.json({
      inGame: true,
      matchId,
      map: matchData.MapID,
      mode: matchData.ModeID,
      players,
      source: liveSource,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error in /api/match/scoreboard/current:', error);
    res.status(500).json({
      error: 'Failed to fetch scoreboard data',
      message: error.message
    });
  }
});

module.exports = router;
