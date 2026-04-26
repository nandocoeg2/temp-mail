# DropMail Production Runbook

This runbook covers the VPS Docker Compose target, GitHub Actions deployment, Cloudflare Email Routing Worker, backups, and monitoring.

## Runtime Topology

- `nginx`: public reverse proxy on ports 80/443. It redirects HTTP to HTTPS, preserves proxy headers, limits request bodies to 8 MB, and blocks public metrics endpoints.
- `app`: Next.js DropMail container from GHCR.
- `postgres`: Docker Postgres 16 managed by Prisma migrations.
- `minio`: S3-compatible object storage for attachment-ready deployments.
- `clamav`: malware scanning service exposed only on the private Compose network.
- `minio-init`: one-shot bucket and lifecycle initialization.

## Required VPS Files

Create these on the VPS in the app directory:

- `.env.production`: copy from `.env.production.example` and replace every placeholder.
- `nginx/certs/fullchain.pem` and `nginx/certs/privkey.pem`: TLS certificate and key, normally issued by Certbot or copied from the host certificate store.
- `backups/postgres/`: local backup target mounted into the Postgres container.

Run all Compose commands with:

```sh
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.prod.yml <command>
```

## Required Environment Variables

Application:

- `APP_DOMAIN`: public DropMail domain, `fjulian.space` for this deployment.
- `INBOUND_WEBHOOK_SECRET`: 32+ random bytes shared with the Cloudflare Email Worker.
- `METRICS_TOKEN`: bearer token required by `/metrics` and `/api/internal/metrics`.
- `ADMIN_USERNAME`: admin dashboard username.
- `ADMIN_PASSWORD`: strong admin dashboard password.

Postgres:

- `POSTGRES_DB`: database name.
- `POSTGRES_USER`: application database user.
- `POSTGRES_PASSWORD`: strong database password.

MinIO:

- `MINIO_ROOT_USER`: MinIO root/access key.
- `MINIO_ROOT_PASSWORD`: strong MinIO secret key.
- `MINIO_BUCKET`: private bucket name.
- `MINIO_RETENTION_DAYS`: fallback object expiry policy in days. Default is 1; app cleanup should normally delete attachment objects first.
- `S3_REGION`: S3 client region. Use `us-east-1` for MinIO unless you have a reason to change it.
- `CLAMAV_TIMEOUT_MS`: attachment scan timeout in milliseconds.

Deployment:

- `DROPMAIL_IMAGE`: immutable GHCR image tag, for example `ghcr.io/org/repo/dropmail:sha-<commit>`.
- `HTTP_PORT`: public HTTP port, normally `80`.
- `HTTPS_PORT`: public HTTPS port, normally `443`.

GitHub repository secrets:

- `VPS_HOST`: VPS hostname or IP.
- `VPS_USER`: SSH user.
- `VPS_SSH_KEY`: private key for deployment.
- `VPS_SSH_PORT`: SSH port. Use `22` if unset.
- `VPS_APP_DIR`: app directory containing the Compose files and `.env.production`.

## DNS and Cloudflare Setup

1. Point `APP_DOMAIN` to the VPS:
   - `A` record for IPv4.
   - `AAAA` record for IPv6 if available.
2. Use Cloudflare proxy mode only after TLS works end to end. For strict TLS, install a valid origin certificate on the VPS.
3. Enable Email Routing for the zone.
4. Deploy the Worker in `cloudflare/email-worker`.
5. In Cloudflare Email Routing, route the desired mailbox or catch-all address to `dropmail-email-worker`.
6. Set the Worker secret:

```sh
cd cloudflare/email-worker
npx wrangler secret put INBOUND_WEBHOOK_SECRET
npx wrangler deploy
```

Use the same secret value as the app's `INBOUND_WEBHOOK_SECRET`.

## First Deployment

On the VPS:

```sh
cp .env.production.example .env.production
mkdir -p nginx/certs backups/postgres
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.prod.yml pull
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.prod.yml up -d postgres minio clamav minio-init
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.prod.yml run --rm app npm run db:migrate
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.prod.yml up -d --remove-orphans
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.prod.yml ps
```

The GitHub Actions workflow updates `DROPMAIL_IMAGE` in `.env.production`, pulls the immutable image, starts dependencies, runs `npm run db:migrate`, and then runs `up -d --remove-orphans`.

## Content Cleanup

Mailbox access expires after 1 hour. Message bodies and attachment metadata are retained only for the cleanup delay and should be deleted within 24 hours. Configure an hourly host cron to call the protected cleanup endpoint:

```sh
15 * * * * curl -fsS -u "$ADMIN_USERNAME:$ADMIN_PASSWORD" -X POST "https://$APP_DOMAIN/api/admin/cleanup" >/dev/null
```

Keep this cron on the VPS or an internal scheduler. Do not expose cleanup or metrics endpoints without the admin or metrics auth boundary.

## Rollback

Rollback is image-tag based.

1. SSH to the VPS.
2. Set `DROPMAIL_IMAGE` in `.env.production` to the previous `sha-*` tag.
3. Pull and restart the app:

```sh
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.prod.yml pull app
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.prod.yml up -d app
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.prod.yml logs --tail=100 app
```

If the deployment changed environment variables, restore `.env.production.previous` created by the workflow before running the same commands.

## Database Backups

Keep full database backups for 3 days.

Suggested daily cron on the VPS:

```sh
0 2 * * * cd /opt/dropmail && docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.prod.yml exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > backups/postgres/dropmail-$(date +\%Y\%m\%d-\%H\%M\%S).dump && find backups/postgres -name 'dropmail-*.dump' -mtime +3 -delete
```

Restore drill:

```sh
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.prod.yml exec -T postgres pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists < backups/postgres/<backup>.dump
```

Run restore drills on a non-production copy before relying on the procedure.

## MinIO Lifecycle Cleanup

`minio-init` creates the bucket and applies an expiry rule using `MINIO_RETENTION_DAYS`. To re-apply manually:

```sh
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.prod.yml run --rm minio-init
```

Check lifecycle policy:

```sh
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.prod.yml run --rm minio-init mc ilm rule ls "dropmail/$MINIO_BUCKET"
```

## Monitoring and Alerts

Prometheus should scrape private or authenticated endpoints only. Nginx blocks public `/metrics`, `/api/internal/metrics`, and `/api/admin/metrics`; the app also requires `METRICS_TOKEN` as either `Authorization: Bearer <token>` or `X-Metrics-Token` before rendering `/metrics` or `/api/internal/metrics` on the private app target.

Recommended alerts routed through Grafana Alerting to Telegram:

- App availability: HTTP probe to `https://APP_DOMAIN/` fails for 2 minutes.
- Inbound webhook failures: Worker logs show repeated non-2xx responses for `/api/inbound/email`.
- Postgres availability: `pg_isready` fails for 2 minutes.
- Disk pressure: filesystem usage exceeds 80%, critical at 90%.
- Backup freshness: no `backups/postgres/dropmail-*.dump` modified in the last 26 hours.
- TLS expiry: certificate expires within 14 days.
- ClamAV freshness: virus definitions older than 24 hours.

Telegram setup in Grafana:

1. Create a Telegram bot with BotFather.
2. Add the bot token and chat ID as a Grafana contact point.
3. Route production alerts to that contact point.
4. Send a test notification before enabling alert rules.

## Operational Checks

After every deployment:

```sh
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.prod.yml ps
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.prod.yml logs --tail=100 app nginx
curl -fsS https://$APP_DOMAIN/ >/dev/null
```

For inbound email, send a test message through the Cloudflare-routed address and confirm the mailbox receives it in the UI.
