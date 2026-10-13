const test = require('node:test');
const assert = require('node:assert/strict');
const { toMatchRecord, summarizeEncounters } = require('../src/services/encounters');

const riotMatch = ({ id = 'm1', start = 1000, queue = 'competitive', map = '/Game/Maps/Ascent/Ascent', winner = 'Blue', players }) => ({
  matchInfo: { matchId: id, gameStartMillis: start, queueID: queue, mapId: map },
  teams: [{ teamId: 'Blue', won: winner === 'Blue' }, { teamId: 'Red', won: winner === 'Red' }],
  players: players.map(([subject, teamId, gameName = subject, tagLine = 'NA1']) => ({ subject, teamId, gameName, tagLine, characterId: 'agent' }))
});

test('reduces Riot match details to a small record', () => {
  const record = toMatchRecord(riotMatch({ players: [['me', 'Blue'], ['ally', 'Blue'], ['enemy', 'Red']] }));

  assert.deepEqual(record, {
    matchId: 'm1',
    startedAt: 1000,
    queue: 'competitive',
    map: 'Ascent',
    winningTeam: 'Blue',
    players: [
      { puuid: 'me', team: 'Blue', name: 'me#NA1' },
      { puuid: 'ally', team: 'Blue', name: 'ally#NA1' },
      { puuid: 'enemy', team: 'Red', name: 'enemy#NA1' }
    ]
  });
});

test('skips deathmatch since there are no teams', () => {
  assert.equal(toMatchRecord(riotMatch({ queue: 'deathmatch', players: [['me', 'a'], ['x', 'b']] })), null);
});

test('counts games with you and against you, with results from your side', () => {
  const records = [
    toMatchRecord(riotMatch({ id: 'm1', start: 1000, winner: 'Blue', players: [['me', 'Blue'], ['p', 'Blue']] })),
    toMatchRecord(riotMatch({ id: 'm2', start: 2000, winner: 'Red', players: [['me', 'Blue'], ['p', 'Blue']] })),
    toMatchRecord(riotMatch({ id: 'm3', start: 3000, winner: 'Red', map: '/Game/Maps/Bonsai/Bonsai', players: [['me', 'Blue'], ['p', 'Red']] }))
  ];

  const summary = summarizeEncounters({ records, selfPuuid: 'me', puuids: ['p'] });

  assert.deepEqual(summary.p, {
    games: 3,
    with: { games: 2, wins: 1, losses: 1 },
    against: { games: 1, wins: 0, losses: 1 },
    last: { startedAt: 3000, map: 'Bonsai', sameTeam: false, won: false, queue: 'competitive' },
    lastName: 'p#NA1'
  });
});

test('players you have never met are left out', () => {
  const records = [toMatchRecord(riotMatch({ players: [['me', 'Blue'], ['p', 'Blue']] }))];

  assert.deepEqual(summarizeEncounters({ records, selfPuuid: 'me', puuids: ['stranger', 'me'] }), {});
});

test('remembers the name they used last time you met', () => {
  const records = [
    toMatchRecord(riotMatch({ id: 'old', start: 1, players: [['me', 'Blue'], ['p', 'Red', 'OldName', 'EU']] })),
    toMatchRecord(riotMatch({ id: 'new', start: 2, players: [['me', 'Blue'], ['p', 'Red', 'NewName', 'NA']] }))
  ];

  assert.equal(summarizeEncounters({ records, selfPuuid: 'me', puuids: ['p'] }).p.lastName, 'NewName#NA');
});

const { createEncounterStore } = require('../src/services/encounters');

const fakeStore = ({ saved = [], history = [], detailsById = {} }) => {
  const fetched = [];
  const writes = [];
  const store = createEncounterStore({
    load: () => saved,
    save: (records) => writes.push(records),
    fetchRecentMatchIds: async () => history,
    fetchMatchDetails: async (id) => {
      fetched.push(id);
      if (!detailsById[id]) throw new Error('not found');
      return detailsById[id];
    }
  });
  return { store, fetched, writes };
};

test('refresh downloads only matches it has not saved yet and persists them', async () => {
  const saved = [toMatchRecord(riotMatch({ id: 'old', players: [['me', 'Blue'], ['p', 'Blue']] }))];
  const { store, fetched, writes } = fakeStore({
    saved,
    history: ['new', 'old'],
    detailsById: { new: riotMatch({ id: 'new', start: 5000, players: [['me', 'Blue'], ['p', 'Red']] }) }
  });

  await store.refresh('me');

  assert.deepEqual(fetched, ['new']);
  assert.equal(writes.at(-1).length, 2);
  assert.equal(store.summariesFor('me', ['p']).p.games, 2);
});

test('a match that fails to download is skipped, not fatal', async () => {
  const { store } = fakeStore({
    history: ['broken', 'ok'],
    detailsById: { ok: riotMatch({ id: 'ok', players: [['me', 'Blue'], ['p', 'Blue']] }) }
  });

  await store.refresh('me');

  assert.equal(store.summariesFor('me', ['p']).p.games, 1);
});

test('background refresh does not overlap with one already running', async () => {
  const { store, fetched } = fakeStore({
    history: ['a'],
    detailsById: { a: riotMatch({ id: 'a', players: [['me', 'Blue'], ['p', 'Blue']] }) }
  });

  store.refreshInBackground('me');
  store.refreshInBackground('me');
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.deepEqual(fetched, ['a']);
});

const { pickMatchIds } = require('../src/services/encounters');

const henrikEntry = (id, mode = 'Competitive') => ({ meta: { id, mode } });

test('combines Riot and Henrik match IDs without duplicates, newest Riot first', () => {
  const ids = pickMatchIds({
    riotIds: ['a', 'b'],
    henrikMatches: [henrikEntry('b'), henrikEntry('c'), henrikEntry('d')],
    limit: 300
  });

  assert.deepEqual(ids, ['a', 'b', 'c', 'd']);
});

test('skips deathmatch IDs before downloading anything', () => {
  const ids = pickMatchIds({
    riotIds: [],
    henrikMatches: [henrikEntry('dm', 'Deathmatch'), henrikEntry('tdm', 'Team Deathmatch'), henrikEntry('comp')],
    limit: 300
  });

  assert.deepEqual(ids, ['tdm', 'comp']);
});

test('stops at the requested number of matches', () => {
  const ids = pickMatchIds({ riotIds: ['a', 'b', 'c'], henrikMatches: [henrikEntry('d')], limit: 2 });

  assert.deepEqual(ids, ['a', 'b']);
});

test('saves progress during a long first download so a restart does not lose it', async () => {
  const history = Array.from({ length: 5 }, (_, i) => `m${i}`);
  const detailsById = Object.fromEntries(history.map((id, i) => [id, riotMatch({ id, start: i, players: [['me', 'Blue'], ['p', 'Blue']] })]));
  const writes = [];
  const store = createEncounterStore({
    load: () => [],
    save: (records) => writes.push(records.length),
    fetchRecentMatchIds: async () => history,
    fetchMatchDetails: async (id) => detailsById[id],
    saveEvery: 2,
    pauseMs: 0
  });

  await store.refresh('me');

  assert.deepEqual(writes, [2, 4, 5]);
});
