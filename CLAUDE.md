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
- UDCShare API — `https://udcshare-drc-g2qc.onrender.com/ping` — GET — every 2 minutes — enabled; first execution successful on 2026-11-22.
- UDCShare Developer Examples — static site `https://udcshare-developer-examples.onrender.com/` — availability check only, not a keep-alive.

## GitHub CI constraint

- The user requested that remote GitHub Actions/tests not be triggered because their GitHub Free quota is exhausted. Prefer local checks and include `[skip ci]` in documentation commit messages.

## Shared Supabase test database — mandatory
- NOVATECH Supabase project ref: `aptsndwskxgzadmkylmm`. Its existing objects and data must remain intact.
- UDCShare production Supabase ref `eqkwjeaijoqtridbfeen` is strictly out of scope for test/demo services.
- The NOVATECH Developer Playground API uses only schema `developer_test` for its own tables. Set Render env `SUPABASE_DB_SCHEMA=developer_test`; keep Auth endpoints on the same NOVATECH Supabase project. PostgREST table reads use `Accept-Profile`; writes use `Content-Profile`. Engagement RPC functions remain in their existing schema.
- UDCShare test backend uses schema `udcshare_test`, never `developer_test` or the production project.
- Do not move, rename, truncate, delete, or overwrite existing NOVATECH `public.*` tables. The previous `public.userdemo*` tables are retained; new Playground writes belong only to `developer_test.*`.
- Add custom schemas to Supabase Dashboard > API Settings > Exposed schemas before enabling PostgREST calls. Keep RLS enabled and grant only least privilege.
- Future demo apps get their own schema (for example `<app>_test` or `<app>_demo`) and an entry in `platform_registry.applications`.
- Never copy production data, real client API keys, sessions, tokens, Google Drive credentials, or files into test schemas. Never store file binaries in Supabase Storage for UDCShare; use Drive Pool or a dedicated test Drive/mock.
- Do not trigger GitHub Actions or remote tests; the owner's GitHub Free quota is exhausted. Use local checks and commit messages with `[skip ci]`.

## NOVATECH Developer Examples — staging only

- All NOVATECH API Developer Playground examples, demo portals, sample integrations, and their Render deployments must be developed and deployed in the Render project **UDCShare service api développer**, under its **Test** environment (staging).
- Use the Git branch `staging` for this work. Do not deploy these examples from `main`, push their changes to `main`, merge staging into main, or configure a NOVATECH example service to track `main`.
- Keep NOVATECH demo services separate from UDCShare production services. Do not change the Production environment or customer-facing production configuration while working on these examples.
- Promote anything from staging to production only after the owner explicitly reviews and authorizes that specific promotion.
