import { describe, expect, it } from "vitest";
import { createInMemoryRepository } from "@/lib/server/in-memory-repository";
import { createMailboxService } from "@/lib/server/mailbox-service";
import { fixedClock, advanceClock } from "./test-support";

describe("mailbox service", () => {
  it("creates unique random addresses with token-protected access", async () => {
    const clock = fixedClock("2026-04-26T10:00:00.000Z");
    const service = createMailboxService({
      repository: createInMemoryRepository(clock),
      clock,
      appDomain: "dropmail.test"
    });

    const first = await service.createMailbox("203.0.113.10");
    const second = await service.createMailbox("203.0.113.10");

    expect(first.address).toMatch(/^[a-z0-9]{10}@dropmail\.test$/);
    expect(second.address).toMatch(/^[a-z0-9]{10}@dropmail\.test$/);
    expect(first.address).not.toBe(second.address);
    await expect(service.getMailbox(first.id, "bad-token")).rejects.toMatchObject({
      code: "UNAUTHORIZED"
    });
    await expect(service.getMailbox(first.id, first.token)).resolves.toMatchObject({
      id: first.id,
      address: first.address,
      status: "active"
    });
  });

  it("creates a fixed one hour mailbox and rejects extension attempts", async () => {
    const clock = fixedClock("2026-04-26T10:00:00.000Z");
    const service = createMailboxService({
      repository: createInMemoryRepository(clock),
      clock,
      appDomain: "dropmail.test"
    });
    const mailbox = await service.createMailbox("203.0.113.10");

    expect(mailbox.expiresAt.toISOString()).toBe("2026-04-26T11:00:00.000Z");
    await expect(service.extendMailbox(mailbox.id, mailbox.token)).rejects.toMatchObject({
      code: "EXTEND_DISABLED"
    });
  });

  it("cleans email contents after the retention window", async () => {
    const clock = fixedClock("2026-04-26T10:00:00.000Z");
    const repository = createInMemoryRepository(clock);
    const service = createMailboxService({
      repository,
      clock,
      appDomain: "dropmail.test"
    });
    const mailbox = await service.createMailbox("203.0.113.10");
    await service.storeInboundMessage({
      from: "sender@example.com",
      to: mailbox.address,
      subject: "Code",
      text: "123456",
      html: "<p>123456</p>"
    });

    advanceClock(clock, 25 * 60 * 60 * 1000);
    const deleted = await service.cleanupExpiredContent();

    expect(deleted).toBe(1);
    await expect(service.listMessages(mailbox.id, mailbox.token)).rejects.toMatchObject({
      code: "MAILBOX_EXPIRED"
    });
    expect(await repository.countMessages()).toBe(0);
  });
});
