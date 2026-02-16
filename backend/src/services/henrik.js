const axios = require('axios');

/**
 * Henrik API Service
 * Used for finding hidden player names and basic account info
 */
class HenrikService {
  constructor() {
    this.baseUrl = 'https://api.henrikdev.xyz';
    this.apiKey = process.env.HENRIK_API_KEY || '';
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
        error.code = 'HENRIK_BACKOFF';
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

  /**
   * Get account by name and tag
   */
  async getAccountByName(name, tag) {
    try {
      const response = await this.queuedGet(
        `${this.baseUrl}/valorant/v1/account/${name}/${tag}`
      );

      return {
        name: response.data.data.name,
        tag: response.data.data.tag,
        puuid: response.data.data.puuid,
        region: response.data.data.region,
        accountLevel: response.data.data.account_level
      };
    } catch (error) {
      if (error.response?.status === 404) {
        console.log(`Player not found: ${name}#${tag}`);
        return null;
      }
      if (error.response?.status === 429) {
        this.rateLimitedUntil = Date.now() + 60 * 1000;
        return null;
      }
      console.error('Henrik API error:', error.message);
      throw error;
    }
  }

  /**
   * Get MMR (rank) data by PUUID
   */
  async getMmrByPuuid(puuid, region = 'na') {
    try {
      const response = await this.queuedGet(
        `${this.baseUrl}/valorant/v2/by-puuid/mmr/${region}/${puuid}`
      );

      const data = response.data.data;
      
      return {
        currenttier: data.current_data?.currenttier || 0,
        currenttierPatched: data.current_data?.currenttierpatched || 'Unranked',
        ranking_in_tier: data.current_data?.ranking_in_tier || 0,
        elo: data.current_data?.elo || 0,
        old: data.current_data?.old || false,
        highest_rank: data.highest_rank || null
      };
    } catch (error) {
      if (error.response?.status === 429) {
        this.rateLimitedUntil = Date.now() + 60 * 1000;
        return null;
      }
      console.error('Henrik MMR API error:', error.message);
      return null;
    }
  }

  async getMmrHistoryByPuuid(puuid, region = 'na') {
    try {
      const response = await this.queuedGet(
        `${this.baseUrl}/valorant/v1/by-puuid/mmr-history/${region}/${puuid}`
      );
      return response.data.data || [];
    } catch (error) {
      if (error.response?.status === 429) {
        this.rateLimitedUntil = Date.now() + 60 * 1000;
        return null;
      }
      console.error('Henrik MMR history API error:', error.message);
      return null;
    }
  }

  /**
   * Get match history by PUUID
   */
  async getMatchHistoryByPuuid(puuid, region = 'na', mode = 'competitive', size = 5) {
    try {
      const response = await this.queuedGet(
        `${this.baseUrl}/valorant/v3/by-puuid/matches/${region}/${puuid}?mode=${mode}&size=${size}`
      );

      return response.data.data;
    } catch (error) {
      if (error.response?.status === 429) {
        this.rateLimitedUntil = Date.now() + 60 * 1000;
        return null;
      }
      console.error('Henrik match history API error:', error.message);
      return null;
    }
  }

  /**
   * Get queue status for a region
   * Henrik docs: /valorant/v1/queue-status/{region}
   */
  async getQueueStatus(region = 'na') {
    try {
      const response = await this.queuedGet(
        `${this.baseUrl}/valorant/v1/queue-status/${region}`
      );

      const raw = response.data?.data ?? response.data;
      const items = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.queues)
          ? raw.queues
          : [];

      const queues = items.map((item) => {
        const queue = item.queue || item.id || item.name || 'unknown';
        const statusRaw = item.status || item.state || 'unknown';
        const status = String(statusRaw).toLowerCase();
        const enabled = typeof item.enabled === 'boolean'
          ? item.enabled
          : ['enabled', 'open', 'active', 'available'].includes(status);

        return {
          queue,
          status,
          enabled,
          reason: item.reason || null
        };
      });

      return {
        region,
        queues,
        fetchedAt: Date.now()
      };
    } catch (error) {
      if (error.response?.status === 429) {
        this.rateLimitedUntil = Date.now() + 60 * 1000;
        return null;
      }
      console.error('Henrik queue status API error:', error.message);
      return null;
    }
  }

  /**
   * Resolve multiple PUUIDs to names/tags at once
   * This is useful for getting all player names in a match
   */
  async resolvePuuids(puuids, region = 'na') {
    if (Date.now() < this.rateLimitedUntil) {
      return {};
    }

    const results = {};
    
    // Henrik API doesn't have bulk endpoint, so we do sequential calls with delay
    for (const puuid of puuids) {
      try {
        const account = await this.getAccountByPuuid(puuid, region);
        if (account) {
          results[puuid] = account;
        }
        // Small delay to respect rate limits
        await this.delay(75);
      } catch (error) {
        console.error(`Error resolving PUUID ${puuid}:`, error.message);
        results[puuid] = null;
      }
    }

    return results;
  }

  /**
   * Helper function for delays
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new HenrikService();
