const test = require('node:test');
const assert = require('node:assert/strict');

for (const name of ['match', 'auth', 'account']) {
  test(`${name} routes export an Express router the server can mount`, () => {
    const router = require(`../src/routes/${name}`);

    assert.equal(typeof router, 'function');
    assert.ok(Array.isArray(router.stack) && router.stack.length > 0);
  });
}
