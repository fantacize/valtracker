import test from 'node:test';
import assert from 'node:assert/strict';
import { formatActLabel } from '../src/lib/actLabel.js';

test('numbered episodes show as E9 A3', () => {
  assert.deepEqual(formatActLabel({ episodeNumber: 9, actNumber: 3 }), { short: 'E9 A3', long: 'Episode 9, Act 3' });
});

test('yearly seasons show as V26 A5', () => {
  assert.deepEqual(formatActLabel({ episodeNumber: 'v26', actNumber: 5 }), { short: 'V26 A5', long: 'Season 2026, Act 5' });
});

test('reads the act number from the act name when it is missing', () => {
  assert.equal(formatActLabel({ episodeNumber: 'v25', actName: 'ACT 2' }).short, 'V25 A2');
});

test('an act without a known episode shows the act alone', () => {
  assert.deepEqual(formatActLabel({ actNumber: 2 }), { short: 'A2', long: 'Act 2' });
});

test('nothing to show without act information', () => {
  assert.equal(formatActLabel(null), null);
  assert.equal(formatActLabel({}), null);
});
