import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import {
  attachmentObjectKey,
  prepareAttachment,
  type AttachmentScanner,
  type AttachmentStorage
} from "./attachments";
import { DomainError } from "./domain-error";
import { productionMetrics } from "./metrics";
import { sanitizeEmailHtml, normalizeEmailText } from "./sanitize-email";
import { createToken, hashBucket, hashToken, verifyToken } from "./tokens";
import type {
  Clock,
  MailboxRecord,
  MailboxRepository,
  MailboxStatus,
  MailboxSummary,
  MessageDetail,
  MessageSummary
} from "./types";

const MAILBOX_DURATION_MS = 60 * 60 * 1000;
const RETENTION_DELAY_MS = 24 * 60 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const MAX_TEXT_LENGTH = 100_000;
const MAX_SUBJECT_LENGTH = 300;
const CREATE_MAILBOX_ACTION = "create_mailbox";

const inboundMessageSchema = z.object({
  from: z.string().email().max(320),
  to: z.string().email().max(320),
  subject: z.string().max(MAX_SUBJECT_LENGTH).default(""),
  text: z.string().max(MAX_TEXT_LENGTH).default(""),
  html: z.string().max(MAX_TEXT_LENGTH).default(""),
  attachments: z
    .array(
      z.object({
        filename: z.string().min(1).max(180),
        contentType: z.string().min(1).max(120),
        contentBase64: z.string().min(1)
      })
    )
    .max(10)
    .default([])
});

export type MailboxServiceOptions = {
  repository: MailboxRepository;
  clock: Clock;
  appDomains: string[];
  createLimit?: number;
  attachmentScanner?: AttachmentScanner;
  attachmentStorage?: AttachmentStorage;
};

export type InboundMessageInput = z.input<typeof inboundMessageSchema>;

