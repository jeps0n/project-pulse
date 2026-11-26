export const POLL_INTERVAL_MS = 60000;

export function startPolling(load, page = document, schedule = setInterval) {
  let running = false;
  async function refresh() {
    if (running || page.hidden)
      return;
    running = true;
    try {
      await load();
    }
    finally {
      running = false;
    }
  }
  page.addEventListener('visibilitychange', refresh);
  schedule(refresh, POLL_INTERVAL_MS);
  void refresh();
}
