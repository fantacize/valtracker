const test = require('node:test');
const assert = require('node:assert/strict');
const { resolvePlayerNames } = require('../src/services/playerNames');

const riotLookupReturning = (names) => async () => names;
const fallbackRecording = (names) => {
  const calls = [];
  const lookup = async (puuids) => {
    calls.push(puuids);
    return names;
  };
  return { lookup, calls };
};

test('uses Riot names for visible players without calling the fallback', async () => {
  const fallback = fallbackRecording({});
  const result = await resolvePlayerNames({
    puuids: ['a'],
    riotLookup: riotLookupReturning({ a: { name: 'Flocked', tag: 'NA1' } }),
    fallbackLookup: fallback.lookup
  });

  assert.deepEqual(result.a, { name: 'Flocked', tag: 'NA1', hidden: false });
  assert.deepEqual(fallback.calls, []);
});

test('reveals hidden players through the fallback lookup', async () => {
  const fallback = fallbackRecording({ b: { name: 'Streamer', tag: 'LIVE' } });
  const result = await resolvePlayerNames({
    puuids: ['a', 'b'],
    riotLookup: riotLookupReturning({ a: { name: 'Flocked', tag: 'NA1' }, b: { name: '', tag: '' } }),
    fallbackLookup: fallback.lookup
  });

  assert.deepEqual(result.b, { name: 'Streamer', tag: 'LIVE', hidden: true });
  assert.deepEqual(fallback.calls, [['b']]);
});

test('treats players missing from the Riot response as hidden', async () => {
  const fallback = fallbackRecording({ c: { name: 'Ghost', tag: '0001' } });
  const result = await resolvePlayerNames({
    puuids: ['c'],
    riotLookup: riotLookupReturning({}),
    fallbackLookup: fallback.lookup
  });

  assert.deepEqual(result.c, { name: 'Ghost', tag: '0001', hidden: true });
});

test('marks a player hidden with no name when nobody can resolve them', async () => {
  const result = await resolvePlayerNames({
    puuids: ['d'],
    riotLookup: riotLookupReturning({ d: { name: 'Unknown', tag: '' } }),
    fallbackLookup: async () => ({})
  });

  assert.deepEqual(result.d, { name: null, tag: null, hidden: true });
});

test('still returns Riot names when the fallback throws', async () => {
  const result = await resolvePlayerNames({
    puuids: ['a', 'b'],
    riotLookup: riotLookupReturning({ a: { name: 'Flocked', tag: 'NA1' } }),
    fallbackLookup: async () => { throw new Error('rate limited'); }
  });

  assert.deepEqual(result.a, { name: 'Flocked', tag: 'NA1', hidden: false });
  assert.deepEqual(result.b, { name: null, tag: null, hidden: true });
});

const { findRiotIdInMatch, namesFromYoinkStats, combineLookups } = require('../src/services/playerNames');

test('finds a player Riot ID in Riot match details, even when they are hidden now', () => {
  const matchDetails = {
    players: [
      { subject: 'a', gameName: 'Flocked', tagLine: 'NA1' },
      { subject: 'b', gameName: 'Streamer', tagLine: 'LIVE' }
    ]
  };

  assert.deepEqual(findRiotIdInMatch(matchDetails, 'b'), { name: 'Streamer', tag: 'LIVE' });
});

test('returns null when the player is not in the match or has no name', () => {
  assert.equal(findRiotIdInMatch({ players: [{ subject: 'a', gameName: '', tagLine: '' }] }, 'a'), null);
  assert.equal(findRiotIdInMatch({ players: [] }, 'z'), null);
  assert.equal(findRiotIdInMatch(null, 'z'), null);
});

test('collects Riot IDs found while loading player stats', () => {
  const names = namesFromYoinkStats({
    a: { riotId: { name: 'Streamer', tag: 'LIVE' } },
    b: { riotId: null },
    c: null
  });

  assert.deepEqual(names, { a: { name: 'Streamer', tag: 'LIVE' } });
});

test('combined lookups only ask later sources for players still unresolved', async () => {
  const asked = [];
  const lookup = combineLookups([
    async () => ({ a: { name: 'FromMatch', tag: '1' } }),
    async (ids) => { asked.push(ids); return { b: { name: 'FromHenrik', tag: '2' } }; }
  ]);

  const names = await lookup(['a', 'b']);

  assert.deepEqual(names, { a: { name: 'FromMatch', tag: '1' }, b: { name: 'FromHenrik', tag: '2' } });
  assert.deepEqual(asked, [['b']]);
});
