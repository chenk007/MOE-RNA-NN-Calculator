import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.mjs';
import { readFile } from 'node:fs/promises';

const paths = ['/', '/index.html', '/parameters.json', '/js/calculator.js', '/js/parameters.js', '/css/style.css', '/unknown', '/parameters.json?download=1'];
const basic = value => `Basic ${Buffer.from(value).toString('base64')}`;
function environment(overrides = {}) {
  let calls = 0;
  return {
    BASIC_AUTH_USERNAME: 'test-user', BASIC_AUTH_PASSWORD: 'test-password', REQUIRE_AUTH: 'true',
    ASSETS: { async fetch(request) {
      calls++;
      assert.equal(request.headers.get('Authorization'), null);
      return new Response('asset', { headers: { Vary: 'Accept-Encoding' } });
    } },
    get calls() { return calls; },
    ...overrides,
  };
}
test('all asset paths challenge anonymous and wrong credentials without accessing ASSETS', async () => {
  for (const path of paths) for (const auth of [null, basic('test-user:wrong'), 'Bearer token', 'Basic !!!', 'Basic /w==']) {
    const env = environment();
    const result = await worker.fetch(new Request(`https://example.test${path}`, { headers: auth ? { Authorization: auth } : {} }), env);
    assert.equal(result.status, 401);
    assert.match(result.headers.get('WWW-Authenticate'), /^Basic /);
    assert.equal(result.headers.get('Cache-Control'), 'no-store');
    assert.equal(env.calls, 0);
  }
});
test('correct credentials serve all paths and strip authorization', async () => {
  for (const path of paths) {
    const env = environment();
    const result = await worker.fetch(new Request(`https://example.test${path}`, { headers: { Authorization: basic('test-user:test-password') } }), env);
    assert.equal(result.status, 200);
    assert.equal(env.calls, 1);
    assert.equal(result.headers.get('Cache-Control'), 'no-store');
    assert.match(result.headers.get('Vary'), /Authorization/);
    assert.match(result.headers.get('Vary'), /Accept-Encoding/);
  }
});
test('explicit false enables public access without secrets; all other values require auth', async () => {
  const publicEnv = environment({ REQUIRE_AUTH: 'false', BASIC_AUTH_USERNAME: undefined, BASIC_AUTH_PASSWORD: undefined });
  assert.equal((await worker.fetch(new Request('https://example.test/parameters.json'), publicEnv)).status, 200);
  for (const flag of [undefined, '', 'true', 'False', '0']) {
    const env = environment({ REQUIRE_AUTH: flag });
    assert.equal((await worker.fetch(new Request('https://example.test/'), env)).status, 401);
    assert.equal(env.calls, 0);
  }
});
test('missing secrets fail closed, including previews', async () => {
  const env = environment({ BASIC_AUTH_PASSWORD: undefined });
  assert.equal((await worker.fetch(new Request('https://example.test/'), env)).status, 503);
  assert.equal(env.calls, 0);
});
test('HEAD and OPTIONS cannot bypass auth', async () => {
  for (const method of ['HEAD', 'OPTIONS']) {
    const env = environment();
    assert.equal((await worker.fetch(new Request('https://example.test/parameters.json', { method }), env)).status, 401);
    assert.equal(env.calls, 0);
  }
});
test('deployment runs Worker before every asset and preserves dashboard variables', async () => {
  const config = JSON.parse(await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
  assert.equal(config.assets.run_worker_first, true);
  assert.equal(config.keep_vars, true);
  assert.equal(config.preview_urls, false);
  assert.equal(config.vars, undefined);
});
