const axios = require('axios');
const https = require('https');
const { EventEmitter } = require('events');
const lockfileService = require('./lockfile');

const POLL_INTERVAL_MS = 2000;
const TOKEN_TTL_MS = 30000;

class RuntimeStateService extends EventEmitter {
  constructor({ httpClient = axios, lockfile = lockfileService } = {}) {
    super();
    this.httpClient = httpClient;
    this.lockfileService = lockfile;
    this.httpsAgent = new https.Agent({ rejectUnauthorized: false });
    this.interval = null;
    this.polling = false;
    this.entitlementsCache = null;
    this.entitlementsCacheTs = 0;
    this.credentialSessionId = null;
    this.state = {
      initialized: false,
      connected: false,
      sessionLoopState: null,
      puuid: null,
      product: null,
      privatePresence: null,
      updatedAt: 0,
      lastError: null
    };
  }

  start() {
    if (this.interval) return;
    this.pollOnce().catch(() => {});
    this.interval = setInterval(() => {
      this.pollOnce().catch(() => {});
    }, POLL_INTERVAL_MS);
  }

  stop() {
    if (!this.interval) return;
    clearInterval(this.interval);
    this.interval = null;
  }

  getSnapshot() {
    return { ...this.state };
  }

  async pollOnce() {
    if (this.polling) return;
    this.polling = true;
    try {
      const credentialSessionId = this.lockfileService.getSessionId();
      if (credentialSessionId !== this.credentialSessionId) {
        this.clearEntitlementsCache();
        this.credentialSessionId = credentialSessionId;
      }

      const baseUrl = this.lockfileService.getBaseUrl();
      if (!baseUrl) {
        this.clearEntitlementsCache();
        this.updateState({
          initialized: true,
          connected: false,
          sessionLoopState: null,
          puuid: null,
          product: null,
          privatePresence: null,
          lastError: null
        });
        return;
      }

      const tokenData = await this.getEntitlements(baseUrl);
      const puuid = tokenData?.subject || null;
      if (!puuid) {
        this.updateState({
          initialized: true,
          connected: false,
          sessionLoopState: null,
          puuid: null,
          product: null,
          privatePresence: null,
          lastError: 'Missing subject in entitlements token'
        });
        return;
      }

      const authHeader = this.lockfileService.getAuthHeader();
      if (!authHeader) {
        this.updateState({
          initialized: true,
          connected: false,
          sessionLoopState: null,
          puuid,
          product: null,
          privatePresence: null,
          lastError: 'Missing local auth header'
        });
        return;
      }

      const response = await this.httpClient.get(`${baseUrl}/chat/v4/presences`, {
        headers: authHeader,
        httpsAgent: this.httpsAgent,
        timeout: 4000
      });

      const presences = Array.isArray(response?.data?.presences) ? response.data.presences : [];
      // Riot Client publishes its own presence for the same PUUID. On a game
      // relaunch that entry can appear before VALORANT's entry, so selecting by
      // PUUID alone leaves the tracker permanently attached to the wrong item.
      const myPresence = presences.find((presence) => (
        presence?.puuid === puuid
        && String(presence?.product || '').toLowerCase() === 'valorant'
      )) || null;
      const decoded = this.decodePrivatePresence(myPresence?.private);
      const nextState = this.extractSessionLoopState(decoded);

      this.updateState({
        initialized: true,
        connected: Boolean(myPresence),
        sessionLoopState: nextState,
        puuid,
        product: myPresence?.product || null,
        privatePresence: decoded,
        lastError: null
      });
    } catch (error) {
      this.clearEntitlementsCache();
      this.updateState({
        initialized: true,
        connected: false,
        sessionLoopState: null,
        puuid: null,
        product: null,
        privatePresence: null,
        lastError: error.message
      });
    } finally {
      this.polling = false;
    }
  }

  async getEntitlements(baseUrl) {
    const now = Date.now();
    if (this.entitlementsCache && (now - this.entitlementsCacheTs) < TOKEN_TTL_MS) {
      return this.entitlementsCache;
    }

    const authHeader = this.lockfileService.getAuthHeader();
    if (!authHeader) return null;

    const response = await this.httpClient.get(`${baseUrl}/entitlements/v1/token`, {
      headers: authHeader,
      httpsAgent: this.httpsAgent,
      timeout: 4000
    });

    this.entitlementsCache = response?.data || null;
    this.entitlementsCacheTs = now;
    return this.entitlementsCache;
  }

  clearEntitlementsCache() {
    this.entitlementsCache = null;
    this.entitlementsCacheTs = 0;
  }

  decodePrivatePresence(encoded) {
    if (!encoded) return null;
    try {
      const decoded = Buffer.from(encoded, 'base64').toString('utf8');
      return JSON.parse(decoded);
    } catch {
      return null;
    }
  }

  extractSessionLoopState(privatePresence) {
    if (!privatePresence || typeof privatePresence !== 'object') return null;

    if (privatePresence.matchPresenceData && privatePresence.matchPresenceData.sessionLoopState) {
      return privatePresence.matchPresenceData.sessionLoopState;
    }

    if (privatePresence.sessionLoopState) {
      return privatePresence.sessionLoopState;
    }

    return null;
  }

  updateState(patch) {
    const previous = this.state;
    this.state = {
      ...previous,
      ...patch,
      updatedAt: Date.now()
    };

    if (previous.sessionLoopState !== this.state.sessionLoopState) {
      this.emit('state-change', {
        previous: previous.sessionLoopState,
        current: this.state.sessionLoopState
      });
    }

    if (
      previous.connected !== this.state.connected
      || (this.state.connected && previous.puuid !== this.state.puuid)
    ) {
      this.emit('connection-change', {
        previous: { connected: previous.connected, puuid: previous.puuid },
        current: { connected: this.state.connected, puuid: this.state.puuid }
      });
    }
  }
}

const runtimeStateService = new RuntimeStateService();

module.exports = runtimeStateService;
module.exports.RuntimeStateService = RuntimeStateService;
