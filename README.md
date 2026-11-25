# Project Pulse

A compact, read-only API and dependency health dashboard. **Not a portfolio page.**

## Run locally in VS Code (Windows / PowerShell)

Requires Node.js 20+; no npm install needed.

```powershell
npm run monitor
npm run dev
```

Open http://localhost:5178. Initially all checks show **Warning / Not configured** until you supply endpoints. Never show fake healthy data.

## Configure checks

Set environment variables in your PowerShell terminal before running `npm run monitor`, or configure GitHub Actions repository secrets:

| Variable | Purpose |
|---|---|
| `RESORT_AZURE_HEALTH_URL` | Public, read-only Azure Function health endpoint (must not require a private function key in URL) |
| `RESORT_SUPABASE_URL` | Resort Ops Supabase project URL |
| `RESORT_SUPABASE_ANON_KEY` | Resort Ops publishable/anon API key; **never service-role key** |
| `QUEST_SUPABASE_URL` | Quest of Fortune Supabase project URL |
| `QUEST_SUPABASE_ANON_KEY` | Quest of Fortune publishable/anon API key; **never service-role key** |

The Supabase check calls `/rest/v1/` using the anon/publishable key. This tests the project's REST API gateway availability, **not direct database connectivity or every business operation**. It can reveal paused/unavailable projects but cannot always identify the precise cause. Do not place secrets in `config/services.json` or frontend files.

The Azure health endpoint should return HTTP 2xx only when the Azure API itself is reachable, independently of Supabase. If no endpoint exists yet, the dashboard shows Warning until configured.

## Project structure

- `src/` — **dashboard UI** (`index.html`, `css/styles.css`, `js/app.js`) and generated public status data. Future micro-UI edits should touch only these source files.
- `monitor/` — Node.js monitoring worker; `scripts/` contains the local static server.
- `config/services.json` — monitor definitions; references environment variable names, not credentials.
- `.github/workflows/` — scheduled checks and GitHub Pages deployment.
- `Dockerfile` — portable Node.js monitoring worker.
- `tests/` — basic check tests.

GitHub Actions is manual-only until cloud allowances are verified. Once a schedule is approved, configure cron, the displayed frequency and the stale threshold together. The workflow publishes a fresh read-only snapshot to GitHub Pages, using the Docker monitoring worker; only the latest snapshot is retained. Statuses: green = all configured checks pass, yellow = missing/slow data, red = check failure. Response time is worker-observed HTTP response time, not browser render time.

**Scope:** no login, alerts, Terraform, Kubernetes, or production changes required. Only health checks.
