const https = require('https');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const lockfileService = require('./lockfile');

const DEFAULT_SKINS_CSV_PATH = path.resolve(__dirname, '..', '..', '..', 'valorant_skins_by_weapon.csv');
const SKINS_CSV_PATH = process.env.SKINS_CSV_PATH || DEFAULT_SKINS_CSV_PATH;
let skinsCsvCache = null;
const RANK_NAMES_BY_TIER = [
  'Unranked', 'Unranked', 'Unranked', 'Iron 1', 'Iron 2', 'Iron 3',
  'Bronze 1', 'Bronze 2', 'Bronze 3', 'Silver 1', 'Silver 2', 'Silver 3',
  'Gold 1', 'Gold 2', 'Gold 3', 'Platinum 1', 'Platinum 2', 'Platinum 3',
  'Diamond 1', 'Diamond 2', 'Diamond 3', 'Ascendant 1', 'Ascendant 2', 'Ascendant 3',
  'Immortal 1', 'Immortal 2', 'Immortal 3', 'Radiant'
];
const BEFORE_ASCENDANT_SEASONS = new Set([
  '0df5adb9-4dcb-6899-1306-3e9860661dd3',
  '3f61c772-4560-cd3f-5d3f-a7ab5abda6b3',
  '0530b9c4-4980-f2ee-df5d-09864cd00542',
  '46ea6166-4573-1128-9cea-60a15640059b',
  'fcf2c8f4-4324-e50b-2e23-718e4a3ab046',
  '97b6e739-44cc-ffa7-49ad-398ba502ceb0',
  'ab57ef51-4e59-da91-cc8d-51a5a2b9b8ff',
  '52e9749a-429b-7060-99fe-4595426a0cf7',
  '71c81c67-4fae-ceb1-844c-aab2bb8710fa',
  '2a27e5d2-4d30-c9e2-b15a-93b8909a442c',
  '4cb622e1-4244-6da3-7276-8daaf1c01be2',
  'a16955a5-4ad0-f761-5e9e-389df1c892fb',
  '97b39124-46ce-8b55-8fd1-7cbf7ffe173f',
  '573f53ac-41a5-3a7d-d9ce-d6a6298e5704',
  'd929bc38-4ab6-7da4-94f0-ee84f8ac141e',
  '3e47230a-463c-a301-eb7d-67bb60357d4f',
  '808202d6-4f2b-a8ff-1feb-b3a0590ad79f'
]);

const loadSkinsCsvFallback = () => {
  if (skinsCsvCache !== null) return skinsCsvCache;
  try {
    if (!fs.existsSync(SKINS_CSV_PATH)) {
      skinsCsvCache = null;
      return null;
    }

    const raw = fs.readFileSync(SKINS_CSV_PATH, 'utf8');
    const lines = raw.split(/\r?\n/).filter(Boolean);
    if (lines.length <= 1) {
      skinsCsvCache = null;
      return null;
    }

    const header = lines[0].replace(/^\uFEFF/, '').split(',');
    const weaponIdx = header.indexOf('weapon');
    const weaponUuidIdx = header.indexOf('weapon_uuid');
    const skinIdx = header.indexOf('skin');
    const skinUuidIdx = header.indexOf('skin_uuid');
    const tierIdx = header.indexOf('content_tier_uuid');

    const weaponMap = {};
    const skinMap = {};

    for (let i = 1; i < lines.length; i += 1) {
      const row = lines[i].split(',');
      if (row.length < 6) continue;
      const weaponName = row[weaponIdx] || '';
      const weaponUuid = row[weaponUuidIdx] || '';
      const skinName = row[skinIdx] || '';
      const skinUuid = row[skinUuidIdx] || '';
      const tierUuid = row[tierIdx] || '';

      if (weaponUuid) {
        weaponMap[weaponUuid.toLowerCase()] = weaponName;
      }
      if (skinUuid) {
        skinMap[skinUuid.toLowerCase()] = {
          skinName,
          weaponName,
          contentTierUuid: tierUuid || null
        };
      }
    }

    skinsCsvCache = { weaponMap, skinMap };
    return skinsCsvCache;
  } catch (error) {
    console.error('Error loading skins CSV fallback:', error.message);
    skinsCsvCache = null;
    return null;
  }
};

/**
 * VALORANT Local API Service
 * Interacts with the local VALORANT client API
 */
class ValorantService {
  constructor() {
    // Disable SSL verification for local API
    this.httpsAgent = new https.Agent({
      rejectUnauthorized: false
    });

    this.currentPuuid = null;
    this.region = null;
    this.routingCache = null;
    this.routingCacheTs = 0;
    this.contentCache = null;
    this.contentCacheTs = 0;
    this.yoinkStatsCache = new Map();
    this.yoinkStatsInflight = new Map();
  }

  resetSessionCache() {
    this.currentPuuid = null;
    this.region = null;
  }

  /**
   * Make a request to the local VALORANT API
   */
  async makeLocalRequest(endpoint) {
    const requestOnce = async () => {
      const baseUrl = lockfileService.getBaseUrl();
      const headers = lockfileService.getAuthHeader();

      if (!baseUrl || !headers) {
        throw new Error('VALORANT is not running or lockfile cannot be read');
      }

      const response = await axios.get(`${baseUrl}${endpoint}`, {
        headers,
        httpsAgent: this.httpsAgent,
        timeout: 5000
      });

      return response.data;
    };

    try {
      return await requestOnce();
    } catch (error) {
      const shouldRetry =
        error.response?.status === 401 ||
        error.response?.status === 403 ||
        error.code === 'ECONNREFUSED' ||
        error.code === 'ECONNRESET';

      if (shouldRetry) {
        lockfileService.refreshCredentials();
        this.resetSessionCache();
        return requestOnce();
      }

      console.error(`Error making local request to ${endpoint}:`, error.message);
      throw error;
    }
  }

