const test = require('node:test');
const assert = require('node:assert/strict');
const { extractMatchScore } = require('../src/services/matchScore');

const inGame = (scores) => ({ matchPresenceData: { sessionLoopState: 'INGAME' }, ...scores });

test('reads the live score from nested party presence', () => {
  const presence = inGame({ partyPresenceData: { partyOwnerMatchScoreAllyTeam: 7, partyOwnerMatchScoreEnemyTeam: 11 } });

  assert.deepEqual(extractMatchScore(presence), { ally: 7, enemy: 11, round: 19 });
});

test('reads the live score from the older flat presence layout', () => {
  const presence = { sessionLoopState: 'INGAME', partyOwnerMatchScoreAllyTeam: 3, partyOwnerMatchScoreEnemyTeam: 2 };

  assert.deepEqual(extractMatchScore(presence), { ally: 3, enemy: 2, round: 6 });
});

test('the first round of a match is round 1', () => {
  const presence = inGame({ partyPresenceData: { partyOwnerMatchScoreAllyTeam: 0, partyOwnerMatchScoreEnemyTeam: 0 } });

  assert.deepEqual(extractMatchScore(presence), { ally: 0, enemy: 0, round: 1 });
});

test('no score outside a match', () => {
  const presence = { matchPresenceData: { sessionLoopState: 'MENUS' }, partyPresenceData: { partyOwnerMatchScoreAllyTeam: 0, partyOwnerMatchScoreEnemyTeam: 0 } };

  assert.equal(extractMatchScore(presence), null);
});

test('no score when the presence has none', () => {
  assert.equal(extractMatchScore(inGame({})), null);
  assert.equal(extractMatchScore(null), null);
});
