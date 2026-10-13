import test from 'node:test';
import assert from 'node:assert/strict';
import { playerStatLine, teamAverages } from '../src/lib/teamStats.js';

test('reads live stats loaded for a player', () => {
  assert.deepEqual(
    playerStatLine({ yoinkStats: { kd: 1.25, hsPct: 22, winRate: 54 } }),
    { kd: 1.25, hs: 22, wr: 54 }
  );
});

test('reads sample stats used by the demo', () => {
  assert.deepEqual(
    playerStatLine({ demoStats: { stats: { kd: 0.9, headshotPct: 18.4, winRate: 47.2 } } }),
    { kd: 0.9, hs: 18.4, wr: 47.2 }
  );
});

test('missing or N/A stats are null', () => {
  assert.deepEqual(playerStatLine({ yoinkStats: { kd: 'N/A', hsPct: null } }), { kd: null, hs: null, wr: null });
  assert.deepEqual(playerStatLine({}), { kd: null, hs: null, wr: null });
});

test('team averages use only players with a value', () => {
  const players = [
    { yoinkStats: { kd: 1.2, hsPct: 20, winRate: 50 } },
    { yoinkStats: { kd: 0.8, hsPct: 'N/A', winRate: 60 } },
    { yoinkStats: {} }
  ];

  assert.deepEqual(teamAverages(players), { kd: 1, hs: 20, wr: 55 });
});

test('averages are null when nobody on the team has stats yet', () => {
  assert.deepEqual(teamAverages([{}, {}]), { kd: null, hs: null, wr: null });
});
