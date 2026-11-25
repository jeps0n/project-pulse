import test from 'node:test';
import assert from 'node:assert/strict';
import { average, dependencyHealth, applicationHealth, systemSummary, diagnostic, aggregateHttp, elapsed, monitoringMetrics, currentSystemSummary, STALE_AFTER_MS } from '../src/js/health.js';
const pulse = (ok, latencyMs = 100, httpStatus = ok ? 200 : 503) => ({ok,latencyMs,httpStatus});
const good = pulse(true), bad = pulse(false);
const site = (...checks) => ({lastCheck:'2026-11-25T15:00:00Z',checks:checks.map(pulses=>({pulses}))});
for (const [name,pulses,expected] of [
 ['threshold inclusive',[pulse(true,1500),pulse(true,1500),pulse(true,1500)],'up'],
 ['slow average',[pulse(true,1501),pulse(true,1501),pulse(true,1501)],'warn'],
 ['slow outlier retained',[pulse(true,3000),good,good],'up'],
 ['partial success',[good,bad,good],'warn'],['majority failure',[bad,good,bad],'warn'],['complete failure',[bad,bad,bad],'down'],['missing configuration',[{ok:null},{ok:null},{ok:null}],'warn'],['incomplete snapshot',[good],'warn']]) {
 test(name,()=>assert.equal(dependencyHealth(pulses),expected));
}
test('worst dependency and application propagate; mixed counts retained',()=>{
 const healthy=site([good,good,good]), warning=site([good,bad,good]), critical=site([good,good,good],[bad,bad,bad]);
 assert.equal(applicationHealth(critical),'down');
 const summary=systemSummary([healthy,warning,critical]);
 assert.equal(summary.health,'down'); assert.equal(summary.healthy,1); assert.match(summary.message,/1 application critical; 1 application requiring attention/);
 assert.equal(systemSummary([healthy]).health,'up'); assert.equal(systemSummary([warning]).health,'warn'); assert.equal(systemSummary([]).health,'warn');
});
test('average excludes failures and weights successful pulses equally',()=>{assert.equal(average([pulse(true,100),pulse(false,12000),pulse(true,300)]),200);assert.equal(average([bad]),null);});
test('diagnostics are controlled and HTTP codes remain separate',()=>{for(const [code,label] of Object.entries({400:'Bad request',401:'Unauthorized',403:'Forbidden',404:'Not found',429:'Rate limited',500:'Server error',502:'Bad gateway',503:'Unavailable',504:'Gateway timeout',418:'HTTP error'}))assert.equal(diagnostic(pulse(false,100,Number(code))),label);assert.equal(diagnostic({ok:false,error:'secret'}),'Request failed');assert.equal(diagnostic({ok:false,error:'Timeout'}),'Timeout');assert.equal(diagnostic({ok:false,error:'Invalid HTTPS endpoint'}),'Invalid endpoint');assert.equal(diagnostic({ok:null}),'Not configured');assert.equal(diagnostic(pulse(true,1501)),'Slow response');assert.equal(diagnostic(good),'—');assert.equal(aggregateHttp([good,bad]),'Mixed');assert.equal(aggregateHttp([good,good]),200);assert.equal(aggregateHttp([{httpStatus:null}]),'—');});
test('elapsed time updates without freshness classification',()=>{const t='2026-11-25T15:00:00Z', now=Date.parse(t);assert.equal(elapsed(t,now),'Just now');assert.equal(elapsed(t,now+30000),'30 seconds ago');assert.equal(elapsed(t,now+4500000),'1 hour, 15 minutes ago');assert.equal(elapsed(t,now+183600000),'2 days, 3 hours ago');});

test('dashboard metrics distinguish healthy dependencies from successful pulses',()=>{
 const m=monitoringMetrics([site([good,good,good],[good,bad,good]),site([good,good,good])]);
 assert.deepEqual(m,{dependencies:3,healthyDependencies:2,attempted:9,successful:8,expected:9,rate:88.9});
});
test('missing pulses are not counted as successful or attempted',()=>{
 const m=monitoringMetrics([site([good,bad,good],[{ok:null},{ok:null},{ok:null}])]);
 assert.deepEqual(m,{dependencies:2,healthyDependencies:0,attempted:3,successful:2,expected:6,rate:66.7});
 assert.equal(monitoringMetrics([]).rate,null);
});

test('freshness boundary preserves fresh health and warns at two hours', () => {
 const t = '2026-11-25T15:00:00Z', now = Date.parse(t), sites = [site([good,good,good])];
 assert.equal(currentSystemSummary(sites,t,now+STALE_AFTER_MS-1).health,'up');
 const stale = currentSystemSummary(sites,t,now+STALE_AFTER_MS);
 assert.equal(stale.health,'warn'); assert.equal(stale.headline,'Monitoring overdue'); assert.equal(stale.healthy,1);
});
test('invalid or implausibly future timestamps cannot report current health', () => {
 const now = Date.parse('2026-11-25T15:00:00Z'), sites = [site([good,good,good])];
 for (const t of [undefined, 'invalid', '2026-11-25T16:00:00Z']) assert.equal(currentSystemSummary(sites,t,now).health,'warn');
});
test('fresh critical results remain critical; stale results are historical', () => {
 const t = '2026-11-25T15:00:00Z', now = Date.parse(t), sites = [site([bad,bad,bad])];
 assert.equal(currentSystemSummary(sites,t,now).health,'down');
 assert.equal(currentSystemSummary(sites,t,now+STALE_AFTER_MS).headline,'Monitoring overdue');
});
