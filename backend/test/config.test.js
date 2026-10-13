const test = require('node:test');
const assert = require('node:assert/strict');
const { getHenrikApiKey } = require('../src/config');

test('reads the Henrik key using the name documented in .env.example', () => {
  assert.equal(getHenrikApiKey({ HENRIK_API_KEY: 'HDEV-abc' }), 'HDEV-abc');
});

test('still accepts the legacy Henrik key name', () => {
  assert.equal(getHenrikApiKey({ HENRIKAPIKEY: 'HDEV-old' }), 'HDEV-old');
});


test('returns an empty key when none is configured', () => {
  assert.equal(getHenrikApiKey({}), '');
});
