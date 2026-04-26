# DropMail Cloudflare Email Worker

This Worker receives Cloudflare Email Routing messages and forwards a provider-neutral JSON payload to DropMail:

```json
{
  "from": "sender@example.com",
  "to": "mailbox@fjulian.space",
  "subject": "Subject",
  "text": "Plain text body",
  "html": "<p>HTML body</p>",
  "attachments": [
    {
      "filename": "code.txt",
      "contentType": "text/plain",
      "contentBase64": "aGVsbG8="
    }
  ]
}
```

The JSON body is signed with HMAC SHA-256 and sent in `x-dropmail-signature`. The secret must match `INBOUND_WEBHOOK_SECRET` on the app.
The Worker caps the raw message size at `MAX_EMAIL_BYTES`; the app then enforces per-attachment type, size, ClamAV scan, and private object storage rules.

## Configure

1. Copy `wrangler.jsonc` values for your domain:
   - `APP_INBOUND_URL`: `https://<app-domain>/api/inbound/email`
   - `MAX_EMAIL_BYTES`: default `8388608`, leaving MIME/base64 overhead for the app's 5 MB decoded attachment limit.
2. Set the secret without committing it:

```sh
npx wrangler secret put INBOUND_WEBHOOK_SECRET
```

For local development, copy `.dev.vars.example` to `.dev.vars`.

## Deploy

```sh
npx wrangler deploy
```

In Cloudflare, enable Email Routing for the zone and route the desired custom address or catch-all to `dropmail-email-worker`.
