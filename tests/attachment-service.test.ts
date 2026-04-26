import { describe, expect, it } from "vitest";
import { createInMemoryRepository } from "@/lib/server/in-memory-repository";
import { createMailboxService } from "@/lib/server/mailbox-service";
import type { AttachmentScanner, AttachmentStorage } from "@/lib/server/attachments";
import { fixedClock } from "./test-support";

describe("attachment handling", () => {
  it("stores clean allowlisted small attachments as private downloadable metadata", async () => {
    const clock = fixedClock("2026-04-26T10:00:00.000Z");
    const scanner: AttachmentScanner = {
      scan: async () => ({ status: "clean" })
    };
    const storage: AttachmentStorage = {
      put: async ({ key }) => ({ key, size: 12 }),
      createDownloadUrl: async (key) => `https://objects.example.test/${key}?signed=true`,
      deleteMany: async () => 0
    };
    const service = createMailboxService({
      repository: createInMemoryRepository(clock),
      clock,
      appDomain: "dropmail.test",
      attachmentScanner: scanner,
      attachmentStorage: storage
    });
    const mailbox = await service.createMailbox("203.0.113.10");

    const inbound = await service.storeInboundMessage({
      from: "sender@example.com",
      to: mailbox.address,
      subject: "Document",
      text: "See attachment",
      html: "<p>See attachment</p>",
      attachments: [
        {
          filename: "code.txt",
          contentType: "text/plain",
          contentBase64: Buffer.from("hello world!").toString("base64")
        }
      ]
    });

    expect(inbound.status).toBe("accepted");
    if (inbound.status !== "accepted") throw new Error("expected accepted inbound");
    const message = await service.getMessage(mailbox.id, mailbox.token, inbound.messageId);
    expect(message.attachments).toEqual([
      expect.objectContaining({
        filename: "code.txt",
        contentType: "text/plain",
        size: 12,
        scanStatus: "clean"
      })
    ]);
    const download = await service.createAttachmentDownloadUrl(
      mailbox.id,
      mailbox.token,
      inbound.messageId,
      message.attachments[0].id
    );
    expect(download.url).toContain("signed=true");
  });

  it("rejects disallowed, oversized, or infected attachments before storing message content", async () => {
    const clock = fixedClock("2026-04-26T10:00:00.000Z");
    const service = createMailboxService({
      repository: createInMemoryRepository(clock),
      clock,
      appDomain: "dropmail.test",
      attachmentScanner: { scan: async () => ({ status: "infected", signature: "Eicar-Test" }) },
      attachmentStorage: {
        put: async ({ key }) => ({ key, size: 1 }),
        createDownloadUrl: async (key) => key,
        deleteMany: async () => 0
      }
    });
    const mailbox = await service.createMailbox("203.0.113.10");

    await expect(
      service.storeInboundMessage({
        from: "sender@example.com",
        to: mailbox.address,
        subject: "Bad file",
        text: "bad",
        html: "<p>bad</p>",
        attachments: [
          {
            filename: "malware.exe",
            contentType: "application/x-msdownload",
            contentBase64: Buffer.from("bad").toString("base64")
          }
        ]
      })
    ).rejects.toMatchObject({ code: "ATTACHMENT_REJECTED" });
  });

  it("removes attachment objects when expired message content is cleaned up", async () => {
    const clock = fixedClock("2026-04-26T10:00:00.000Z");
    const deletedKeys: string[][] = [];
    const storage: AttachmentStorage = {
      put: async ({ key }) => ({ key, size: 12 }),
      createDownloadUrl: async (key) => key,
      deleteMany: async (keys) => {
        deletedKeys.push(keys);
        return keys.length;
      }
    };
    const service = createMailboxService({
      repository: createInMemoryRepository(clock),
      clock,
      appDomain: "dropmail.test",
      attachmentScanner: { scan: async () => ({ status: "clean" }) },
      attachmentStorage: storage
    });
    const mailbox = await service.createMailbox("203.0.113.10");

    await service.storeInboundMessage({
      from: "sender@example.com",
      to: mailbox.address,
      subject: "Document",
      text: "See attachment",
      html: "<p>See attachment</p>",
      attachments: [
        {
          filename: "code.txt",
          contentType: "text/plain",
          contentBase64: Buffer.from("hello world!").toString("base64")
        }
      ]
    });
    clock.set(new Date("2026-04-27T11:00:00.000Z"));

    const deletedMessages = await service.cleanupExpiredContent();

    expect(deletedMessages).toBe(1);
    expect(deletedKeys).toHaveLength(1);
    expect(deletedKeys[0][0]).toContain(`${mailbox.id}/`);
  });
});
