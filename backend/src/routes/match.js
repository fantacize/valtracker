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
        yoinkStats: yoinkStatsByPuuid[player.Subject] || null,
        loadout: player.loadout
      };
    });

    // Find current user's team
    const currentUserPuuid = user.puuid;
    const currentUserPlayer = finalPlayers.find(p => p.puuid === currentUserPuuid);
    const userTeam = currentUserPlayer ? currentUserPlayer.teamId : null;

    const response = {
      inGame: true,
      matchId,
      map: matchData.MapID,
      mode: matchData.ModeID,
      userTeam: userTeam, // Which team the user is on
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
    const matchInfo = await valorantService.getCurrentMatch();

    if (!matchInfo || !matchInfo.inGame) {
      return res.json({
        inGame: false,
        state: matchInfo?.state || 'UNKNOWN',
        message: 'Not in a match currently'
      });
    }

    const { matchId, matchData, source = 'auto' } = matchInfo;
    const scoreboard = await valorantService.getMatchScoreboard(matchId, source);
    const loadouts = await valorantService.getMatchLoadouts(matchId, source);
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
    const puuids = scoreboardPlayers.map(p => p.Subject);
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
