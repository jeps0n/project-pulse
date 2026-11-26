import test from 'node:test';
import assert from 'node:assert/strict';
import { PULSE_COUNT, dependencyHealth } from '../src/js/health.js';
import { readFileSync } from 'node:fs';
import { validateSites, isPublicHttps, runCheck, runMultiCheck } from '../monitor/check.mjs';
const sites = JSON.parse(readFileSync(new URL('../config/services.json', import.meta.url), 'utf8'));
test('two applications and three valid checks', () => {
  assert.equal(validateSites(sites).length, 2);
  assert.equal(sites.flatMap(s => s.checks).length, 3);
});
test('reject duplicate ids', () => assert.throws(() => validateSites([sites[0], sites[0]])));
test('only public HTTPS targets', () => {
  assert.equal(isPublicHttps('https://example.com/api/health'), true);
  for (const url of ['http://example.com', 'https://localhost', 'https://127.0.0.1', 'https://example.com:8080'])
    assert.equal(isPublicHttps(url), false);
});
test('missing config is warning, not green', async () => {
  const r = await runCheck(sites[0].checks[0], {});
  assert.equal(r.ok, null);
});
test('API success and failure detected', async () => {
  const c = sites[0].checks[0];
  const env = { [c.urlEnv]: 'https://example.com/health' };
  assert.equal((await runCheck(c, env, async () => ({ status: 200, ok: true, body: null }))).ok, true);
  assert.equal((await runCheck(c, env, async () => ({ status: 503, ok: false, body: null }))).ok, false);
});
for (const codes of [[200, 200, 200], [200, 503, 200], [503, 200, 503], [503, 503, 503]]) {
  test(`Multi-pulse: ${['complete failure', 'partial failure', 'partial failure', 'complete success'][codes.filter(c => c === 200).length]} (${codes.filter(c => c === 200).length}/3)`, async () => {
    const c = sites[0].checks[0];
    let calls = 0;
    const r = await runMultiCheck(c, { [c.urlEnv]: 'https://example.com/health' }, async () => {
      const status = codes[calls++];
      return { status, ok: status === 200, body: null };
    });
    assert.equal(calls, PULSE_COUNT);
    assert.deepEqual(r.pulses.map(p => p.httpStatus), codes);
    const passed = codes.filter(code => code === 200).length;
    assert.equal(dependencyHealth(r.pulses), passed === PULSE_COUNT ? 'up' : passed ? 'warn' : 'down');
    assert.deepEqual(Object.keys(r), ['pulses']);
  });
}
test('unconfigured multi-check does not send requests', async () => {
  const r = await runMultiCheck(sites[0].checks[0], {}, async () => assert.fail('Unexpected request'));
  assert.equal(r.pulses.length, PULSE_COUNT);
  assert.ok(r.pulses.every(p => p.ok === null && p.latencyMs === null));
  assert.equal(dependencyHealth(r.pulses), 'warn');
});
test('network errors are sanitized and remaining pulses continue', async () => {
  let calls = 0;
  const c = sites[0].checks[0];
  const r = await runMultiCheck(c, { [c.urlEnv]: 'https://example.com/health' }, async () => {
    if (++calls === 1)
      throw Error('private diagnostic');
    return { status: 200, ok: true, body: null };
  });
  assert.equal(calls, PULSE_COUNT);
  assert.equal(r.pulses[0].error, 'Request failed');
  assert.equal(dependencyHealth(r.pulses), 'warn');
});
test('Supabase credentials cannot be sent to another origin', async () => {
  const c = sites[0].checks[1];
  const env = { [c.urlEnv]: 'https://example.com', [c.keyEnv]: 'test-key' };
  for (const endpoint of ['//other.example/health', 'https://other.example/health', '/\\other.example/health', undefined]) {
    const result = await runCheck({ ...c, endpoint }, env, async () => assert.fail('Unexpected request'));
    assert.equal(result.error, 'Invalid HTTPS endpoint');
  }
  await runCheck(c, env, async (url, options) => {
    assert.equal(url, 'https://example.com/auth/v1/health');
    assert.equal(options.headers.apikey, 'test-key');
    assert.equal(options.redirect, 'error');
    return { status: 200, ok: true, body: null };
  });
});
