import { DomainError } from "./domain-error";

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

const ALLOWED_ATTACHMENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "text/plain"
]);

export type InboundAttachmentInput = {
  filename: string;
  contentType: string;
  contentBase64: string;
};

export type PreparedAttachment = {
  filename: string;
  contentType: string;
  bytes: Buffer;
};

export type AttachmentScanResult =
  | { status: "clean" }
  | { status: "infected"; signature: string };

export type AttachmentScanner = {
  scan: (attachment: PreparedAttachment) => Promise<AttachmentScanResult>;
};

export type AttachmentStoragePutInput = {
  key: string;
  filename: string;
  contentType: string;
  bytes: Buffer;
};

export type AttachmentStorage = {
  put: (input: AttachmentStoragePutInput) => Promise<{ key: string; size: number }>;
  createDownloadUrl: (key: string) => Promise<string>;
  deleteMany: (keys: string[]) => Promise<number>;
};

export function prepareAttachment(input: InboundAttachmentInput): PreparedAttachment {
  const filename = input.filename.trim().slice(0, 180);
  const contentType = input.contentType.toLowerCase().trim();
  const bytes = Buffer.from(input.contentBase64, "base64");

  if (!filename || filename.includes("/") || filename.includes("\\")) {
    throw new DomainError("ATTACHMENT_REJECTED", "Attachment filename is not allowed", 400);
  }
  if (!ALLOWED_ATTACHMENT_TYPES.has(contentType)) {
    throw new DomainError("ATTACHMENT_REJECTED", "Attachment type is not allowed", 400);
  }
  if (bytes.length === 0 || bytes.length > MAX_ATTACHMENT_BYTES) {
    throw new DomainError("ATTACHMENT_REJECTED", "Attachment size is not allowed", 400);
  }

  return { filename, contentType, bytes };
}

export function attachmentObjectKey(mailboxId: string, messageId: string, attachmentId: string, filename: string): string {
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${mailboxId}/${messageId}/${attachmentId}/${safeFilename}`;
}
