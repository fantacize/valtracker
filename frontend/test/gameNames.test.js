import test from 'node:test';
import assert from 'node:assert/strict';
import { mapName, modeName, queueLabel } from '../src/lib/gameNames.js';

test('map codenames become the names players know', () => {
  assert.equal(mapName('/Game/Maps/Duality/Duality'), 'Bind');
  assert.equal(mapName('/Game/Maps/Juliett/Juliett'), 'Sunset');
  assert.equal(mapName('/Game/Maps/HURM/HURM_Alley/HURM_Alley'), 'District');
});

test('unknown maps fall back to the last part of the path', () => {
  assert.equal(mapName('/Game/Maps/Plummet/Plummet'), 'Plummet');
});

test('a missing map reads as unknown', () => {
  assert.equal(mapName(''), 'Unknown map');
  assert.equal(mapName(undefined), 'Unknown map');
});

test('queue IDs get proper labels', () => {
  assert.equal(queueLabel('competitive'), 'Competitive');
  assert.equal(queueLabel('ggteam'), 'Escalation');
  assert.equal(queueLabel('onefa'), 'Replication');
  assert.equal(queueLabel('hurm'), 'Team Deathmatch');
});

test('unknown queue IDs are title-cased', () => {
  assert.equal(queueLabel('some_new_mode'), 'Some New Mode');
});

test('the queue decides the mode name when known', () => {
  assert.equal(modeName({ queueId: 'unrated', modeId: '/Game/GameModes/Bomb/BombGameMode.BombGameMode_C' }), 'Unrated');
});

test('Spike Rush is recognised from its game mode', () => {
  assert.equal(modeName({ modeId: '/Game/GameModes/QuickBomb/QuickBombGameMode.QuickBombGameMode_C' }), 'Spike Rush');
});

test('the standard bomb mode without a queue is just Standard', () => {
  assert.equal(modeName({ modeId: '/Game/GameModes/Bomb/BombGameMode.BombGameMode_C' }), 'Standard');
});

test('other game modes are recognised from their mode path', () => {
  assert.equal(modeName({ modeId: '/Game/GameModes/HURM/HURMGameMode.HURMGameMode_C' }), 'Team Deathmatch');
  assert.equal(modeName({ modeId: '/Game/GameModes/GunGame/GunGameTeamsGameMode.GunGameTeamsGameMode_C' }), 'Escalation');
  assert.equal(modeName({ modeId: '/Game/GameModes/Deathmatch/DeathmatchGameMode.DeathmatchGameMode_C' }), 'Deathmatch');
});

test('no mode information reads as Custom', () => {
  assert.equal(modeName({}), 'Custom');
});