  /**
   * Make a POST request to the local VALORANT API
   */
  async makeLocalPost(endpoint, body = {}) {
    const requestOnce = async () => {
      const baseUrl = lockfileService.getBaseUrl();
      const headers = lockfileService.getAuthHeader();

      if (!baseUrl || !headers) {
        throw new Error('VALORANT is not running or lockfile cannot be read');
      }

      const response = await axios.post(`${baseUrl}${endpoint}`, body, {
        headers,
        httpsAgent: this.httpsAgent,
        timeout: 5000
      });

      return response.data;
    };

    try {
      return await requestOnce();
    } catch (error) {
      const shouldRetry =
        error.response?.status === 401 ||
        error.response?.status === 403 ||
        error.code === 'ECONNREFUSED' ||
        error.code === 'ECONNRESET';

      if (shouldRetry) {
        lockfileService.refreshCredentials();
        this.resetSessionCache();
        return requestOnce();
      }

      console.error(`Error making local POST request to ${endpoint}:`, error.message);
      throw error;
    }
  }

  getShooterLogPath() {
    const localAppData = process.env.LOCALAPPDATA
      || `C:\\Users\\${process.env.USERNAME}\\AppData\\Local`;
    return path.join(localAppData, 'VALORANT', 'Saved', 'Logs', 'ShooterGame.log');
  }

  readShooterLog() {
    const logPath = this.getShooterLogPath();
    if (!fs.existsSync(logPath)) return null;
    return fs.readFileSync(logPath, 'utf8');
  }

