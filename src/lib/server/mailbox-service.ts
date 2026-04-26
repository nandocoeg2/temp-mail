import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { DomainError } from "./domain-error";
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

const MAILBOX_DURATION_MS = 10 * 60 * 1000;
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
  html: z.string().max(MAX_TEXT_LENGTH).default("")
});

export type MailboxServiceOptions = {
  repository: MailboxRepository;
  clock: Clock;
  appDomain: string;
  createLimit?: number;
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
    return serializeMailbox(mailbox, token, options.clock.now());
  }

  async function getMailbox(id: string, token: string): Promise<MailboxSummary> {
    const mailbox = await requireMailbox(id, token);
    return serializeMailbox(mailbox, token, options.clock.now());
  }

  async function extendMailbox(id: string, token: string): Promise<MailboxSummary> {
    const mailbox = await requireActiveMailbox(id, token);
    const now = options.clock.now();
    const base = Math.max(now.getTime(), mailbox.expiresAt.getTime());
    const updated: MailboxRecord = {
      ...mailbox,
      expiresAt: new Date(base + MAILBOX_DURATION_MS),
      lastExtendedAt: now
    };

    await options.repository.updateMailbox(updated);
    return serializeMailbox(updated, token, options.clock.now());
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

    return {
      id: message.id,
      sender: message.sender,
      recipient: message.recipient,
      subject: message.subject,
      receivedAt: message.receivedAt,
      textBody: message.textBody,
      htmlBody: message.htmlBody
    };
  }

  async function storeInboundMessage(input: InboundMessageInput) {
    const parsed = inboundMessageSchema.safeParse(input);
    if (!parsed.success) {
      throw new DomainError("VALIDATION_FAILED", "Inbound email payload is invalid", 400);
    }

    const mailbox = await options.repository.findMailboxByAddress(parsed.data.to.toLowerCase());
    if (!mailbox) {
      await recordInbound(parsed.data.to, parsed.data.from, "rejected", "unknown_mailbox");
      return { status: "rejected" as const, reason: "unknown_mailbox" as const };
    }
    if (statusOf(mailbox, options.clock.now()) === "expired") {
      await recordInbound(parsed.data.to, parsed.data.from, "rejected", "expired_mailbox");
      return { status: "rejected" as const, reason: "expired_mailbox" as const };
    }

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

    await options.repository.createMessage(message);
    await recordInbound(parsed.data.to, parsed.data.from, "accepted", null);
    return { status: "accepted" as const, messageId: message.id };
  }

  async function cleanupExpiredContent(): Promise<number> {
    const cutoff = new Date(options.clock.now().getTime() - RETENTION_DELAY_MS);
    return options.repository.deleteMessagesForMailboxesExpiredBefore(cutoff);
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
      throw new DomainError("RATE_LIMITED", "Too many mailbox requests. Try again later.", 429);
    }
  }

  async function createUniqueAddress(): Promise<string> {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const localPart = randomBytes(5).toString("hex");
      const address = `${localPart}@${options.appDomain}`.toLowerCase();
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