export function createMailboxService(options: MailboxServiceOptions) {
  const createLimit = options.createLimit ?? 20;

  async function createMailbox(clientId: string): Promise<MailboxSummary> {
    await enforceCreateLimit(clientId);

    const now = options.clock.now();
    const token = createToken();
    const mailbox: MailboxRecord = {
      id: randomUUID(),
      address: await createUniqueAddress(),
      tokenHash: hashToken(token),
      expiresAt: new Date(now.getTime() + MAILBOX_DURATION_MS),
      createdAt: now,
      lastExtendedAt: null,
      messageCount: 0
    };

    await options.repository.createMailbox(mailbox);
    productionMetrics.mailboxCreated(mailbox.address.split("@")[1]);
    return serializeMailbox(mailbox, token, options.clock.now());
  }

  async function getMailbox(id: string, token: string): Promise<MailboxSummary> {
    const mailbox = await requireMailbox(id, token);
    return serializeMailbox(mailbox, token, options.clock.now());
  }

  async function extendMailbox(id: string, token: string): Promise<MailboxSummary> {
    await requireActiveMailbox(id, token);
    throw new DomainError("EXTEND_DISABLED", "Mailbox extension is disabled in production", 410);
  }

  async function listMessages(id: string, token: string): Promise<MessageSummary[]> {
    await requireActiveMailbox(id, token);
    const messages = await options.repository.listMessages(id);
    return messages.map((message) => ({
      id: message.id,
      sender: message.sender,
      recipient: message.recipient,
      subject: message.subject,
      receivedAt: message.receivedAt
    }));
  }

  async function getMessage(id: string, token: string, messageId: string): Promise<MessageDetail> {
    await requireActiveMailbox(id, token);
    const message = await options.repository.findMessage(id, messageId);
    if (!message) {
      throw new DomainError("MESSAGE_NOT_FOUND", "Message not found", 404);
    }
    const attachments = await options.repository.listAttachments(message.id);

    return {
      id: message.id,
      sender: message.sender,
      recipient: message.recipient,
      subject: message.subject,
      receivedAt: message.receivedAt,
      textBody: message.textBody,
      htmlBody: message.htmlBody,
      attachments: attachments.map((attachment) => ({
        id: attachment.id,
        filename: attachment.filename,
        contentType: attachment.contentType,
        size: attachment.size,
        scanStatus: attachment.scanStatus
      }))
    };
  }

  async function createAttachmentDownloadUrl(
    id: string,
    token: string,
    messageId: string,
    attachmentId: string
  ): Promise<{ url: string }> {
    await requireActiveMailbox(id, token);
    const message = await options.repository.findMessage(id, messageId);
    if (!message) {
      throw new DomainError("MESSAGE_NOT_FOUND", "Message not found", 404);
    }
    const attachment = await options.repository.findAttachment(message.id, attachmentId);
    if (!attachment) {
      throw new DomainError("ATTACHMENT_NOT_FOUND", "Attachment not found", 404);
    }
    if (attachment.scanStatus !== "clean" || !options.attachmentStorage) {
      throw new DomainError("ATTACHMENT_UNAVAILABLE", "Attachment is not available for download", 409);
    }
    return { url: await options.attachmentStorage.createDownloadUrl(attachment.objectKey) };
  }

  async function storeInboundMessage(input: InboundMessageInput) {
    const parsed = inboundMessageSchema.safeParse(input);
    if (!parsed.success) {
      throw new DomainError("VALIDATION_FAILED", "Inbound email payload is invalid", 400);
    }

    const mailbox = await options.repository.findMailboxByAddress(parsed.data.to.toLowerCase());
    if (!mailbox) {
      await recordInbound(parsed.data.to, parsed.data.from, "rejected", "unknown_mailbox");
      productionMetrics.inboundRejected("unknown_mailbox");
      return { status: "rejected" as const, reason: "unknown_mailbox" as const };
    }
    if (statusOf(mailbox, options.clock.now()) === "expired") {
      await recordInbound(parsed.data.to, parsed.data.from, "rejected", "expired_mailbox");
      productionMetrics.inboundRejected("expired_mailbox");
      return { status: "rejected" as const, reason: "expired_mailbox" as const };
    }

    const preparedAttachments = parsed.data.attachments.map(prepareAttachment);

    const message = {
      id: randomUUID(),
      mailboxId: mailbox.id,
      sender: normalizeEmailText(parsed.data.from, 320),
      recipient: normalizeEmailText(parsed.data.to.toLowerCase(), 320),
      subject: normalizeEmailText(parsed.data.subject, MAX_SUBJECT_LENGTH),
      textBody: normalizeEmailText(parsed.data.text, MAX_TEXT_LENGTH),
      htmlBody: sanitizeEmailHtml(parsed.data.html || `<pre>${escapeHtml(parsed.data.text)}</pre>`),
      receivedAt: options.clock.now(),
      createdAt: options.clock.now()
    };

    const attachmentRecords = [];
    if (preparedAttachments.length > 0 && options.attachmentStorage) {
      for (const attachment of preparedAttachments) {
        if (options.attachmentScanner) {
          const scan = await options.attachmentScanner.scan(attachment);
          productionMetrics.attachmentScanned(scan.status);
          if (scan.status !== "clean") {
            throw new DomainError("ATTACHMENT_REJECTED", "Attachment failed malware scan", 400);
          }
        }
        const attachmentId = randomUUID();
        const key = attachmentObjectKey(mailbox.id, message.id, attachmentId, attachment.filename);
        const stored = await options.attachmentStorage.put({
          key,
          filename: attachment.filename,
          contentType: attachment.contentType,
          bytes: attachment.bytes
        });
        attachmentRecords.push({
          id: attachmentId,
          messageId: message.id,
          mailboxId: mailbox.id,
          filename: attachment.filename,
          contentType: attachment.contentType,
          size: stored.size,
          objectKey: stored.key,
          scanStatus: options.attachmentScanner ? "clean" as const : "skipped" as const,
          scanSignature: null,
          createdAt: options.clock.now()
        });
      }
    }

    await options.repository.createMessage(message);
    if (attachmentRecords.length > 0) {
      await options.repository.createAttachments(attachmentRecords);
    }
    await recordInbound(parsed.data.to, parsed.data.from, "accepted", null);
    productionMetrics.inboundAccepted(parsed.data.to.split("@")[1]);
    return { status: "accepted" as const, messageId: message.id };
  }

  async function cleanupExpiredContent(): Promise<number> {
    const cutoff = new Date(options.clock.now().getTime() - RETENTION_DELAY_MS);
    if (options.attachmentStorage) {
      const objectKeys =
        await options.repository.listAttachmentObjectKeysForMailboxesExpiredBefore(cutoff);
      if (objectKeys.length > 0) {
        await options.attachmentStorage.deleteMany(objectKeys);
      }
    }
    const deleted = await options.repository.deleteMessagesForMailboxesExpiredBefore(cutoff);
    productionMetrics.cleanupDeleted(deleted);
    return deleted;
  }

  async function adminMetrics() {
    const [mailboxes, messages, inboundEvents, rateLimitEvents] = await Promise.all([
      options.repository.countMailboxes(),
      options.repository.countMessages(),
      options.repository.listInboundEvents(10),
      options.repository.listRateLimitEvents(10)
    ]);

    return { mailboxes, messages, inboundEvents, rateLimitEvents };
  }

  async function requireMailbox(id: string, token: string): Promise<MailboxRecord> {
    const mailbox = await options.repository.findMailboxById(id);
    if (!mailbox) {
      throw new DomainError("MAILBOX_NOT_FOUND", "Mailbox not found", 404);
    }
    if (!verifyToken(token, mailbox.tokenHash)) {
      throw new DomainError("UNAUTHORIZED", "Mailbox token is invalid", 401);
    }
    return mailbox;
  }

  async function requireActiveMailbox(id: string, token: string): Promise<MailboxRecord> {
    const mailbox = await requireMailbox(id, token);
    if (statusOf(mailbox, options.clock.now()) === "expired") {
      throw new DomainError("MAILBOX_EXPIRED", "Mailbox expired", 410);
    }
    return mailbox;
  }

  async function enforceCreateLimit(clientId: string): Promise<void> {
    const bucket = hashBucket(clientId);
    const since = new Date(options.clock.now().getTime() - RATE_LIMIT_WINDOW_MS);
    const recent = await options.repository.countRateLimitEvents(bucket, CREATE_MAILBOX_ACTION, since);
    await options.repository.recordRateLimitEvent({
      id: randomUUID(),
      bucket,
      action: CREATE_MAILBOX_ACTION,
      createdAt: options.clock.now()
    });
    if (recent >= createLimit) {
      productionMetrics.rateLimited(CREATE_MAILBOX_ACTION);
      throw new DomainError("RATE_LIMITED", "Too many mailbox requests. Try again later.", 429);
    }
  }

  async function createUniqueAddress(): Promise<string> {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const localPart = randomBytes(5).toString("hex");
      const domain = options.appDomains[Math.floor(Math.random() * options.appDomains.length)];
      const address = `${localPart}@${domain}`.toLowerCase();
      if (!(await options.repository.findMailboxByAddress(address))) {
        return address;
      }
    }
    throw new DomainError("VALIDATION_FAILED", "Unable to allocate mailbox address", 500);
  }

  async function recordInbound(
    recipient: string,
    sender: string,
    status: "accepted" | "rejected",
    reason: string | null
  ): Promise<void> {
    await options.repository.recordInboundEvent({
      id: randomUUID(),
      recipient: recipient.toLowerCase(),
      sender,
      status,
      reason,
      receivedAt: options.clock.now()
    });
  }

  return {
    createMailbox,
    getMailbox,
    extendMailbox,
    listMessages,
    getMessage,
    createAttachmentDownloadUrl,
    storeInboundMessage,
    cleanupExpiredContent,
    adminMetrics
  };
}

function serializeMailbox(mailbox: MailboxRecord, token: string, now: Date): MailboxSummary {
  return {
    id: mailbox.id,
    token,
    address: mailbox.address,
    expiresAt: mailbox.expiresAt,
    status: statusOf(mailbox, now)
  };
}

function statusOf(mailbox: MailboxRecord, now: Date): MailboxStatus {
  return mailbox.expiresAt > now ? "active" : "expired";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
