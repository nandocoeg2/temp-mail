import { describe, expect, it } from "vitest";

describe("Cloudflare Email Worker MIME parsing", () => {
  it("allows enough raw email headroom for a max-size attachment encoded in MIME", async () => {
    // @ts-expect-error Worker source is plain JavaScript.
    const { DEFAULT_MAX_EMAIL_BYTES } = await import("../cloudflare/email-worker/src/index.js");
    const maxDecodedAttachmentBytes = 5 * 1024 * 1024;
    const mimeBase64Bytes = Math.ceil(maxDecodedAttachmentBytes / 3) * 4;

    expect(DEFAULT_MAX_EMAIL_BYTES).toBeGreaterThan(mimeBase64Bytes + 32 * 1024);
  });

  it("forwards attachments as provider-neutral base64 payload fields", async () => {
    // @ts-expect-error Worker source is plain JavaScript.
    const { parseMime } = await import("../cloudflare/email-worker/src/index.js");
    const raw = [
      "From: Sender <sender@example.com>",
      "To: inbox@dropmail.test",
      "Subject: Document",
      'Content-Type: multipart/mixed; boundary="dropmail-boundary"',
      "",
      "--dropmail-boundary",
      "Content-Type: text/plain; charset=utf-8",
      "",
      "See attachment",
      "--dropmail-boundary",
      "Content-Type: text/plain",
      'Content-Disposition: attachment; filename="code.txt"',
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from("hello world").toString("base64"),
      "--dropmail-boundary--",
      ""
    ].join("\r\n");

    const parsed = parseMime(raw, "");

    expect(parsed.text).toBe("See attachment");
    expect(parsed.attachments).toEqual([
      {
        filename: "code.txt",
        contentType: "text/plain",
        contentBase64: Buffer.from("hello world").toString("base64")
      }
    ]);
  });
});
