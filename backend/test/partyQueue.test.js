const test = require('node:test');
const assert = require('node:assert/strict');
const { isPartyQueueing, parseRiotQueueTime } = require('../src/services/partyQueue');

test('a party is queueing only while matchmaking', () => {
  assert.equal(isPartyQueueing({ State: 'MATCHMAKING', MatchmakingData: { QueueID: 'competitive' } }), true);
});

test('having a mode selected is not the same as being in queue', () => {
  assert.equal(isPartyQueueing({ State: 'DEFAULT', MatchmakingData: { QueueID: 'competitive' } }), false);
});

test('a found match is no longer queueing', () => {
  assert.equal(isPartyQueueing({ State: 'MATCHMADE_GAME_STARTING', MatchmakingData: { QueueID: 'competitive' } }), false);
});

test('missing party data is not queueing', () => {
  assert.equal(isPartyQueueing(null), false);
});

test('parses Riot queue entry time as UTC', () => {
  assert.equal(parseRiotQueueTime('2026.10.13-00.12.34'), Date.UTC(2026, 9, 13, 0, 12, 34));
});

test('Riot uses year 0001 for "never queued"', () => {
  assert.equal(parseRiotQueueTime('0001.01.01-00.00.00'), null);
});

test('unreadable queue times are ignored', () => {
  assert.equal(parseRiotQueueTime(''), null);
  assert.equal(parseRiotQueueTime(undefined), null);
  assert.equal(parseRiotQueueTime('soon'), null);
});
