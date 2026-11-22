# Claude Instructions — UDCShare API Examples

## Render demo monitoring (TinyFish + Cron-job.org)

- For every new API/backend demo deployed as a Render Web Service, provide a fast, public, unauthenticated health/wake endpoint such as `GET /ping` (or reuse an existing stable `/health`). It must return HTTP 200 without database work, personal data, or secrets.
- After deployment, use TinyFish with the saved Cron-job.org browser profile to create an enabled HTTP GET check against the exact public backend URL, every 2 minutes (`*/2 * * * *`) when the free plan permits. Verify the exact URL, method, interval, and enabled state before reporting completion.
- A periodic ping can reduce Render Free sleeping but cannot guarantee permanent availability.
- Do not create paid Render Cron Jobs for keep-alive, and never purchase or upgrade a plan without explicit authorization.
- Render Static Sites do not sleep like Free Web Services. Do not add a keep-alive job to static pages. Add an optional availability check only when requested, and label it “Availability”, not “Keep Alive”.
- Keep external Cron-job.org HTTP monitoring distinct from application-internal cron tasks.
- Maintain the monitor inventory below whenever a demo is added or changed.

## Monitor inventory

- NOVATECH API — `https://novatech-demo-api-public.onrender.com/ping` — GET — every 2 minutes — enabled in Cron-job.org on 2026-11-22.
- UDCShare API — `https://udcshare-drc-g2qc.onrender.com/ping` — GET — every 2 minutes — pending verification.
- UDCShare Developer Examples — static site `https://udcshare-developer-examples.onrender.com/` — availability check only, not a keep-alive.

## GitHub CI constraint

- The user requested that remote GitHub Actions/tests not be triggered because their GitHub Free quota is exhausted. Prefer local checks and include `[skip ci]` in documentation commit messages.