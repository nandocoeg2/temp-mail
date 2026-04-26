import { describe, expect, it } from "vitest";
import { MAX_ATTACHMENT_BYTES } from "@/lib/server/attachments";
import { MAX_INBOUND_PAYLOAD_BYTES } from "@/lib/server/inbound-limits";

describe("inbound payload limits", () => {
  it("allows enough JSON payload headroom for one max-size base64 attachment", () => {
    const maxAttachmentAsBase64 = Math.ceil(MAX_ATTACHMENT_BYTES / 3) * 4;

    expect(MAX_INBOUND_PAYLOAD_BYTES).toBeGreaterThan(maxAttachmentAsBase64 + 32 * 1024);
  });
});
