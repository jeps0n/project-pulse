import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateSites, isPublicHttps, runCheck } from '../monitor/check.mjs';
const sites = JSON.parse(readFileSync(new URL('../config/services.json', import.meta.url), 'utf8'));
test('two applications and three valid checks', () => {
  assert.equal(validateSites(sites).length, 2);
  assert.equal(sites.flatMap(s => s.checks).length, 3);
});
test('reject duplicate ids', () => assert.throws(() => validateSites([sites[0], sites[0]])));
test('only public HTTPS targets', () => {
  assert.equal(isPublicHttps('https://example.com/api/health'), true);
  for (const url of ['http://example.com','https://localhost','https://127.0.0.1','https://example.com:8080']) assert.equal(isPublicHttps(url),false);
});
test('missing config is warning, not green', async () => {
  const r = await runCheck(sites[0].checks[0], {});
  assert.equal(r.ok, null);
});
test('API success and failure detected', async () => {
  const c = sites[0].checks[0];
  const env = { [c.urlEnv]: 'https://example.com/health' };
  assert.equal((await runCheck(c, env, async () => ({status:200,ok:true,body:null}))).ok,true);
  assert.equal((await runCheck(c, env, async () => ({status:503,ok:false,body:null}))).ok,false);
});