  getRoutingFromLogs() {
    const now = Date.now();
    if (this.routingCache && now - this.routingCacheTs < 60 * 1000) {
      return this.routingCache;
    }

    const rawLog = this.readShooterLog();
    if (!rawLog) return null;

    const glzMatches = [...rawLog.matchAll(/https:\/\/glz-([a-z0-9-]+)\.([a-z0-9-]+)\.a\.pvp\.net/gi)];
    const pdMatches = [...rawLog.matchAll(/([a-z0-9-]+)\.a\.pvp\.net\/account-xp\/v1\//gi)];

    if (glzMatches.length === 0) return null;

    const glzLast = glzMatches[glzMatches.length - 1];
    const pdLast = pdMatches.length > 0 ? pdMatches[pdMatches.length - 1] : null;

    const routing = {
      pdRegion: (pdLast?.[1] || 'na').toLowerCase(),
      glzRegion: (glzLast?.[1] || '').toLowerCase(),
      glzShard: (glzLast?.[2] || '').toLowerCase()
    };

    if (routing.pdRegion === 'pbe') {
      routing.pdRegion = 'na';
    }

    if (!routing.glzRegion || !routing.glzShard) {
      return null;
    }

    this.routingCache = routing;
    this.routingCacheTs = now;
    return routing;
  }

  getClientVersionFromLogs() {
    const rawLog = this.readShooterLog();
    if (!rawLog) return null;

    const versionMatches = [...rawLog.matchAll(/CI server version:\s*([^\r\n]+)/gi)];
    if (versionMatches.length === 0) return null;

    const rawVersion = (versionMatches[versionMatches.length - 1]?.[1] || '').trim();
    if (!rawVersion) return null;

    const parts = rawVersion.split('-');
    if (parts.length >= 3 && parts[2] !== 'shipping') {
      parts.splice(2, 0, 'shipping');
    }
    return parts.join('-');
  }

  async getRiotTokens() {
    let last = null;
    for (let i = 0; i < 5; i += 1) {
      const entitlements = await this.makeLocalRequest('/entitlements/v1/token');
      last = entitlements;

      const accessToken = entitlements?.accessToken || null;
      const entitlementsToken = entitlements?.token || null;
      const puuid = entitlements?.subject || null;

      if (accessToken && entitlementsToken && puuid) {
        return { puuid, accessToken, entitlementsToken };
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return {
      puuid: last?.subject || null,
      accessToken: last?.accessToken || null,
      entitlementsToken: last?.token || null
    };
  }

  async makeGlzRequest(endpoint) {
    const routing = this.getRoutingFromLogs();
    if (!routing) {
      throw new Error('Could not determine GLZ routing from ShooterGame.log');
    }

    const tokens = await this.getRiotTokens();
    if (!tokens.accessToken || !tokens.entitlementsToken) {
      throw new Error('Could not get Riot tokens from local client');
    }

    const clientVersion = this.getClientVersionFromLogs();
    const headers = {
      'Authorization': `Bearer ${tokens.accessToken}`,
      'X-Riot-Entitlements-JWT': tokens.entitlementsToken,
      'X-Riot-ClientPlatform': 'ew0KCSJwbGF0Zm9ybVR5cGUiOiAiUEMiLA0KCSJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLA0KCSJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwNCgkicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iDQp9'
    };

    if (clientVersion) {
      headers['X-Riot-ClientVersion'] = clientVersion;
    }

    const baseUrl = `https://glz-${routing.glzRegion}.${routing.glzShard}.a.pvp.net`;
    const response = await axios.get(`${baseUrl}${endpoint}`, {
      headers,
      httpsAgent: this.httpsAgent,
      timeout: 5000
    });
    return response.data;
  }

  async makePdRequest(endpoint, method = 'get', body = null) {
    const routing = this.getRoutingFromLogs();
    if (!routing) {
      throw new Error('Could not determine PD routing from ShooterGame.log');
    }

    const tokens = await this.getRiotTokens();
    if (!tokens.accessToken || !tokens.entitlementsToken) {
      throw new Error('Could not get Riot tokens from local client');
    }

    const clientVersion = this.getClientVersionFromLogs();
    const headers = {
      'Authorization': `Bearer ${tokens.accessToken}`,
      'X-Riot-Entitlements-JWT': tokens.entitlementsToken,
      'X-Riot-ClientPlatform': 'ew0KCSJwbGF0Zm9ybVR5cGUiOiAiUEMiLA0KCSJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLA0KCSJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwNCgkicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iDQp9'
    };

    if (clientVersion) {
      headers['X-Riot-ClientVersion'] = clientVersion;
    }

    const baseUrl = `https://pd.${routing.pdRegion}.a.pvp.net`;
    headers['User-Agent'] = 'ShooterGame/13 Windows/10.0.19043.1.256.64bit';

    const requestOnce = async () => {
      const response = await axios({
        method,
        url: `${baseUrl}${endpoint}`,
        data: body,
        headers,
        httpsAgent: this.httpsAgent,
        timeout: 15000
      });
      return response.data;
    };

    try {
      return await requestOnce();
    } catch (error) {
      const code = error?.response?.status;
      const transient = code === 429 || code >= 500 || error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';
      if (transient) {
        await new Promise((resolve) => setTimeout(resolve, 800));
        return requestOnce();
      }
      throw error;
    }
  }

  async resolvePuuidsToNames(puuids) {
    if (!Array.isArray(puuids) || puuids.length === 0) {
      return {};
    }

    try {
      const data = await this.makePdRequest('/name-service/v2/players', 'put', puuids);
      const result = {};
      for (const player of data || []) {
        const subject = player?.Subject || player?.subject;
        if (!subject) continue;
        result[subject] = {
          name: player?.GameName || player?.gameName || 'Unknown',
          tag: player?.TagLine || player?.tagLine || ''
        };
      }
      return result;
    } catch (error) {
      console.warn('Riot name-service lookup failed:', error.message);
      return {};
    }
  }

  async makeSharedRequest(endpoint) {
    const routing = this.getRoutingFromLogs();
    if (!routing) {
      throw new Error('Could not determine shared routing from ShooterGame.log');
    }

    const tokens = await this.getRiotTokens();
    if (!tokens.accessToken || !tokens.entitlementsToken) {
      throw new Error('Could not get Riot tokens from local client');
    }

    const clientVersion = this.getClientVersionFromLogs();
    const headers = {
      'Authorization': `Bearer ${tokens.accessToken}`,
      'X-Riot-Entitlements-JWT': tokens.entitlementsToken,
      'X-Riot-ClientPlatform': 'ew0KCSJwbGF0Zm9ybVR5cGUiOiAiUEMiLA0KCSJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLA0KCSJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwNCgkicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iDQp9'
    };

    if (clientVersion) {
      headers['X-Riot-ClientVersion'] = clientVersion;
    }

    const baseUrl = `https://shared.${routing.pdRegion}.a.pvp.net`;
    const response = await axios.get(`${baseUrl}${endpoint}`, {
      headers,
      httpsAgent: this.httpsAgent,
      timeout: 5000
    });
    return response.data;
  }

  async getContentServiceData() {
    const now = Date.now();
    if (this.contentCache && now - this.contentCacheTs < 10 * 60 * 1000) {
      return this.contentCache;
    }

    const content = await this.makeSharedRequest('/content-service/v3/content');
    this.contentCache = content;
    this.contentCacheTs = now;
    return content;
  }

  getActiveActSeasonId(content) {
    const seasons = content?.Seasons || [];
    const activeAct = seasons.find((s) => s.IsActive && s.Type === 'act');
    return activeAct?.ID || null;
  }

  getActEpisodeMeta(content, actId) {
    if (!content || !actId) return null;
    const seasons = content?.Seasons || [];
    const act = seasons.find((s) => String(s?.ID || '').toLowerCase() === String(actId).toLowerCase());
    if (!act) return null;
    let episode = seasons.find((s) => String(s?.ID || '').toLowerCase() === String(act.ParentID || '').toLowerCase());

    const romanToInt = (romanRaw) => {
      const roman = String(romanRaw || '').toUpperCase();
      if (!roman) return null;
      const values = { I: 1, V: 5, X: 10, L: 50, C: 100 };
      let total = 0;
      let prev = 0;
      for (let i = roman.length - 1; i >= 0; i -= 1) {
        const value = values[roman[i]];
        if (!value) return null;
        if (value < prev) total -= value;
        else total += value;
        prev = value;
      }
      return total;
    };

    const parseSeasonNumber = (nameRaw) => {
      const name = String(nameRaw || '').trim();
      if (!name) return null;

      const parts = name.split(/\s+/);
      if (parts.length === 0) return null;
      const tail = parts[parts.length - 1];

      // Newer season naming can include alphanumeric identifiers (e.g. v26).
      if (/[a-z]/i.test(tail) && /\d/.test(tail)) {
        return tail.toLowerCase();
      }

      const numeric = Number(tail);
      if (Number.isFinite(numeric)) return numeric;

      return romanToInt(tail);
    };

    // Yoink fallback logic: derive episode by season ordering when ParentID isn't reliable.
    if (!episode) {
      let lastEpisode = null;
      let actFound = false;
      for (const season of seasons) {
        const seasonId = String(season?.ID || '').toLowerCase();
        if (seasonId === String(actId).toLowerCase()) {
          actFound = true;
        }
        if (actFound && String(season?.Type || '').toLowerCase() === 'episode') {
          episode = lastEpisode || season;
          break;
        }
        if (String(season?.Type || '').toLowerCase() === 'episode') {
          lastEpisode = season;
        }
      }
    }

    const actName = act.DisplayName || act.Name || '';
    const episodeName = episode?.DisplayName || episode?.Name || '';

    return {
      actId: act.ID || null,
      actName: actName || null,
      actNumber: parseSeasonNumber(actName),
      episodeId: episode?.ID || null,
      episodeName: episodeName || null,
      episodeNumber: parseSeasonNumber(episodeName)
    };
  }

  getPeakTierAndSeason(seasonalInfo = {}, fallbackTier = 0, fallbackSeason = null) {
    let peakTier = Number(fallbackTier || 0);
    let peakSeason = fallbackSeason;

    for (const [seasonId, seasonData] of Object.entries(seasonalInfo)) {
      const winsByTier = seasonData?.WinsByTier || [];
      for (const tier of winsByTier) {
        let value = Number(tier || 0);
        // Match yoink rank.py behavior for pre-Ascendant seasons.
        if (BEFORE_ASCENDANT_SEASONS.has(seasonId) && value > 20) {
          value += 3;
        }
        if (value > peakTier) {
          peakTier = value;
          peakSeason = seasonId;
        }
      }
    }

    return { peakTier, peakSeason };
  }

  rankNameFromTier(tier) {
    const raw = Number(tier || 0);
    const idx = Number.isFinite(raw) ? Math.max(0, Math.min(27, raw)) : 0;
    return RANK_NAMES_BY_TIER[idx] || 'Unranked';
  }

  calculateHsAndKdFromMatch(matchData, puuid) {
    let totalHits = 0;
    let totalHeadshots = 0;
    let kills = 0;
    let deaths = 0;

    for (const round of matchData?.roundResults || []) {
      for (const player of round?.playerStats || []) {
        if (player?.subject !== puuid) continue;
        for (const dmg of player?.damage || []) {
          totalHits += Number(dmg?.legshots || 0) + Number(dmg?.bodyshots || 0) + Number(dmg?.headshots || 0);
          totalHeadshots += Number(dmg?.headshots || 0);
        }
      }
    }

    for (const player of matchData?.players || []) {
      if (player?.subject !== puuid) continue;
      kills = Number(player?.stats?.kills || 0);
      deaths = Number(player?.stats?.deaths || 0);
      break;
    }

    // Match yoink player_stats.py behavior: KD numeric, HS "N/A" if unavailable.
    const kd = deaths > 0 ? Number((kills / deaths).toFixed(2)) : kills;
    const hsPct = totalHits > 0 ? Math.round((totalHeadshots / totalHits) * 100) : 'N/A';
    return { kd, hsPct };
  }

  async getYoinkStatsForPlayer(puuid) {
    if (this.yoinkStatsInflight.has(puuid)) {
      return this.yoinkStatsInflight.get(puuid);
    }

    const run = async () => {
      const now = Date.now();
      const cached = this.yoinkStatsCache.get(puuid);
      if (cached && cached.expiresAt > now) {
        return cached.value;
      }

      const out = {
        rankTier: 0,
        rankName: 'Unranked',
        rr: 0,
        leaderboard: 0,
        peakRankTier: 0,
        peakRankName: 'Unranked',
        winRate: 'N/A',
        games: 0,
        hsPct: 'N/A',
        kd: 'N/A',
        deltaRr: 'N/A',
        afkPenalty: 'N/A',
        rrHistory: [],
        peakSeasonId: null,
        peakActEpisode: null
      };

      let content = null;
      let activeSeasonId = null;
      try {
        content = await this.getContentServiceData();
        activeSeasonId = this.getActiveActSeasonId(content);
      } catch (_e) {}

      // Direct port of yoink/src/rank.py
      try {
        const mmr = await this.makePdRequest(`/mmr/v1/players/${puuid}`, 'get');
        const seasonalInfo = mmr?.QueueSkills?.competitive?.SeasonalInfoBySeasonID || {};
        const seasonData = seasonalInfo?.[activeSeasonId] || null;

        const rankTier = Number(seasonData?.CompetitiveTier || 0);
        if (rankTier >= 21) {
          out.rankTier = rankTier;
          out.rr = Number(seasonData?.RankedRating || 0);
          out.leaderboard = Number(seasonData?.LeaderboardRank || 0);
        } else if (![0, 1, 2].includes(rankTier)) {
          out.rankTier = rankTier;
          out.rr = Number(seasonData?.RankedRating || 0);
          out.leaderboard = 0;
        } else {
          out.rankTier = 0;
          out.rr = 0;
          out.leaderboard = 0;
        }
        out.rankName = this.rankNameFromTier(out.rankTier);

        let maxRank = out.rankTier;
        let maxRankSeason = activeSeasonId;
        for (const [seasonId, sData] of Object.entries(seasonalInfo)) {
          const winsByTier = Array.isArray(sData?.WinsByTier) ? sData.WinsByTier : null;
          if (!winsByTier) continue;
          for (const raw of winsByTier) {
            let tier = Number(raw || 0);
            if (BEFORE_ASCENDANT_SEASONS.has(seasonId) && tier > 20) {
              tier += 3;
            }
            if (tier > maxRank) {
              maxRank = tier;
              maxRankSeason = seasonId;
            }
          }
        }
        out.peakRankTier = maxRank;
        out.peakRankName = this.rankNameFromTier(maxRank);
        out.peakSeasonId = maxRankSeason || null;
        out.peakActEpisode = content ? this.getActEpisodeMeta(content, maxRankSeason) : null;

        try {
          const wins = Number(seasonData?.NumberOfWinsWithPlacements || 0);
          const games = Number(seasonData?.NumberOfGames || 0);
          out.games = games;
          out.winRate = games === 0 ? 100 : Math.trunc((wins / games) * 100);
        } catch (_e2) {
          out.winRate = 'N/A';
        }
      } catch (_rankError) {
        // keep defaults
      }

      // Direct port of yoink/src/player_stats.py
      try {
        const updates = await this.makePdRequest(
          `/mmr/v1/players/${puuid}/competitiveupdates?startIndex=0&endIndex=1&queue=competitive`,
          'get'
        );
        const matches = Array.isArray(updates?.Matches) ? updates.Matches : [];
        if (matches.length > 0) {
          const latest = matches[0];
          out.deltaRr = latest?.RankedRatingEarned ?? 'N/A';
          out.afkPenalty = latest?.AFKPenalty ?? 'N/A';
          out.rrHistory = matches.slice(0, 5).map((match) => ({
            matchId: match?.MatchID || null,
            mapId: match?.MapID || null,
            seasonId: match?.SeasonID || null,
            startTime: match?.MatchStartTime || null,
            rrDelta: match?.RankedRatingEarned ?? null,
            afkPenalty: match?.AFKPenalty ?? null
          }));

          if (latest?.MatchID) {
            try {
              const matchDetails = await this.makePdRequest(`/match-details/v1/matches/${latest.MatchID}`, 'get');
              const perf = this.calculateHsAndKdFromMatch(matchDetails, puuid);
              out.kd = perf.kd;
              out.hsPct = perf.hsPct;
            } catch (_detailsError) {
              out.kd = 'N/A';
              out.hsPct = 'N/A';
            }
          }
        }
      } catch (_statsError) {
        // keep defaults
      }

      this.yoinkStatsCache.set(puuid, {
        value: out,
        expiresAt: (out.kd === 'N/A' || out.hsPct === 'N/A') ? now + 15 * 1000 : now + 2 * 60 * 1000
      });

      return out;
    };

    const inflight = run()
      .catch((error) => {
        console.warn(`Yoink stats fetch failed for ${puuid}:`, error?.message || error);
        throw error;
      })
      .finally(() => {
        this.yoinkStatsInflight.delete(puuid);
      });

    this.yoinkStatsInflight.set(puuid, inflight);
    return inflight;
  }

  async getYoinkStatsForPlayers(puuids) {
    const result = {};
    for (const puuid of puuids || []) {
      result[puuid] = await this.getYoinkStatsForPlayer(puuid);
    }
    return result;
  }

  async makeGlzPost(endpoint, body = {}) {
    const routing = this.getRoutingFromLogs();
    if (!routing) {
      throw new Error('Could not determine GLZ routing from ShooterGame.log');
    }

    const tokens = await this.getRiotTokens();
    if (!tokens.accessToken || !tokens.entitlementsToken) {
      throw new Error('Could not get Riot tokens from local client');
    }

    const clientVersion = this.getClientVersionFromLogs();
    const headers = {
      'Authorization': `Bearer ${tokens.accessToken}`,
      'X-Riot-Entitlements-JWT': tokens.entitlementsToken,
      'X-Riot-ClientPlatform': 'ew0KCSJwbGF0Zm9ybVR5cGUiOiAiUEMiLA0KCSJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLA0KCSJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwNCgkicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iDQp9'
    };

    if (clientVersion) {
      headers['X-Riot-ClientVersion'] = clientVersion;
    }

    const baseUrl = `https://glz-${routing.glzRegion}.${routing.glzShard}.a.pvp.net`;
    const response = await axios.post(`${baseUrl}${endpoint}`, body, {
      headers,
      httpsAgent: this.httpsAgent,
      timeout: 5000
    });
    return response.data;
  }

  normalizeTimestamp(value) {
    if (value === null || value === undefined) return null;

    if (typeof value === 'number') {
      // Heuristic: seconds vs milliseconds.
      return value > 1e12 ? value : value * 1000;
    }

    const asNumber = Number(value);
    if (!Number.isNaN(asNumber) && Number.isFinite(asNumber)) {
      return asNumber > 1e12 ? asNumber : asNumber * 1000;
    }

    const parsed = Date.parse(String(value));
    if (!Number.isNaN(parsed)) return parsed;
    return null;
  }

  extractQueueStartTime(matchmakingData = {}) {
    const candidates = [
      matchmakingData.QueueEntryTime,
      matchmakingData.QueueEnteredTime,
      matchmakingData.QueueStartTime,
      matchmakingData.SearchStartTime,
      matchmakingData.LastQueueEntryTime,
      matchmakingData.LastQueueStartTime
    ];

    for (const candidate of candidates) {
      const ts = this.normalizeTimestamp(candidate);
      if (ts) return ts;
    }

    return null;
  }

  async getCurrentMatchFromGlz(puuid) {
    try {
      const playerState = await this.makeGlzRequest(`/core-game/v1/players/${puuid}`);
      if (playerState?.errorCode === 'RESOURCE_NOT_FOUND') {
        return { state: 'MENUS', inGame: false };
      }

      const matchId = playerState?.MatchID || playerState?.matchId;
      if (!matchId) {
        return { state: 'MENUS', inGame: false };
      }

      const matchData = await this.makeGlzRequest(`/core-game/v1/matches/${matchId}`);
      return {
        source: 'glz',
        state: 'INGAME',
        inGame: true,
        matchId,
        matchData
      };
    } catch (error) {
      console.warn('GLZ core-game lookup failed:', error.message);
      if (error.response?.status === 404) {
        return { state: 'MENUS', inGame: false };
      }
      throw error;
    }
  }

  /**
   * Get the current user's PUUID and region
   */
  async getCurrentUser() {
    if (this.currentPuuid) {
      return { puuid: this.currentPuuid, region: this.region || 'na' };
    }

    try {
      // Get entitlements to find PUUID (retry while token init settles)
      let subject = null;
      for (let i = 0; i < 5; i += 1) {
        const entitlements = await this.makeLocalRequest('/entitlements/v1/token');
        subject = entitlements?.subject || null;
        if (subject) break;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      this.currentPuuid = subject;
      if (!this.currentPuuid) {
        throw new Error('Could not determine current user PUUID from entitlements token');
      }
      if (this.currentPuuid && !this.region) {
        const routing = this.getRoutingFromLogs();
        if (routing?.pdRegion) {
          this.region = routing.pdRegion;
        }
      }

      // Get region from session
      try {
        const session = await this.makeLocalRequest('/product-session/v1/external-sessions');
        const valorantSession = session[Object.keys(session)[0]];
        
        if (valorantSession && valorantSession.launchConfiguration) {
          const args = valorantSession.launchConfiguration.arguments;
          const regionMatch = args.find(arg => arg.includes('-ares-deployment'));
          if (regionMatch) {
            this.region = regionMatch.split('=')[1];
          }
        }
      } catch (regionError) {
        // Region is optional for local match detection; fallback handled below.
      }

      return { puuid: this.currentPuuid, region: this.region || 'na' };
    } catch (error) {
      console.error('Error getting current user:', error.message);
      throw error;
    }
  }

  /**
   * Get presence data (includes current game state and match ID)
   */
  async getPresence() {
    try {
      const data = await this.makeLocalRequest('/chat/v4/presences');
      const presences = data.presences;

      if (!this.currentPuuid) {
        await this.getCurrentUser();
      }

      // Find current user's presence
      const myPresence = presences.find(p => p.puuid === this.currentPuuid);
      
      if (!myPresence || !myPresence.private) {
        return null;
      }

      // Decode private presence data
      const privateData = JSON.parse(Buffer.from(myPresence.private, 'base64').toString());
      
      return privateData;
    } catch (error) {
      console.error('Error getting presence:', error.message);
      return null;
    }
  }

  /**
   * Get current match data
   */
  async getCurrentMatch() {
    try {
      const user = await this.getCurrentUser();
      if (!user?.puuid) {
        return { state: 'UNKNOWN', inGame: false };
      }

      // Mirror yoink approach first: use GLZ core-game APIs with Riot tokens.
      try {
        const glzMatch = await this.getCurrentMatchFromGlz(user.puuid);
        if (glzMatch) {
          console.log(`Live detection source=glz state=${glzMatch.state} inGame=${glzMatch.inGame}`);
          return glzMatch;
        }
      } catch (error) {
        console.warn('GLZ live detection error, falling back to local core-game:', error.message);
        // Fall back to local core-game API path below.
      }

      let coreGamePlayer;
      try {
        coreGamePlayer = await this.makeLocalRequest(`/core-game/v1/players/${user.puuid}`);
      } catch (error) {
        if (error.response?.status === 404) {
          return { state: 'MENUS', inGame: false };
        }
        throw error;
      }

      const matchId = coreGamePlayer?.MatchID || coreGamePlayer?.matchId;
      
      if (!matchId) {
        return { state: 'MENUS', inGame: false };
      }

      // Get match details
      let matchData;
      try {
        matchData = await this.makeLocalRequest(`/core-game/v1/matches/${matchId}`);
      } catch (error) {
        // Match can briefly be unavailable during transitions.
        if (error.response?.status === 404) {
          return { state: 'TRANSITION', inGame: false };
        }
        throw error;
      }
      
      return {
        source: 'local',
        state: 'INGAME',
        inGame: true,
        matchId,
        matchData
      };
    } catch (error) {
      console.error('Error getting current match:', error.message);
      throw error;
    }
  }

  async getCurrentPregame() {
    const user = await this.getCurrentUser();
    if (!user?.puuid) {
      return { inPregame: false, state: 'UNKNOWN' };
    }

    let playerPregame;
    try {
      playerPregame = await this.makeGlzRequest(`/pregame/v1/players/${user.puuid}`);
    } catch (error) {
      if (error.response?.status === 404) {
        return { inPregame: false, state: 'MENUS' };
      }
      throw error;
    }

    const matchId = playerPregame?.MatchID || playerPregame?.matchId;
    if (!matchId) {
      return { inPregame: false, state: 'MENUS' };
    }

    const matchData = await this.makeGlzRequest(`/pregame/v1/matches/${matchId}`);
    return {
      inPregame: true,
      state: 'PREGAME',
      source: 'glz',
      matchId,
      matchData
    };
  }

  /**
   * Get loadouts for current match (THIS IS THE KEY FUNCTION FOR SKINS)
   */
  async getMatchLoadouts(matchId, source = 'auto') {
    try {
      if (source === 'glz') {
        return await this.makeGlzRequest(`/core-game/v1/matches/${matchId}/loadouts`);
      }

      return await this.makeLocalRequest(`/core-game/v1/matches/${matchId}/loadouts`);
    } catch (error) {
      const isNotFound = error.response?.status === 404;
      if (isNotFound && source !== 'glz') {
        try {
          console.warn(`Local loadouts lookup failed for ${matchId}, trying GLZ.`);
          return await this.makeGlzRequest(`/core-game/v1/matches/${matchId}/loadouts`);
        } catch (glzError) {
          console.error('GLZ loadouts lookup also failed:', glzError.message);
        }
      }
      console.error('Error getting match loadouts:', error.message);
      throw error;
    }
  }

  /**
   * Get live scoreboard for current match
   */
  async getMatchScoreboard(matchId, source = 'auto') {
    try {
      if (source === 'glz') {
        return await this.makeGlzRequest(`/core-game/v1/matches/${matchId}/scoreboard`);
      }

      return await this.makeLocalRequest(`/core-game/v1/matches/${matchId}/scoreboard`);
    } catch (error) {
      const isNotFound = error.response?.status === 404;
      if (isNotFound && source !== 'glz') {
        try {
          console.warn(`Local scoreboard lookup failed for ${matchId}, trying GLZ.`);
          return await this.makeGlzRequest(`/core-game/v1/matches/${matchId}/scoreboard`);
        } catch (glzError) {
          console.error('GLZ scoreboard lookup also failed:', glzError.message);
        }
      }
      console.error('Error getting match scoreboard:', error.message);
      throw error;
    }
  }

  /**
   * Get party info for current user
   */
  async getCurrentPartyStatus() {
    const user = await this.getCurrentUser();
    let partyPlayer;
    try {
      partyPlayer = await this.makeGlzRequest(`/parties/v1/players/${user.puuid}`);
    } catch (error) {
      if (error.response?.status === 404) {
        partyPlayer = await this.makeLocalRequest(`/parties/v1/players/${user.puuid}`);
      } else {
        throw error;
      }
    }
    const partyId = partyPlayer?.CurrentPartyID;

    if (!partyId) {
      return {
        partyId: null,
        queueId: null,
        partyState: null
      };
    }

    let party;
    try {
      party = await this.makeGlzRequest(`/parties/v1/parties/${partyId}`);
    } catch (error) {
      if (error.response?.status === 404) {
        party = await this.makeLocalRequest(`/parties/v1/parties/${partyId}`);
      } else {
        throw error;
      }
    }
    return {
      partyId,
      queueId: party?.MatchmakingData?.QueueID || null,
      partyState: party?.State || null,
      inQueue: Boolean(party?.MatchmakingData?.IsCurrentlyInQueue || party?.MatchmakingData?.QueueID),
      queueStartedAt: this.extractQueueStartTime(party?.MatchmakingData || {}),
      partySize: Array.isArray(party?.Members) ? party.Members.length : null,
      leaderPuuid: party?.Leader || null,
      members: Array.isArray(party?.Members)
        ? party.Members.map((m) => ({
            puuid: m?.Subject || null,
            isLeader: Boolean(m?.Subject && party?.Leader && m.Subject === party.Leader),
            isIdle: Boolean(m?.IsIdle === true),
            queueEligibility: m?.QueueEligibleRemainingAccountLevels ?? null
          }))
        : []
    };
  }

  /**
   * Get available queue modes from local party configs
   */
  async getQueueModes() {
    let config;
    try {
      config = await this.makeGlzRequest('/parties/v1/parties/customgameconfigs');
    } catch (error) {
      if (error.response?.status === 404) {
        config = await this.makeLocalRequest('/parties/v1/parties/customgameconfigs');
      } else {
        throw error;
      }
    }
    const queues = Array.isArray(config?.Queues) ? config.Queues : [];

    return queues.map((queue) => ({
      queueId: queue.QueueID,
      enabled: queue.Enabled,
      maxPartySize: queue.MaxPartySize,
      teamSize: queue.TeamSize,
      numTeams: queue.NumTeams
    }));
  }

  /**
   * Change party queue mode
   */
  async setQueueMode(queueId) {
    if (!queueId) {
      throw new Error('queueId is required');
    }

    const { partyId } = await this.getCurrentPartyStatus();
    if (!partyId) {
      throw new Error('No active party found');
    }

    try {
      return await this.makeGlzPost(`/parties/v1/parties/${partyId}/queue`, { queueId });
    } catch (error) {
      if (error.response?.status === 404) {
        return this.makeLocalPost(`/parties/v1/parties/${partyId}/queue`, { queueId });
      }
      throw error;
    }
  }

  /**
   * Join matchmaking queue (optionally change mode first)
   */
  async joinQueue(queueId = null) {
    let partyStatus = await this.getCurrentPartyStatus();
    if (!partyStatus.partyId) {
      throw new Error('No active party found');
    }

    if (queueId && queueId !== partyStatus.queueId) {
      await this.setQueueMode(queueId);
      partyStatus = await this.getCurrentPartyStatus();
    }

    let joinResponse;
    try {
      joinResponse = await this.makeGlzPost(
        `/parties/v1/parties/${partyStatus.partyId}/matchmaking/join`,
        {}
      );
    } catch (error) {
      if (error.response?.status === 404) {
        joinResponse = await this.makeLocalPost(
          `/parties/v1/parties/${partyStatus.partyId}/matchmaking/join`,
          {}
        );
      } else {
        throw error;
      }
    }

    return {
      partyId: partyStatus.partyId,
      queueId: joinResponse?.MatchmakingData?.QueueID || queueId || partyStatus.queueId || null,
      state: joinResponse?.State || null
    };
  }

  /**
   * Enrich loadout data with skin information from Valorant-API.com
   */
  async enrichLoadoutsWithSkinData(loadouts, matchPlayers) {
    try {
      let weapons = null;
      let skins = null;
      let tiers = null;
      try {
        // Fetch all weapon and skin data from Valorant-API
        const [weaponsRes, skinsRes, tiersRes] = await Promise.all([
          axios.get('https://valorant-api.com/v1/weapons'),
          axios.get('https://valorant-api.com/v1/weapons/skins'),
          axios.get('https://valorant-api.com/v1/contenttiers')
        ]);

        weapons = weaponsRes.data.data;
        skins = skinsRes.data.data;
        tiers = tiersRes.data.data;
      } catch (error) {
        console.warn('Valorant-API unavailable, using CSV fallback for skins.');
      }

      const csvFallback = loadSkinsCsvFallback();
      const tierMap = {};
      if (tiers) {
        for (const tier of tiers) {
          if (!tier?.uuid) continue;
          tierMap[tier.uuid.toLowerCase()] = {
            name: tier.displayName,
            rank: tier.rank,
            color: tier.highlightColor || tier.displayIcon || null
          };
        }
      }

      // Create a map of CharacterID to loadout
      const loadoutMap = {};
      for (const loadout of loadouts.Loadouts) {
        loadoutMap[loadout.CharacterID.toLowerCase()] = loadout.Loadout;
      }

      const enrichedPlayers = [];

      for (const player of matchPlayers) {
        const characterId = player.CharacterID?.toLowerCase();
        const loadout = loadoutMap[characterId];

        if (!loadout) {
          enrichedPlayers.push({ ...player, loadout: null });
          continue;
        }

        const playerLoadout = {
          weapons: {}
        };

        // Process each weapon in the loadout
        for (const [weaponUuid, weaponData] of Object.entries(loadout.Items)) {
          const weapon = weapons
            ? weapons.find(w => w.uuid.toLowerCase() === weaponUuid.toLowerCase())
            : null;
          const weaponName = weapon?.displayName
            || csvFallback?.weaponMap?.[weaponUuid.toLowerCase()]
            || 'Unknown Weapon';

          const skinSocket = weaponData.Sockets['bcef87d6-209b-46c6-8b19-fbe40bd95abc'];
          const chromaSocket = weaponData.Sockets['3ad1b2b2-acdb-4524-852f-954a76ddae0a'];
          const levelSocket = weaponData.Sockets['e7c63390-eda7-46e0-bb7a-a6abdacd2433'];
          const buddySocket = weaponData.Sockets['dd3bf334-87f3-40bd-b043-682a57a8dc3a'];

          if (skinSocket && skinSocket.Item) {
            const skinId = skinSocket.Item.ID.toLowerCase();
            const skin = skins
              ? skins.find(s => s.uuid.toLowerCase() === skinId)
              : null;
            const csvSkin = csvFallback?.skinMap?.[skinId] || null;

            if (skin || csvSkin) {
              let chromaImage = null;
              
              // Try to find the specific chroma
              if (skin && chromaSocket && chromaSocket.Item) {
                const chromaId = chromaSocket.Item.ID.toLowerCase();
                const chroma = skin.chromas?.find(c => c.uuid.toLowerCase() === chromaId);
                chromaImage = chroma?.displayIcon || chroma?.fullRender;
              }

              const tierUuid = skin?.contentTierUuid || csvSkin?.contentTierUuid || null;
              const tierInfo = tierUuid
                ? tierMap[tierUuid.toLowerCase()] || null
                : null;

              const displaySkinName = skin
                ? skin.displayName.replace(` ${weapon?.displayName || weaponName}`, '')
                : csvSkin?.skinName || 'Unknown Skin';

              playerLoadout.weapons[weaponName] = {
                skinName: displaySkinName,
                skinImage: chromaImage || skin?.displayIcon || weapon?.displayIcon || null,
                weaponImage: weapon?.displayIcon || null,
                rarity: tierInfo ? tierInfo.name : null
              };
            }
          }
        }

        enrichedPlayers.push({
          ...player,
          loadout: playerLoadout
        });
      }

      return enrichedPlayers;
    } catch (error) {
      console.error('Error enriching loadout data:', error.message);
      throw error;
    }
  }
}

module.exports = new ValorantService();
