import test from 'node:test';
import assert from 'node:assert/strict';
import { startPolling, POLL_INTERVAL_MS } from '../src/js/polling.js';
function harness(load, hidden = false) {
  let tick, visibility;
  const page = { hidden, addEventListener(name, callback) { assert.equal(name, 'visibilitychange'); visibility = callback; } };
  startPolling(load, page, (callback, interval) => { assert.equal(interval, 60000); tick = callback; });
  return { page, tick, visibility };
}
test('polling loads immediately and repeats every minute while visible', async () => {
  let calls = 0;
  const h = harness(async () => { calls++; });
  assert.equal(POLL_INTERVAL_MS, 60000);
  assert.equal(calls, 1);
  await Promise.resolve();
  await h.tick();
  assert.equal(calls, 2);
});
test('hidden tabs skip polling and resume immediately on return', async () => {
  let calls = 0;
  const h = harness(async () => { calls++; }, true);
  await h.tick();
  assert.equal(calls, 0);
  h.page.hidden = false;
  await h.visibility();
  assert.equal(calls, 1);
  h.page.hidden = true;
  await h.visibility();
  await h.tick();
  assert.equal(calls, 1);
});
test('polling prevents overlapping requests', async () => {
  let calls = 0, release;
  const h = harness(() => { calls++; return new Promise(resolve => { release = resolve; }); });
  await h.tick();
  await h.visibility();
  assert.equal(calls, 1);
  release();
  await Promise.resolve();
  const next = h.tick();
  assert.equal(calls, 2);
  release();
  await next;
});
