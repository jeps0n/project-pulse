import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PULSE_COUNT } from '../src/js/health.js';
import { performance } from 'node:perf_hooks';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configPath = path.join(root, 'config/services.json');
const outputPath = path.join(root, 'src', 'data', 'status.json');
export function isPublicHttps(raw) {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' || u.username || u.password || u.port || u.hash)
      return false;
    const h = u.hostname.toLowerCase();
    if (!h.includes('.') || h === 'localhost' || /(^|\.)(local|internal|localhost)$/.test(h))
      return false;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(h) || h.includes(':'))
      return false;
    return true;
  }
  catch {
    return false;
  }
}
export function validateSites(sites) {
  if (!Array.isArray(sites) || !sites.length)
    throw Error('config/services.json must contain applications');
  const ids = new Set();
  for (const s of sites) {
    if (!s.id || !s.name || ids.has(s.id) || !Array.isArray(s.checks) || !s.checks.length)
      throw Error('Invalid or duplicate application');
    ids.add(s.id);
    for (const c of s.checks) {
      if (!c.id || !c.name || !['http', 'supabase'].includes(c.kind) || !c.urlEnv || (c.kind === 'supabase' && !c.keyEnv))
        throw Error('Invalid check configuration');
    }
  }
  return sites;
}
export async function runCheck(c, env = process.env, request = fetch) {
  const raw = env[c.urlEnv];
  const key = c.kind === 'supabase' ? env[c.keyEnv] : null;
  if (!raw || (c.kind === 'supabase' && !key))
    return { ok: null, httpStatus: null, latencyMs: null, error: 'Not configured' };
  if (!isPublicHttps(raw))
    return { ok: false, httpStatus: null, latencyMs: null, error: 'Invalid HTTPS endpoint' };
  let url = raw;
  if (c.kind === 'supabase') {
    try {
      const target = new URL(c.endpoint, raw);
      if (typeof c.endpoint !== 'string' || !c.endpoint.startsWith('/') || target.origin !== new URL(raw).origin || !isPublicHttps(target.href))
        throw Error();
      url = target.href;
    }
    catch {
      return { ok: false, httpStatus: null, latencyMs: null, error: 'Invalid HTTPS endpoint' };
    }
  }
  const headers = { accept: 'application/json', 'user-agent': 'ProjectPulse/1.0' };
  if (key)
    headers.apikey = key;
  const start = performance.now();
  try {
    const response = await request(url, { method: 'GET', headers, redirect: 'error', signal: AbortSignal.timeout(12000) });
    await response.body?.cancel();
    return { ok: response.status >= 200 && response.status < 300, httpStatus: response.status,
      latencyMs: Math.round(performance.now() - start), error: response.ok ? null : `HTTP ${response.status}` };
  }
  catch (e) {
    return { ok: false, httpStatus: null, latencyMs: Math.round(performance.now() - start),
      error: e?.name === 'TimeoutError' ? 'Timeout' : 'Request failed' };
  }
}
// Aggregate only repeated requests to the same dependency.
export async function runMultiCheck(c, env = process.env, request = fetch) {
  const pulses = [];
  for (let i = 0; i < PULSE_COUNT; i++)
    pulses.push(await runCheck(c, env, request));
  return { pulses };
}
export async function main() {
  const sites = validateSites(JSON.parse(await readFile(configPath, 'utf8')));
  const now = new Date().toISOString();
  const results = [];
  for (const site of sites) {
    const checks = [];
    for (const c of site.checks) {
      const r = await runMultiCheck(c);
      checks.push({ id: c.id, name: c.name, kind: c.kind, ...r });
      console.log(`${site.name} / ${c.name}: ${r.pulses.every(p => p.ok === null) ? 'unconfigured' : `${r.pulses.filter(p => p.ok === true).length}/${PULSE_COUNT} passed`}`);
    }
    results.push({ id: site.id, name: site.name, description: site.description, lastCheck: now,
      checks });
  }
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify({ generatedAt: now, sites: results }, null, 2) + '\n');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => { console.error('Monitoring could not complete. Check configuration and output permissions.'); process.exitCode = 1; });
}
