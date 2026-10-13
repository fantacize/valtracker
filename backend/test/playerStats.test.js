const test = require('node:test');
const assert = require('node:assert/strict');
const { aggregatePerformance, seasonWinRate } = require('../src/services/playerStats');

const matchFor = ({ puuid = 'me', kills, deaths, headshots, bodyshots, legshots = 0 }) => ({
  players: [{ subject: puuid, stats: { kills, deaths } }, { subject: 'other', stats: { kills: 99, deaths: 1 } }],
  roundResults: [
    { playerStats: [{ subject: puuid, damage: [{ headshots, bodyshots, legshots }] }] },
    { playerStats: [{ subject: 'other', damage: [{ headshots: 50, bodyshots: 0, legshots: 0 }] }] }
  ]
});

test('K/D totals kills and deaths across matches instead of using one game', () => {
  const result = aggregatePerformance([
    matchFor({ kills: 25, deaths: 10, headshots: 0, bodyshots: 1 }),
    matchFor({ kills: 5, deaths: 20, headshots: 0, bodyshots: 1 })
  ], 'me');

  assert.equal(result.kd, 1);
  assert.equal(result.matches, 2);
});

test('HS% is total headshots over total hits across matches', () => {
  const result = aggregatePerformance([
    matchFor({ kills: 1, deaths: 1, headshots: 10, bodyshots: 30 }),
    matchFor({ kills: 1, deaths: 1, headshots: 30, bodyshots: 30 })
  ], 'me');

  assert.equal(result.hsPct, 40);
});

test('ignores matches the player is not in', () => {
  const result = aggregatePerformance([
    matchFor({ kills: 10, deaths: 5, headshots: 1, bodyshots: 1 }),
    matchFor({ puuid: 'someone-else', kills: 0, deaths: 30, headshots: 0, bodyshots: 9 })
  ], 'me');

  assert.equal(result.kd, 2);
  assert.equal(result.matches, 1);
});

test('returns null stats when there are no usable matches', () => {
  assert.deepEqual(aggregatePerformance([], 'me'), { kd: null, hsPct: null, matches: 0 });
});

test('K/D with zero deaths equals the kill count', () => {
  assert.equal(aggregatePerformance([matchFor({ kills: 7, deaths: 0, headshots: 0, bodyshots: 1 })], 'me').kd, 7);
});

test('season win rate is wins over games', () => {
  assert.equal(seasonWinRate({ wins: 12, games: 20 }), 60);
});

test('season win rate is unknown, not 100%, when no games were played', () => {
  assert.equal(seasonWinRate({ wins: 0, games: 0 }), null);
});

const { aggregateActPerformance, applyActPerformance, isActComplete } = require('../src/services/playerStats');

const storedMatch = ({ season = 'act-1', kills, deaths, head, body, leg = 0 }) => ({
  meta: { season: { id: season } },
  stats: { kills, deaths, shots: { head, body, leg } }
});

test('act performance totals every stored match from the current act', () => {
  const result = aggregateActPerformance([
    storedMatch({ kills: 20, deaths: 10, head: 10, body: 30 }),
    storedMatch({ kills: 10, deaths: 20, head: 30, body: 30 })
  ], 'act-1');

  assert.deepEqual(result, { kd: 1, hsPct: 40, matches: 2 });
});

test('act performance ignores matches from other acts', () => {
  const result = aggregateActPerformance([
    storedMatch({ kills: 10, deaths: 5, head: 1, body: 1 }),
    storedMatch({ season: 'old-act', kills: 0, deaths: 50, head: 0, body: 9 })
  ], 'act-1');

  assert.equal(result.kd, 2);
  assert.equal(result.matches, 1);
});

test('act performance is null when no matches are from the current act', () => {
  assert.equal(aggregateActPerformance([storedMatch({ season: 'old-act', kills: 1, deaths: 1, head: 1, body: 1 })], 'act-1'), null);
});

test('a page is the end of the act when it reaches an older act or runs out', () => {
  assert.equal(isActComplete({ matches: [storedMatch({ kills: 1, deaths: 1, head: 0, body: 1 }), storedMatch({ season: 'old', kills: 1, deaths: 1, head: 0, body: 1 })], seasonId: 'act-1', hasMore: true }), true);
  assert.equal(isActComplete({ matches: [storedMatch({ kills: 1, deaths: 1, head: 0, body: 1 })], seasonId: 'act-1', hasMore: false }), true);
  assert.equal(isActComplete({ matches: [storedMatch({ kills: 1, deaths: 1, head: 0, body: 1 })], seasonId: 'act-1', hasMore: true }), false);
});

test('whole-act stats replace last-5 stats and say so', () => {
  const merged = applyActPerformance(
    { a: { kd: 2.5, hsPct: 30, statMatches: 5, rankName: 'Gold 2' }, b: { kd: 1.1, hsPct: 20, statMatches: 5 } },
    { a: { kd: 1.05, hsPct: 22, matches: 87 } }
  );

  assert.deepEqual(merged.a, { kd: 1.05, hsPct: 22, statMatches: 87, statScope: 'act', rankName: 'Gold 2' });
  assert.deepEqual(merged.b, { kd: 1.1, hsPct: 20, statMatches: 5, statScope: 'recent' });
});
