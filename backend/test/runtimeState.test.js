const test = require('node:test');
const assert = require('node:assert/strict');
const { RuntimeStateService } = require('../src/services/runtimeState');

const encodedPresence = (sessionLoopState) => Buffer.from(JSON.stringify({
  matchPresenceData: { sessionLoopState }
})).toString('base64');

const createLockfile = () => ({
  sessionId: 'session-1',
  getSessionId() {
    return this.sessionId;
  },
  getBaseUrl() {
    return 'https://127.0.0.1:1234';
  },
  getAuthHeader() {
    return { Authorization: 'Basic test' };
  }
});

test('selects VALORANT presence when Riot Client presence appears first', async () => {
  const httpClient = {
    async get(url) {
      if (url.endsWith('/entitlements/v1/token')) {
        return { data: { subject: 'player-1' } };
      }
      return {
        data: {
          presences: [
            { puuid: 'player-1', product: 'riot_client' },
            { puuid: 'player-1', product: 'valorant', private: encodedPresence('PREGAME') }
          ]
        }
      };
    }
  };
  const service = new RuntimeStateService({ httpClient, lockfile: createLockfile() });

  await service.pollOnce();

  assert.deepEqual(service.getSnapshot(), {
    initialized: true,
    connected: true,
    sessionLoopState: 'PREGAME',
    puuid: 'player-1',
    product: 'valorant',
    privatePresence: { matchPresenceData: { sessionLoopState: 'PREGAME' } },
    updatedAt: service.getSnapshot().updatedAt,
    lastError: null
  });
});

test('marks the game offline when only Riot Client presence remains', async () => {
  const httpClient = {
    async get(url) {
      if (url.endsWith('/entitlements/v1/token')) {
        return { data: { subject: 'player-1' } };
      }
      return { data: { presences: [{ puuid: 'player-1', product: 'riot_client' }] } };
    }
  };
  const service = new RuntimeStateService({ httpClient, lockfile: createLockfile() });

  await service.pollOnce();

  const snapshot = service.getSnapshot();
  assert.equal(snapshot.initialized, true);
  assert.equal(snapshot.connected, false);
  assert.equal(snapshot.sessionLoopState, null);
  assert.equal(snapshot.product, null);
});

test('drops cached entitlements when Riot Client credentials change', async () => {
  const lockfile = createLockfile();
  let entitlementRequests = 0;
  const httpClient = {
    async get(url) {
      if (url.endsWith('/entitlements/v1/token')) {
        entitlementRequests += 1;
        return { data: { subject: `player-${entitlementRequests}` } };
      }
      return { data: { presences: [] } };
    }
  };
  const service = new RuntimeStateService({ httpClient, lockfile });

  await service.pollOnce();
  lockfile.sessionId = 'session-2';
  await service.pollOnce();

  assert.equal(entitlementRequests, 2);
  assert.equal(service.getSnapshot().puuid, 'player-2');
});
