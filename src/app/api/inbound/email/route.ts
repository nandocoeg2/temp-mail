import { z } from "zod";
import { DomainError } from "@/lib/server/domain-error";
import { verifyInboundSignature } from "@/lib/server/inbound-signature";
import { MAX_INBOUND_PAYLOAD_BYTES } from "@/lib/server/inbound-limits";
import { jsonError, jsonOk } from "@/lib/server/http";
import { getMailboxService } from "@/lib/server/service-provider";

const inboundRequestSchema = z.object({
  from: z.string(),
  to: z.string(),
  subject: z.string().optional().default(""),
  text: z.string().optional().default(""),
  html: z.string().optional().default(""),
  attachments: z
    .array(
      z.object({
        filename: z.string(),
        contentType: z.string(),
        contentBase64: z.string()
      })
    )
    .optional()
    .default([])
});

export async function POST(request: Request) {
  try {
    const secret = process.env.INBOUND_WEBHOOK_SECRET;
    if (!secret) {
      throw new DomainError("WEBHOOK_NOT_CONFIGURED", "Inbound webhook is not configured", 503);
    }

    const payload = await request.text();
    if (Buffer.byteLength(payload, "utf8") > MAX_INBOUND_PAYLOAD_BYTES) {
      throw new DomainError("PAYLOAD_TOO_LARGE", "Inbound email payload is too large", 413);
    }

    const signature =
      request.headers.get("x-dropmail-signature") || request.headers.get("x-webhook-signature");
    if (!verifyInboundSignature(payload, signature, secret)) {
      throw new DomainError("WEBHOOK_UNAUTHORIZED", "Inbound webhook signature is invalid", 401);
    }

    let decoded: unknown;
    try {
      decoded = JSON.parse(payload);
    } catch {
      throw new DomainError("VALIDATION_FAILED", "Inbound email payload is invalid JSON", 400);
    }

    const parsed = inboundRequestSchema.safeParse(decoded);
    if (!parsed.success) {
      throw new DomainError("VALIDATION_FAILED", "Inbound email payload is invalid", 400);
    }

    const result = await getMailboxService().storeInboundMessage(parsed.data);
    return jsonOk(result, { status: result.status === "accepted" ? 202 : 200 });
  } catch (error) {
    return jsonError(error);
  }
}
