import { startPolling } from './polling.js';
import { SLOW_AFTER_MS, PULSE_COUNT, labels, average, dependencyHealth, applicationHealth, diagnostic, aggregateHttp, elapsed, currentSystemSummary, monitoringMetrics } from './health.js';
const $ = id => document.getElementById(id);
const date = v => Number.isFinite(Date.parse(v)) ? `${new Date(v).toLocaleString()} (${elapsed(v)})` : 'Not yet checked';
let lastCheck = null, modalCheck, selectedDependency, lastSnapshot, lastSites;
function updateBanner() {
  if (!lastSites) return;
  const summary = currentSystemSummary(lastSites, lastCheck);
  $('system-headline').textContent = summary.headline;
  $('system-message').textContent = summary.message;
  $('hero-status').setAttribute('class', `hero-indicator ${summary.health}`);
}
function updateTimes() {
  updateBanner();
  if (lastCheck !== null) $('sync').textContent = lastCheck ? `Last check: ${date(lastCheck)}` : 'Monitoring not configured';
  if ($('pulse-dialog').open) $('pulse-time').textContent = `Last check: ${date(modalCheck)} · Slow threshold: ${SLOW_AFTER_MS} ms`;
}
setInterval(updateTimes, 1000);
const latency = v => Number.isFinite(v) ? `${v} ms` : '—';
function showPulses(site, check) {
  const dialog = $('pulse-dialog');
  const pulses = check.pulses || [];
  $('pulse-title').textContent = `${site.name} / ${check.name}`;
  $('pulse-summary').textContent = pulses.length ? `${pulses.filter(p => p.ok === true).length}/${pulses.length} successful · Avg. successful response: ${latency(average(pulses))}` : 'No individual pulse results available.';
  modalCheck = site.lastCheck;
  $('pulse-time').textContent = `Last check: ${date(modalCheck)} · Slow threshold: ${SLOW_AFTER_MS} ms`;
  const body = $('pulse-results');
  body.replaceChildren();
  Array.from({length: PULSE_COUNT}, (_, i) => pulses[i] || {ok:null}).forEach((pulse, i) => {
    const row = body.insertRow();
    const cls = pulse.ok === false ? 'down' : pulse.ok === true && Number.isFinite(pulse.latencyMs) && pulse.latencyMs <= SLOW_AFTER_MS ? 'up' : 'warn';
    const label = pulse.ok === false ? 'Failed' : pulse.ok === true ? (cls === 'warn' ? 'Slow' : 'Passed') : '—';
    row.insertCell().textContent = `Pulse ${i + 1}`;
    const status = row.insertCell();
    status.className = `dependency-status ${cls}`;
    status.textContent = pulse.ok === null ? '—' : label;
    row.insertCell().textContent = pulse.httpStatus ?? '—';
    row.insertCell().textContent = latency(pulse.latencyMs);
    row.insertCell().textContent = pulses[i] ? diagnostic(pulse) : 'No result';
  });
  selectedDependency = { siteId: site.id, checkId: check.id };
  if (!dialog.open) dialog.showModal();
}
$('pulse-close').addEventListener('click', () => $('pulse-dialog').close());
$('pulse-dialog').addEventListener('close', () => {
  if (selectedDependency) {
    const { siteId, checkId } = selectedDependency;
    const link = [...document.querySelectorAll('.dependency-link')].find(b => b.dataset.siteId === siteId && b.dataset.checkId === checkId);
    link?.focus({ preventScroll: true });
  }
  selectedDependency = undefined;
});
function render(data) {
  const sites = data.sites || [];
  $('total').textContent = sites.length;
  lastSites = sites;
  lastCheck = data.generatedAt || undefined;
  const summary = currentSystemSummary(sites, lastCheck);
  $('healthy').textContent = summary.healthy + ' / ' + sites.length;
  const metrics = monitoringMetrics(sites);
  $('dependencies').textContent = `${metrics.healthyDependencies} / ${metrics.dependencies}`;
  $('pulse-rate').textContent = metrics.rate === null ? '—' : `${metrics.rate}%`;
  $('pulse-count').textContent = metrics.attempted ? `${metrics.successful} of ${metrics.attempted} successful${metrics.attempted < metrics.expected ? ' · Incomplete' : ''}` : 'No completed pulses';
  updateTimes();
  const list = $('services');
  const focused = document.activeElement?.closest('.dependency-link');
  list.replaceChildren();
  sites.forEach(site => {
    const cls = applicationHealth(site), label = labels[cls];
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
      const color = dependencyHealth(check.pulses), status = labels[color];
      const row = body.insertRow();
      const name = row.insertCell();
      const details = document.createElement('button');
      details.type = 'button'; details.className = 'dependency-link';
      details.textContent = check.name;
      details.dataset.siteId = site.id;
      details.dataset.checkId = check.id;
      details.setAttribute('aria-label', `View pulse details for ${site.name} / ${check.name}`);
      details.addEventListener('click', () => showPulses(site, check));
      name.append(details);
      row.addEventListener('click', e => { if (!e.target.closest('button')) showPulses(site, check); });
      const cell = row.insertCell(); cell.className = `dependency-status ${color}`;
      cell.textContent = status;
      row.insertCell().textContent = aggregateHttp(check.pulses);
      row.insertCell().textContent = latency(average(check.pulses || []));
    }
    card.append(top,title,table); list.append(card);
  });
  if ($('pulse-dialog').open && selectedDependency) {
    const site = sites.find(s => s.id === selectedDependency.siteId);
    const check = site?.checks?.find(c => c.id === selectedDependency.checkId);
    if (check) showPulses(site, check);
    else $('pulse-dialog').close();
  } else if (focused) {
    [...list.querySelectorAll('.dependency-link')].find(b => b.dataset.siteId === focused.dataset.siteId && b.dataset.checkId === focused.dataset.checkId)?.focus({ preventScroll: true });
  }
}
async function load(){
  try{const r=await fetch(`data/status.json?t=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw Error(`HTTP ${r.status}`);const data = await r.json(); const snapshot = JSON.stringify(data); if (snapshot !== lastSnapshot) { render(data); lastSnapshot = snapshot; }}
  catch(e){lastSites = undefined; lastSnapshot = undefined; if ($('pulse-dialog').open) $('pulse-dialog').close(); lastCheck = null; $('services').replaceChildren();$('healthy').textContent='—';$('total').textContent='—';$('dependencies').textContent='—';$('pulse-rate').textContent='—';$('pulse-count').textContent='No results available';$('sync').textContent='Unable to load monitoring results';$('system-headline').textContent='Monitoring unavailable';$('system-message').textContent='The latest results could not be loaded.';$('hero-status').setAttribute('class','hero-indicator warn');console.error(e);}
}
startPolling(load);

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

