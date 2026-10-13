const express = require('express');
const router = express.Router();
const axios = require('axios');
const valorantService = require('../services/valorant');
const henrikService = require('../services/henrik');
const cacheService = require('../services/cache');
const runtimeStateService = require('../services/runtimeState');
const { resolvePlayerNames, namesFromYoinkStats, combineLookups } = require('../services/playerNames');
const { applyActPerformance } = require('../services/playerStats');
const { encounterSummaries } = require('../services/encounterHistory');
const { extractMatchScore } = require('../services/matchScore');

const withLiveScore = (matchResponse) => {
  const score = extractMatchScore(runtimeStateService.getSnapshot().privatePresence);
  return score ? { ...matchResponse, score, round: score.round } : matchResponse;
};

const loadPlayerStats = async (puuids) => {
  const yoinkStatsByPuuid = await valorantService.getYoinkStatsForPlayers(puuids);
  try {
    const [user, content] = await Promise.all([
      valorantService.getCurrentUser().catch(() => null),
      valorantService.getContentServiceData()
    ]);
    const seasonId = valorantService.getActiveActSeasonId(content);
    const actByPuuid = henrikService.getCachedActPerformanceAndQueueMissing(puuids, user?.region || 'na', seasonId);
    return applyActPerformance(yoinkStatsByPuuid, actByPuuid);
  } catch (error) {
    console.warn('Whole-act stats unavailable:', error.message);
    return applyActPerformance(yoinkStatsByPuuid, {});
  }
};

const lookupPlayerNames = async (puuids, yoinkStatsByPuuid = {}) => {
  const user = await valorantService.getCurrentUser().catch(() => null);
  return resolvePlayerNames({
    puuids,
    riotLookup: (ids) => valorantService.resolvePuuidsToNames(ids),
    fallbackLookup: combineLookups([
      async () => namesFromYoinkStats(yoinkStatsByPuuid),
      (ids) => henrikService.getCachedNamesAndQueueMissing(ids, user?.region || 'na')
    ])
  });
};

const toNameFields = (nameData) => ({
  name: nameData?.name ? `${nameData.name}#${nameData.tag}` : 'Hidden player',
  gameName: nameData?.name || null,
  tagLine: nameData?.tag || '',
  nameHidden: Boolean(nameData?.hidden)
});

const agentNameByUuid = {
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
  '22697a3d-45bf-8dd7-4fec-84a9e28c69d7': 'Chamber',
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
  '0e38b510-41a8-5780-5e8f-568b2a4f2d6c': 'Iso',
  'b444168c-4e35-8076-db47-ef9bf368f384': 'Tejo',
  'efba5359-4016-a1e5-7626-b1ae76895940': 'Vyse',
  'df1cb487-4902-002e-5c17-d28e83e78588': 'Waylay',
  '7c8a4701-4de6-9355-b254-e09bc2a34b72': 'Miks',
  '92eeef5d-43b5-1d4a-8d03-b3927a09034b': 'Veto',
  '1dbf2edd-4729-0984-3115-daa5eed44993': 'Clove'
};

let agentMapLastHydratedAt = 0;
const agentMapHydrateTtlMs = 6 * 60 * 60 * 1000;

const hydrateAgentNameMap = async () => {
  const now = Date.now();
  if (now - agentMapLastHydratedAt < agentMapHydrateTtlMs) return;

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
        agentNameByUuid[uuid] = name;
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
  return agentNameByUuid[String(characterId).toLowerCase()] || 'Unknown Agent';
};

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
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

/**
 * GET /api/match/status
 * Check if VALORANT is running
 */
router.get('/status', (req, res) => {
  const runtime = runtimeStateService.getSnapshot();
  res.json({ 
    // A Riot lockfile only proves Riot Client is open. The VALORANT-specific
    // presence disappears on game exit and is recreated on every launch.
    valorantRunning: runtime.connected,
    runtime: {
      initialized: runtime.initialized,
      connected: runtime.connected,
      sessionLoopState: runtime.sessionLoopState,
      updatedAt: runtime.updatedAt
    },
    timestamp: Date.now()
  });
});

router.get('/queue/modes', async (req, res) => {
  try {
    const cacheKey = 'localQueueModes';
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
    const runtime = runtimeStateService.getSnapshot();
    if (runtime.connected && runtime.sessionLoopState === 'MENUS') {
      return res.json({
        inPregame: false,
        state: 'MENUS',
        message: 'Not in pregame currently'
      });
    }

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
    const yoinkStatsByPuuid = await loadPlayerStats(puuids);
    const names = await lookupPlayerNames(puuids, yoinkStatsByPuuid);
    const encountersByPuuid = await encounterSummaries(puuids);

    const normalizePregamePlayer = (player, defaultTeamId = null) => {
      const teamId = player?.TeamID || defaultTeamId || null;
      const nameData = names[player.Subject] || null;

      return {
        puuid: player.Subject,
        ...toNameFields(nameData),
        encounters: encountersByPuuid[player.Subject] || null,
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
    cacheService.delete('localQueueModes');

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
    const runtime = runtimeStateService.getSnapshot();
    if (runtime.connected && runtime.sessionLoopState === 'MENUS') {
      return res.json({
        inGame: false,
        state: 'MENUS',
        message: 'Not in a match currently'
      });
    }
    if (runtime.connected && runtime.sessionLoopState === 'PREGAME') {
      return res.json({
        inGame: false,
        state: 'PREGAME',
        message: 'Pregame active'
      });
    }

    // Check cache first (short TTL since match data changes)
    const cacheKey = 'currentMatch';
    const cached = cacheService.get(cacheKey);
    
    if (cached) {
      return res.json(withLiveScore({ ...cached, cached: true }));
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
    const yoinkStatsByPuuid = await loadPlayerStats(puuids);
    const playerNames = await lookupPlayerNames(puuids, yoinkStatsByPuuid);
    const encountersByPuuid = await encounterSummaries(puuids);

    // Combine all data
    const finalPlayers = enrichedPlayers.map(player => {
      const nameData = playerNames[player.Subject];
      
      return {
        puuid: player.Subject,
        ...toNameFields(nameData),
        encounters: encountersByPuuid[player.Subject] || null,
        teamId: player.TeamID,
        characterId: player.CharacterID,
        agentName: getAgentName(player.CharacterID),
        playerIdentity: player.PlayerIdentity,
        accountLevel: player.PlayerIdentity?.AccountLevel ?? null,
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
      queueId: matchData?.MatchmakingData?.QueueID || null,
      round,
      userTeam: userTeam, // Which team the user is on
      players: finalPlayers,
      timestamp: Date.now()
    };

    // Cache for 10 seconds (match data updates frequently)
    cacheService.set(cacheKey, response, 10 * 1000);
    console.log(`Current match response ok: source=${source} players=${finalPlayers.length} map=${matchData.MapID}`);

    res.json(withLiveScore(response));
  } catch (error) {
    console.error('Error in /api/match/current:', error);
    res.status(500).json({ 
      error: 'Failed to fetch current match data',
      message: error.message 
    });
  }
});

module.exports = router;
