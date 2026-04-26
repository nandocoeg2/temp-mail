# Release Scope

## Verdict
- Project Manager: Approve with concern

## Included
- Fixed 1-hour anonymous mailbox lifetime with extension disabled.
- Prisma/Postgres production data model and migration path.
- Signed inbound webhook handling with oversized payload rejection.
- Attachment allowlist, 5 MB decoded limit, ClamAV scanning, private S3/MinIO storage, signed download URLs, and UI download actions.
- Prometheus-style metrics with bearer token protection.
- Cloudflare Email Routing Worker, Docker Compose VPS runtime, Nginx TLS proxy, GitHub Actions deploy workflow, and production runbooks.
- Public legal pages for Privacy, Terms, and Abuse.
- Playwright smoke coverage for homepage, legal navigation, and admin auth.

## Excluded
- Login-based public accounts.
- Sending/replying email.
- Multi-domain admin UI.
- CAPTCHA/Turnstile runtime challenge flow.
- Browsing user message bodies from admin.

## Migrations / Config / Manual Steps
- Run `npm run db:migrate` before app rollout.
- Configure `.env.production` from `.env.production.example`.
- Configure Cloudflare Email Routing Worker with `INBOUND_WEBHOOK_SECRET`.
- Provide TLS files in `nginx/certs/`.
- Configure hourly cleanup cron for `/api/admin/cleanup`.
- Configure Prometheus to scrape private `/metrics` with `METRICS_TOKEN`.

## Risks
- Dependency audit was not completed in this session because network audit escalation was interrupted/blocked.
- Final Playwright rerun after the attachment UI patch could not be executed due platform escalation limit, although the same smoke suite passed earlier in this release check.
