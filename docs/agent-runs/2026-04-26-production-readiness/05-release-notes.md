# Release Notes

## Release Scope
- DropMail production-readiness release candidate for anonymous temporary mail.

## User-facing Changes
- Mailboxes last 1 hour and cannot be extended.
- Users can copy the address, refresh inbox, read sanitized messages, copy OTP/link, and download clean scanned attachments.
- Public Privacy, Terms, and Abuse pages are available.

## Backend / API Changes
- Added provider-neutral inbound webhook with HMAC verification.
- Added attachment validation, ClamAV scanning, S3/MinIO object storage, signed attachment download URLs, cleanup, and Prometheus metrics.
- Added protected admin cleanup and metrics visibility.

## Database / Migration Changes
- Added Prisma schema and migration for mailboxes, messages, inbound events, rate-limit events, admin sessions, domains, and attachments.

## Configuration Changes
- Added Dockerfile, Docker Compose, Nginx config, Cloudflare Email Worker, GitHub Actions deployment, and production env example.

## Verification
- `npm run test:build` passed.
- Worker syntax, compose config, and diff whitespace checks passed.
- Playwright smoke passed earlier in release check; final rerun pending due local escalation limit.

## Known Issues
- Dependency audit pending.
- Target-environment smoke and live Cloudflare inbound test still required.

## Rollback Notes
- Roll back by setting `DROPMAIL_IMAGE` to the previous immutable GHCR `sha-*` tag and running Compose pull/up for the app.
