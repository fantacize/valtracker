const axios = require('axios');
const { getHenrikApiKey } = require('../config');
const { aggregateActPerformance, isActComplete } = require('./playerStats');

const ACT_PAGE_SIZE = 100;
const MAX_ACT_PAGES = 5;
const ACT_STATS_TTL_MS = 10 * 60 * 1000;

/**
 * Henrik API Service
 * Used for finding hidden player names and basic account info
 */
class HenrikService {
  constructor() {
    this.baseUrl = 'https://api.henrikdev.xyz';
    this.apiKey = getHenrikApiKey();
    this.revealedNames = new Map();
    this.pendingNameLookups = new Set();
    this.actPerformance = new Map();
    this.pendingActLookups = new Set();
    this.rateLimitedUntil = 0;
    this.accountCache = new Map();
    this.requestQueue = Promise.resolve();
    // Henrik free tier is ~30 req/min; keep headroom.
    this.minRequestGapMs = 2200;
  }

  /**
   * Get headers for Henrik API
   */
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };

    if (this.apiKey) {
      headers['Authorization'] = this.apiKey;
    }

    return headers;
  }

  async queuedGet(url) {
    const run = async () => {
      if (Date.now() < this.rateLimitedUntil) {
        const error = new Error('Henrik backoff active');
        error.code = 'HENRIKBACKOFF';
        throw error;
      }

      const response = await axios.get(url, { headers: this.getHeaders() });
      return response;
    };

    const execute = this.requestQueue.then(run, run);
    this.requestQueue = execute
      .catch(() => null)
      .then(() => new Promise((resolve) => setTimeout(resolve, this.minRequestGapMs)));
    return execute;
  }

  /**
   * Get account by PUUID
   * This is useful for hidden profiles where name/tag is unknown
   */
  async getAccountByPuuid(puuid, region = 'na') {
    const now = Date.now();
    if (now < this.rateLimitedUntil) {
      return null;
    }

    const cacheKey = `${puuid}:${region}`;
    const cached = this.accountCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.value;
    }

    try {
      const response = await this.queuedGet(
        `${this.baseUrl}/valorant/v1/by-puuid/account/${puuid}`
      );

      const account = {
        name: response.data.data.name,
        tag: response.data.data.tag,
        puuid: response.data.data.puuid,
        region: response.data.data.region
      };

      this.accountCache.set(cacheKey, {
        value: account,
        expiresAt: Date.now() + 60 * 60 * 1000
      });
      return account;
    } catch (error) {
      if (error.response?.status === 404) {
        console.log(`Player not found for PUUID: ${puuid}`);
        return null;
      }
      if (error.response?.status === 429) {
        // Back off Henrik requests for a minute to avoid repeated hard rate limit.
        this.rateLimitedUntil = Date.now() + 60 * 1000;
        return null;
      }
      console.error('Henrik API error:', error.message);
      return null;
    }
  }

  getCachedNamesAndQueueMissing(puuids, region = 'na') {
    puuids
      .filter((puuid) => !this.revealedNames.has(puuid) && !this.pendingNameLookups.has(puuid))
      .forEach((puuid) => {
        this.pendingNameLookups.add(puuid);
        Promise.resolve(this.getAccountByPuuid(puuid, region))
          .then((account) => {
            if (account?.name) this.revealedNames.set(puuid, { name: account.name, tag: account.tag || '' });
          })
          .catch(() => null)
          .finally(() => this.pendingNameLookups.delete(puuid));
      });

    return Object.fromEntries(
      puuids.filter((puuid) => this.revealedNames.has(puuid)).map((puuid) => [puuid, this.revealedNames.get(puuid)])
    );
  }

  async fetchStoredMatchesPage(puuid, region, page, mode = null) {
    const modeFilter = mode ? `mode=${mode}&` : '';
    const response = await this.queuedGet(
      `${this.baseUrl}/valorant/v1/by-puuid/stored-matches/${region}/${puuid}?${modeFilter}size=${ACT_PAGE_SIZE}&page=${page}`
    );
    return {
      matches: Array.isArray(response?.data?.data) ? response.data.data : [],
      hasMore: Number(response?.data?.results?.after || 0) > 0
    };
  }

  fetchStoredCompetitivePage(puuid, region, page) {
    return this.fetchStoredMatchesPage(puuid, region, page, 'competitive');
  }

  async loadActPerformance(puuid, region, seasonId) {
    const loadPage = async (page, collected) => {
      const { matches, hasMore } = await this.fetchStoredCompetitivePage(puuid, region, page);
      const all = [...collected, ...matches];
      if (page >= MAX_ACT_PAGES || isActComplete({ matches, seasonId, hasMore })) return all;
      return loadPage(page + 1, all);
    };
    return aggregateActPerformance(await loadPage(1, []), seasonId);
  }

  getCachedActPerformanceAndQueueMissing(puuids, region = 'na', seasonId = null) {
    if (!seasonId) return {};
    const keyFor = (puuid) => `${seasonId}:${puuid}`;
    const fresh = (puuid) => (this.actPerformance.get(keyFor(puuid))?.expiresAt || 0) > Date.now();

    puuids
      .filter((puuid) => !fresh(puuid) && !this.pendingActLookups.has(keyFor(puuid)))
      .forEach((puuid) => {
        this.pendingActLookups.add(keyFor(puuid));
        this.loadActPerformance(puuid, region, seasonId)
          .then((value) => this.actPerformance.set(keyFor(puuid), { value, expiresAt: Date.now() + ACT_STATS_TTL_MS }))
          .catch(() => null)
          .finally(() => this.pendingActLookups.delete(keyFor(puuid)));
      });

    return Object.fromEntries(
      puuids
        .map((puuid) => [puuid, this.actPerformance.get(keyFor(puuid))?.value])
        .filter(([, value]) => value)
    );
  }

}

module.exports = new HenrikService();
module.exports.HenrikService = HenrikService;
