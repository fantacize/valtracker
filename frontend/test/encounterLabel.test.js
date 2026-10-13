import test from 'node:test';
import assert from 'node:assert/strict';
import { describeEncounter } from '../src/lib/encounterLabel.js';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 100 * DAY;

const summary = (overrides = {}) => ({
  games: 3,
  with: { games: 2, wins: 2, losses: 0 },
  against: { games: 1, wins: 0, losses: 1 },
  last: { startedAt: NOW - 2 * DAY, map: 'Bonsai', sameTeam: false, won: false, queue: 'competitive' },
  lastName: 'OldName#EU',
  ...overrides
});

test('nothing to show for players you have never met', () => {
  assert.equal(describeEncounter(null, { now: NOW, currentName: 'x#1' }), null);
});

test('labels how many times you have met', () => {
  assert.equal(describeEncounter(summary(), { now: NOW, currentName: 'OldName#EU' }).label, 'Seen 3×');
});

test('details split games with you and against you, from your point of view', () => {
  const { details } = describeEncounter(summary(), { now: NOW, currentName: 'OldName#EU' });

  assert.ok(details.includes('With you: 2W 0L'));
  assert.ok(details.includes('Against you: 0W 1L'));
});

test('details describe the last meeting', () => {
  const { details } = describeEncounter(summary(), { now: NOW, currentName: 'OldName#EU' });

  assert.ok(details.includes('Last: against you on Bonsai, 2 days ago (you lost)'));
});

test('mentions a name change since you last met', () => {
  const { details } = describeEncounter(summary(), { now: NOW, currentName: 'NewName#NA' });

  assert.ok(details.includes('Was OldName#EU'));
});

test('recent meetings read as today', () => {
  const { details } = describeEncounter(summary({ last: { startedAt: NOW - 1000, map: 'Ascent', sameTeam: true, won: true, queue: 'unrated' } }), { now: NOW, currentName: 'OldName#EU' });

  assert.ok(details.includes('Last: with you on Ascent, today (you won)'));
});

test('omits a side you have never played on', () => {
  const { details } = describeEncounter(summary({ against: { games: 0, wins: 0, losses: 0 } }), { now: NOW, currentName: 'OldName#EU' });

  assert.ok(!details.includes('Against you'));
});
