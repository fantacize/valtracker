import test from 'node:test';
import assert from 'node:assert/strict';
import { getRrDisplay } from '../src/lib/rrStyle.js';

test('a regular rank at 0 RR is fully red', () => {
  const display = getRrDisplay({ tier: 'Gold 2', rr: 0 });

  assert.equal(display.kind, 'bar');
  assert.equal(display.color, 'hsl(355 90% 60%)');
});

test('a regular rank near 100 RR turns green', () => {
  assert.equal(getRrDisplay({ tier: 'Gold 2', rr: 100 }).color, 'hsl(145 70% 50%)');
});

test('a regular rank at 50 RR sits between red and green', () => {
  const hue = Number(getRrDisplay({ tier: 'Gold 2', rr: 50 }).color.match(/hsl\((-?\d+)/)[1]);

  assert.ok(hue > 0 && hue < 145, `expected a hue between red and green, got ${hue}`);
});

test('the bar gradient runs from red to the current RR colour', () => {
  const display = getRrDisplay({ tier: 'Gold 2', rr: 100 });

  assert.equal(display.background, 'linear-gradient(90deg, hsl(355 90% 60%), hsl(145 70% 50%))');
});

test('RR outside 0-100 is clamped for the bar', () => {
  assert.equal(getRrDisplay({ tier: 'Gold 2', rr: 140 }).width, 100);
  assert.equal(getRrDisplay({ tier: 'Gold 2', rr: -5 }).width, 0);
});

test('Immortal shows red RR as a number instead of a bar', () => {
  assert.deepEqual(getRrDisplay({ tier: 'Immortal 3', rr: 312 }), { kind: 'number', tone: 'immortal' });
});

test('Radiant shows gold RR as a number', () => {
  assert.deepEqual(getRrDisplay({ tier: 'Radiant', rr: 812 }), { kind: 'number', tone: 'radiant' });
});
