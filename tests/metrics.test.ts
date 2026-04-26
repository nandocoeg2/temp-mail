import { describe, expect, it } from "vitest";
import { createMetrics } from "@/lib/server/metrics";
import { GET as getMetrics } from "@/app/metrics/route";

describe("production metrics", () => {
  it("emits Prometheus metrics for mailbox, inbound, rate-limit, cleanup, and attachment scan events", async () => {
    const metrics = createMetrics();

    metrics.mailboxCreated();
    metrics.inboundAccepted();
    metrics.inboundRejected("expired_mailbox");
    metrics.rateLimited("create_mailbox");
    metrics.cleanupDeleted(3);
    metrics.attachmentScanned("clean");

    const output = await metrics.render();

    expect(output).toContain("dropmail_mailbox_created_total 1");
    expect(output).toContain("dropmail_inbound_accepted_total 1");
    expect(output).toContain('dropmail_inbound_rejected_total{reason="expired_mailbox"} 1');
    expect(output).toContain('dropmail_rate_limited_total{action="create_mailbox"} 1');
    expect(output).toContain("dropmail_cleanup_deleted_messages_total 3");
    expect(output).toContain('dropmail_attachment_scan_total{status="clean"} 1');
  });

  it("requires the configured metrics bearer token before rendering Prometheus output", async () => {
    const previousToken = process.env.METRICS_TOKEN;
    process.env.METRICS_TOKEN = "metrics-secret";

    try {
      const unauthorized = await getMetrics(new Request("https://dropmail.test/metrics"));
      const authorized = await getMetrics(
        new Request("https://dropmail.test/metrics", {
          headers: { authorization: "Bearer metrics-secret" }
        })
      );

      expect(unauthorized.status).toBe(401);
      expect(authorized.status).toBe(200);
      expect(authorized.headers.get("content-type")).toContain("text/plain");
    } finally {
      if (previousToken === undefined) {
        delete process.env.METRICS_TOKEN;
      } else {
        process.env.METRICS_TOKEN = previousToken;
      }
    }
  });
});
