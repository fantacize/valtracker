import test from 'node:test';
import assert from 'node:assert/strict';
import { agentIconUrl, findMapArt } from '../src/lib/gameArt.js';

test('builds the agent portrait URL from the character ID', () => {
  assert.equal(
    agentIconUrl('ADD6443A-41BD-E414-F6AD-E58D267F4E95'),
    'https://media.valorant-api.com/agents/add6443a-41bd-e414-f6ad-e58d267f4e95/displayicon.png'
  );
});

test('no portrait while the agent is unknown or not picked', () => {
  assert.equal(agentIconUrl(null), null);
  assert.equal(agentIconUrl(''), null);
  assert.equal(agentIconUrl('not-a-uuid'), null);
});

const maps = [
  { displayName: 'Ascent', mapUrl: '/Game/Maps/Ascent/Ascent', splash: 'ascent-splash.png', listViewIcon: 'ascent-wide.png' },
  { displayName: 'Plummet', mapUrl: '/Game/Maps/Plummet/Plummet', splash: 'plummet-splash.png', listViewIcon: 'plummet-wide.png' }
];

test('finds map art by the game map path', () => {
  assert.deepEqual(findMapArt(maps, '/Game/Maps/Plummet/Plummet'), {
    name: 'Plummet',
    splash: 'plummet-splash.png',
    banner: 'plummet-wide.png'
  });
});

test('matches map paths case-insensitively', () => {
  assert.equal(findMapArt(maps, '/game/maps/ascent/ascent').name, 'Ascent');
});

test('no art for unknown maps', () => {
  assert.equal(findMapArt(maps, '/Game/Maps/Nope/Nope'), null);
  assert.equal(findMapArt(null, '/Game/Maps/Ascent/Ascent'), null);
});
