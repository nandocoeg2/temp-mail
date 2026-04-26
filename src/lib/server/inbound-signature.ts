import { createHmac, timingSafeEqual } from "node:crypto";

export function signInboundPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function verifyInboundSignature(payload: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret) {
    return false;
  }

  const expected = Buffer.from(signInboundPayload(payload, secret), "hex");
  const actual = Buffer.from(signature.replace(/^sha256=/, ""), "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
