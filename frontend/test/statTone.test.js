import test from 'node:test';
import assert from 'node:assert/strict';
import { statTone } from '../src/lib/statTone.js';

test('K/D above 1.15 is good', () => {
  assert.equal(statTone('kd', 1.32), 'good');
});

test('K/D below 0.9 is bad', () => {
  assert.equal(statTone('kd', 0.69), 'bad');
});

test('K/D around 1 is neutral', () => {
  assert.equal(statTone('kd', 1.0), 'neutral');
  assert.equal(statTone('kd', 0.9), 'neutral');
  assert.equal(statTone('kd', 1.15), 'neutral');
});

test('win rate of 55% or more is good, under 45% is bad', () => {
  assert.equal(statTone('winRate', 57), 'good');
  assert.equal(statTone('winRate', 50), 'neutral');
  assert.equal(statTone('winRate', 42), 'bad');
});

test('HS% of 25% or more is good, under 15% is bad', () => {
  assert.equal(statTone('hs', 27), 'good');
  assert.equal(statTone('hs', 19), 'neutral');
  assert.equal(statTone('hs', 12), 'bad');
});

test('missing values are neutral', () => {
  assert.equal(statTone('kd', null), 'neutral');
  assert.equal(statTone('kd', 'N/A'), 'neutral');
  assert.equal(statTone('unknown-stat', 5), 'neutral');
});
