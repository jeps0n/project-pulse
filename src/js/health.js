export const SLOW_AFTER_MS = 1500;
export const PULSE_COUNT = 3;
export const labels = {
  up: 'Healthy',
  warn: 'Warning',
  down: 'Critical'
};

export function average(pulses) {
  const times = pulses.filter(p => p.ok === true && Number.isFinite(p.latencyMs) && p.latencyMs >= 0).map(p => p.latencyMs);
  return times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null;
}

export function dependencyHealth(pulses = []) {
  if (!Array.isArray(pulses) || pulses.length !== PULSE_COUNT || pulses.some(p => typeof p.ok !== 'boolean'))
    return 'warn';
  const passed = pulses.filter(p => p.ok);
  if (!passed.length)
    return 'down';
  if (passed.length !== PULSE_COUNT || passed.some(p => !Number.isFinite(p.latencyMs) || p.latencyMs < 0))
    return 'warn';
  return average(pulses) > SLOW_AFTER_MS ? 'warn' : 'up';
}

export function worst(states) {
  return states.includes('down') ? 'down' : !states.length || states.some(s => s !== 'up') ? 'warn' : 'up';
}

export function applicationHealth(site) {
  return worst([
    ...(site.checks || []).map(c => dependencyHealth(c.pulses)),
    ...(!Number.isFinite(Date.parse(site.lastCheck)) ? ['warn'] : [])
  ]);
}

export function diagnostic(p) {
  if (p.ok === null)
    return 'Not configured';
  if (p.ok === true)
    return p.latencyMs > SLOW_AFTER_MS ? 'Slow response' : '—';
  if (p.error === 'Invalid HTTPS endpoint')
    return 'Invalid endpoint';
  if (p.error === 'Timeout')
    return 'Timeout';
  const codes = {
    400: 'Bad request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not found',
    429: 'Rate limited',
    500: 'Server error',
    502: 'Bad gateway',
    503: 'Unavailable',
    504: 'Gateway timeout'
  };
  return p.httpStatus == null ? 'Request failed' : codes[p.httpStatus] || 'HTTP error';
}

export function aggregateHttp(pulses = []) {
  const codes = new Set(pulses.map(p => p.httpStatus ?? null));
  return codes.size > 1 ? 'Mixed' : [...codes][0] ?? '—';
}

export function elapsed(value, now = Date.now()) {
  const seconds = Math.max(0, Math.floor((now - Date.parse(value)) / 1000));
  if (!Number.isFinite(seconds))
    return '';
  if (seconds < 5)
    return 'Just now';
  const unit = (n, name) => `${n} ${name}${n === 1 ? '' : 's'}`;
  if (seconds < 60)
    return `${unit(seconds, 'second')} ago`;
  const minutes = Math.floor(seconds / 60), hours = Math.floor(minutes / 60), days = Math.floor(hours / 24);
  return (days ? [
    unit(days, 'day'),
    hours % 24 && unit(hours % 24, 'hour')
  ] : hours ? [
    unit(hours, 'hour'),
    minutes % 60 && unit(minutes % 60, 'minute')
  ] : [unit(minutes, 'minute')]).filter(Boolean).join(', ') + ' ago';
}

export function systemSummary(sites) {
  const states = sites.map(applicationHealth), health = worst(states);
  const critical = states.filter(s => s === 'down').length, warning = states.filter(s => s === 'warn').length;
  const count = (n, state) => `${n} application${n === 1 ? '' : 's'} ${state}`;
  return {
    health,
    healthy: states.filter(s => s === 'up').length,
    headline: critical ? 'Issues detected' : warning ? 'Attention required' : sites.length ? 'All systems operational' : 'No services configured',
    message: critical || warning ? [
      critical && count(critical, 'critical'),
      warning && count(warning, 'requiring attention')
    ].filter(Boolean).join('; ') + '.' : sites.length ? 'All monitored applications are healthy.' : 'Add monitoring targets to begin checking services.'
  };
}

export function monitoringMetrics(sites) {
  const checks = sites.flatMap(site => site.checks || []);
  const pulses = checks.flatMap(check => Array.isArray(check.pulses) ? check.pulses : []);
  const attempted = pulses.filter(p => typeof p.ok === 'boolean').length;
  const successful = pulses.filter(p => p.ok === true).length;
  return {
    dependencies: checks.length,
    healthyDependencies: checks.filter(c => dependencyHealth(c.pulses) === 'up').length,
    attempted,
    successful,
    expected: checks.length * PULSE_COUNT,
    rate: attempted ? Math.round(successful / attempted * 1000) / 10 : null
  };
}

export const STALE_AFTER_MS = 2 * 60 * 60 * 1000;

export function currentSystemSummary(sites, generatedAt, now = Date.now()) {
  const summary = systemSummary(sites);
  const timestamp = Date.parse(generatedAt);
  if (!Number.isFinite(timestamp) || timestamp > now + 60000) {
    return {
      ...summary,
      health: 'warn',
      headline: 'Monitoring unavailable',
      message: 'The latest results have no valid check timestamp.'
    };
  }
  if (now - timestamp >= STALE_AFTER_MS) {
    return {
      ...summary,
      health: 'warn',
      headline: 'Monitoring overdue',
      message: 'Showing last known results. No recent monitoring update.'
    };
  }
  return summary;
}
