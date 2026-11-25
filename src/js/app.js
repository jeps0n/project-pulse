'use strict';
const $ = id => document.getElementById(id);
const date = v => v ? new Date(v).toLocaleString() : 'Not yet checked';
// Green = successful, timely check. Yellow = degraded, stale, or missing data. Red = failed check.
// Manual checks until the schedule is approved; no assumed freshness window.
const SLOW_AFTER_MS = 1500;
function state(s) {
  if (!s.checks?.length) return ['Warning', 'warn'];
  if (s.checks.some(c => c.ok === false)) return ['Critical', 'down'];
  if (s.checks.some(c => c.ok !== true) || !s.lastCheck || !Number.isFinite(Date.parse(s.lastCheck))) return ['Warning', 'warn'];
  if (s.checks.some(c => Number.isFinite(c.latencyMs) && c.latencyMs > SLOW_AFTER_MS)) return ['Warning', 'warn'];
  return ['Healthy', 'up'];
}
const latency = v => Number.isFinite(v) ? `${v} ms` : '—';
function render(data) {
  const sites = data.sites || [];
  $('total').textContent = sites.length;
  const states = sites.map(state);
  const healthyCount = states.filter(([, cls]) => cls === 'up').length;
  const redCount = states.filter(([, cls]) => cls === 'down').length;
  const yellowCount = states.filter(([, cls]) => cls === 'warn').length;
  $('healthy').textContent = healthyCount + ' / ' + sites.length;
  $('system-headline').textContent = redCount ? 'Issues detected' : yellowCount ? 'Attention required' : sites.length ? 'All systems operational' : 'No services configured';
  $('system-message').textContent = redCount ? `${redCount} service${redCount === 1 ? '' : 's'} failed the latest check.` : yellowCount ? `${yellowCount} service${yellowCount === 1 ? '' : 's'} need attention. See the application checks below.` : sites.length ? `All ${sites.length} monitored services passed their latest checks.` : 'Add monitoring targets to begin checking services.';
  $('hero-status').className = `hero-indicator ${redCount ? 'down' : yellowCount || !sites.length ? 'warn' : 'up'}`;
  const success = sites.flatMap(s => s.checks || []).filter(c => c.ok === true && Number.isFinite(c.latencyMs));
  $('avg').textContent = success.length ? latency(Math.round(success.reduce((a,s)=>a+s.latencyMs,0)/success.length)) : '—';
  $('sync').textContent = data.generatedAt ? `Last check: ${date(data.generatedAt)}` : 'Monitoring not configured';
  const list = $('services'); list.replaceChildren();
  sites.forEach(site => {
    const [label, cls] = state(site);
    const card = document.createElement('article'); card.className = 'service';
    const top = document.createElement('div'); top.className='service-top';
    const icon = document.createElement('span'); icon.className=`service-indicator ${cls}`; icon.setAttribute('aria-label', label);
    const badge = document.createElement('span'); badge.className=`status ${cls}`; badge.textContent=label;
    top.append(icon,badge);
    const title=document.createElement('h4'); title.textContent=site.name;
    const table = document.createElement('table'); table.className = 'dependency-table';
    const head = table.createTHead().insertRow();
    for (const name of ['DEPENDENCY', 'STATUS', 'HTTP', 'RESPONSE']) {
      const th = document.createElement('th'); th.scope = 'col'; th.textContent = name; head.append(th);
    }
    const body = table.createTBody();
    for (const check of site.checks || []) {
      const [status, color] = state({ checks: [check], lastCheck: site.lastCheck });
      const row = body.insertRow();
      row.insertCell().textContent = check.name;
      const cell = row.insertCell(); cell.className = `dependency-status ${color}`;
      cell.textContent = check.ok == null ? 'Not configured' : status;
      row.insertCell().textContent = check.httpStatus ?? '—';
      row.insertCell().textContent = latency(check.latencyMs);
    }
    card.append(top,title,table); list.append(card);
  });
}
async function load(){
  $('refresh').disabled=true;
  try{const r=await fetch(`data/status.json?t=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw Error(`HTTP ${r.status}`);render(await r.json());}
  catch(e){$('services').replaceChildren();$('healthy').textContent='—';$('avg').textContent='—';$('sync').textContent='Unable to load monitoring results';$('system-headline').textContent='Monitoring unavailable';$('system-message').textContent='The latest results could not be loaded.';$('hero-status').className='hero-indicator warn';console.error(e);}
  finally{$('refresh').disabled=false;}
}
$('refresh').addEventListener('click',load);
load();


(function () {
  const title = document.querySelector('.brand-copy h1');
  const descriptor = document.querySelector('.brand-descriptor');
  if (!title || !descriptor) return;
  function alignBrandLines() {
    descriptor.style.letterSpacing = '0px';
    const target = title.getBoundingClientRect().width;
    const base = descriptor.getBoundingClientRect().width;
    const gaps = Math.max(1, descriptor.textContent.length - 1);
    descriptor.style.letterSpacing = Math.max(0, (target - base) / gaps).toFixed(3) + 'px';
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(alignBrandLines);
  alignBrandLines();
  window.addEventListener('resize', alignBrandLines);
})();

