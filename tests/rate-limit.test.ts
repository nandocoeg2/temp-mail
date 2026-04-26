import { describe, expect, it } from "vitest";
import { createInMemoryRepository } from "@/lib/server/in-memory-repository";
import { createMailboxService } from "@/lib/server/mailbox-service";
import { fixedClock } from "./test-support";

describe("rate limiting", () => {
  it("limits mailbox creation per client bucket", async () => {
    const clock = fixedClock("2026-04-26T10:00:00.000Z");
    const service = createMailboxService({
      repository: createInMemoryRepository(clock),
      clock,
      appDomain: "dropmail.test",
      createLimit: 2
    });

    await service.createMailbox("203.0.113.10");
    await service.createMailbox("203.0.113.10");

    await expect(service.createMailbox("203.0.113.10")).rejects.toMatchObject({
      code: "RATE_LIMITED"
    });
  });
});
