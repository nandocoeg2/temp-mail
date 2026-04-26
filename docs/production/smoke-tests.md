# DropMail Production Smoke Tests

Run these checks before a production release and after any infrastructure change that can affect routing, storage, inbound mail, cleanup, authentication, or abuse controls.

## Build and Unit Checks

1. Install dependencies from the locked package set.
2. Run the unit test suite:

   ```bash
   npm run test
   ```

3. Run the production build:

   ```bash
   npm run build
   ```

The build should complete without type, route, or rendering errors. Unit tests should cover mailbox creation, the fixed 1-hour mailbox window, inbound processing, rate limiting, cleanup, attachment handling, and metrics.

## Playwright Browser Smoke

Run the Playwright smoke suite against a local server or a deployed environment.

Local server managed by Playwright:

```bash
npx playwright test tests/e2e/dropmail.smoke.spec.ts
```

Existing server or deployed URL:

```bash
PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://example.test npx playwright test tests/e2e/dropmail.smoke.spec.ts
```

The browser smoke should verify that the homepage renders the temporary address tool, Privacy/Terms/Abuse pages are reachable from public navigation, and unauthenticated admin metrics requests are rejected.

## API Smoke

Use a non-production mailbox domain or a dedicated smoke environment when possible.

1. Create a mailbox with `POST /api/mailboxes`.
2. Confirm the response includes an address, token, active status, and an expiry close to one hour from creation.
3. Request `GET /api/mailboxes/{id}/messages` with the mailbox bearer token and confirm it returns a message list.
4. Request admin metrics without credentials:

   ```bash
   curl -i https://example.test/api/admin/metrics
   ```

   The response should be `401 Unauthorized`.

5. Request Prometheus metrics against the app container or private network without the metrics token and confirm the response is unauthorized:

   ```bash
   curl -i http://app:3000/metrics
   ```

6. Request Prometheus metrics against the same private target with the configured bearer token and confirm the metrics payload renders:

   ```bash
   curl -H "Authorization: Bearer $METRICS_TOKEN" http://app:3000/metrics
   ```

## Synthetic Inbound Webhook

Run a signed inbound webhook request using a mailbox created for the smoke test. Use the configured inbound webhook secret and a unique message ID.

1. Create a JSON payload with `messageId`, `to`, `from`, `subject`, `text`, `html`, and optional attachment metadata.
2. Sign the raw payload with the same HMAC SHA-256 scheme used by the inbound provider.
3. Send it to `POST /api/inbound/email` with the signature header.
4. Refresh `GET /api/mailboxes/{id}/messages` and confirm the synthetic message appears.
5. Fetch the message detail and confirm HTML is sanitized, text is readable, links or OTPs are extracted when present, and unsafe attachments are blocked or marked according to scanner results.

Remove or let the smoke mailbox expire after the test. Message cleanup should remove temporary message data after 24 hours, while full database backups follow the 3-day retention window.
