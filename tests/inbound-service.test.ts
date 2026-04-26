import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { createInMemoryRepository } from "@/lib/server/in-memory-repository";
import { createMailboxService } from "@/lib/server/mailbox-service";
import { verifyInboundSignature } from "@/lib/server/inbound-signature";
import { fixedClock, advanceClock } from "./test-support";

describe("inbound email flow", () => {
  it("stores sanitized messages for active mailboxes", async () => {
    const clock = fixedClock("2026-04-26T10:00:00.000Z");
    const service = createMailboxService({
      repository: createInMemoryRepository(clock),
      clock,
      appDomain: "dropmail.test"
    });
    const mailbox = await service.createMailbox("203.0.113.10");

    const stored = await service.storeInboundMessage({
      from: "sender@example.com",
      to: mailbox.address,
      subject: "Your login code",
      text: "Use 654321",
      html: '<p>Use <strong>654321</strong></p><script>alert("x")</script>'
    });

    expect(stored.status).toBe("accepted");
    const detail = await service.getMessage(mailbox.id, mailbox.token, stored.messageId);
    expect(detail.htmlBody).toContain("<strong>654321</strong>");
    expect(detail.htmlBody).not.toContain("<script");
  });

  it("rejects inbound messages for expired mailboxes", async () => {
    const clock = fixedClock("2026-04-26T10:00:00.000Z");
    const service = createMailboxService({
      repository: createInMemoryRepository(clock),
      clock,
      appDomain: "dropmail.test"
    });
    const mailbox = await service.createMailbox("203.0.113.10");
    advanceClock(clock, 11 * 60 * 1000);

    const result = await service.storeInboundMessage({
      from: "sender@example.com",
      to: mailbox.address,
      subject: "Late",
      text: "late",
      html: "<p>late</p>"
    });

    expect(result).toMatchObject({ status: "rejected", reason: "expired_mailbox" });
  });

  it("verifies provider-agnostic HMAC webhook signatures", () => {
    const payload = JSON.stringify({ to: "a@dropmail.test" });
    const secret = "test-secret-with-enough-length";
    const signature = createHmac("sha256", secret).update(payload).digest("hex");

    expect(verifyInboundSignature(payload, signature, secret)).toBe(true);
    expect(verifyInboundSignature(payload, "bad-signature", secret)).toBe(false);
  });
});
