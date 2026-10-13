const test = require('node:test');
const assert = require('node:assert/strict');
const { HenrikService } = require('../src/services/henrik');

const serviceWithAccounts = (accounts) => {
  const service = new HenrikService();
  const requested = [];
  const pending = [];
  service.getAccountByPuuid = (puuid) => {
    requested.push(puuid);
    const result = new Promise((resolve) => setImmediate(() => resolve(accounts[puuid] || null)));
    pending.push(result);
    return result;
  };
  const settle = () => Promise.all(pending);
  return { service, requested, settle };
};

test('returns nothing for unseen players and starts looking them up in the background', async () => {
  const { service, requested } = serviceWithAccounts({ b: { name: 'Streamer', tag: 'LIVE' } });

  const firstPass = service.getCachedNamesAndQueueMissing(['b'], 'na');

  assert.deepEqual(firstPass, {});
  assert.deepEqual(requested, ['b']);
});

test('returns revealed names on the next call once the lookup finishes', async () => {
  const { service, settle } = serviceWithAccounts({ b: { name: 'Streamer', tag: 'LIVE' } });

  service.getCachedNamesAndQueueMissing(['b'], 'na');
  await settle();

  assert.deepEqual(service.getCachedNamesAndQueueMissing(['b'], 'na'), { b: { name: 'Streamer', tag: 'LIVE' } });
});

test('does not queue duplicate lookups while one is in flight', async () => {
  const { service, requested } = serviceWithAccounts({});

  service.getCachedNamesAndQueueMissing(['b', 'c'], 'na');
  service.getCachedNamesAndQueueMissing(['b', 'c'], 'na');

  assert.deepEqual(requested, ['b', 'c']);
});

const actMatch = (season, kills = 1) => ({ meta: { season: { id: season } }, stats: { kills, deaths: 1, shots: { head: 1, body: 1, leg: 0 } } });

const serviceWithPages = (pagesByPuuid) => {
  const service = new HenrikService();
  const requested = [];
  service.fetchStoredCompetitivePage = async (puuid, region, page) => {
    requested.push([puuid, page]);
    return pagesByPuuid[puuid]?.[page - 1] || { matches: [], hasMore: false };
  };
  return { service, requested };
};

test('loads every page of the current act and stops at an older act', async () => {
  const { service, requested } = serviceWithPages({
    p: [
      { matches: [actMatch('act-1', 2), actMatch('act-1', 2)], hasMore: true },
      { matches: [actMatch('act-1', 2), actMatch('old')], hasMore: true },
      { matches: [actMatch('old')], hasMore: false }
    ]
  });

  const result = await service.loadActPerformance('p', 'na', 'act-1');

  assert.deepEqual(result, { kd: 2, hsPct: 50, matches: 3 });
  assert.deepEqual(requested, [['p', 1], ['p', 2]]);
});

test('whole-act stats arrive on a later call without blocking the first', async () => {
  const { service } = serviceWithPages({ p: [{ matches: [actMatch('act-1', 3)], hasMore: false }] });

  assert.deepEqual(service.getCachedActPerformanceAndQueueMissing(['p'], 'na', 'act-1'), {});
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(service.getCachedActPerformanceAndQueueMissing(['p'], 'na', 'act-1'), { p: { kd: 3, hsPct: 50, matches: 1 } });
});

test('does not start a second act lookup for a player already loading', () => {
  const { service, requested } = serviceWithPages({});

  service.getCachedActPerformanceAndQueueMissing(['p'], 'na', 'act-1');
  service.getCachedActPerformanceAndQueueMissing(['p'], 'na', 'act-1');

  assert.equal(requested.length, 1);
});
