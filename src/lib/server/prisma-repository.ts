import type { PrismaClient } from "@prisma/client";
import type {
  AttachmentRecord,
  InboundEventRecord,
  MailboxRecord,
  MailboxRepository,
  MessageRecord,
  RateLimitEventRecord
} from "./types";

export function createPrismaRepository(prisma: PrismaClient): MailboxRepository {
  return {
    async createMailbox(mailbox) {
      await prisma.mailbox.create({
        data: {
          id: mailbox.id,
          address: mailbox.address,
          tokenHash: mailbox.tokenHash,
          expiresAt: mailbox.expiresAt,
          createdAt: mailbox.createdAt,
          lastExtendedAt: mailbox.lastExtendedAt,
          messageCount: mailbox.messageCount
        }
      });
    },
    async findMailboxById(id) {
      const mailbox = await prisma.mailbox.findUnique({ where: { id } });
      return mailbox ? toMailbox(mailbox) : null;
    },
    async findMailboxByAddress(address) {
      const mailbox = await prisma.mailbox.findUnique({ where: { address } });
      return mailbox ? toMailbox(mailbox) : null;
    },
    async updateMailbox(mailbox) {
      await prisma.mailbox.update({
        where: { id: mailbox.id },
        data: {
          expiresAt: mailbox.expiresAt,
          lastExtendedAt: mailbox.lastExtendedAt,
          messageCount: mailbox.messageCount
        }
      });
    },
    async createMessage(message) {
      await prisma.$transaction([
        prisma.message.create({
          data: {
            id: message.id,
            mailboxId: message.mailboxId,
            sender: message.sender,
            recipient: message.recipient,
            subject: message.subject,
            textBody: message.textBody,
            htmlBody: message.htmlBody,
            receivedAt: message.receivedAt,
            createdAt: message.createdAt
          }
        }),
        prisma.mailbox.update({
          where: { id: message.mailboxId },
          data: { messageCount: { increment: 1 } }
        })
      ]);
    },
    async createAttachments(attachments) {
      if (attachments.length === 0) return;
      await prisma.attachment.createMany({
        data: attachments.map((attachment) => ({
          id: attachment.id,
          messageId: attachment.messageId,
          mailboxId: attachment.mailboxId,
          filename: attachment.filename,
          contentType: attachment.contentType,
          size: attachment.size,
          objectKey: attachment.objectKey,
          scanStatus: attachment.scanStatus,
          scanSignature: attachment.scanSignature,
          createdAt: attachment.createdAt
        }))
      });
    },
    async listMessages(mailboxId) {
      const messages = await prisma.message.findMany({
        where: { mailboxId },
        orderBy: { receivedAt: "desc" }
      });
      return messages.map(toMessage);
    },
    async findMessage(mailboxId, messageId) {
      const message = await prisma.message.findFirst({ where: { mailboxId, id: messageId } });
      return message ? toMessage(message) : null;
    },
    async listAttachments(messageId) {
      const attachments = await prisma.attachment.findMany({
        where: { messageId },
        orderBy: { createdAt: "asc" }
      });
      return attachments.map(toAttachment);
    },
    async findAttachment(messageId, attachmentId) {
      const attachment = await prisma.attachment.findFirst({ where: { id: attachmentId, messageId } });
      return attachment ? toAttachment(attachment) : null;
    },
    async listAttachmentObjectKeysForMailboxesExpiredBefore(cutoff) {
      const attachments = await prisma.attachment.findMany({
        where: {
          mailbox: {
            expiresAt: { lte: cutoff }
          }
        },
        select: { objectKey: true }
      });
      return attachments.map((attachment) => attachment.objectKey);
    },
    async deleteMessagesForMailboxesExpiredBefore(cutoff) {
      const result = await prisma.message.deleteMany({
        where: {
          mailbox: {
            expiresAt: { lte: cutoff }
          }
        }
      });
      return result.count;
    },
    async recordInboundEvent(event) {
      await prisma.inboundEvent.create({
        data: {
          id: event.id,
          recipient: event.recipient,
          sender: event.sender,
          status: event.status,
          reason: event.reason,
          receivedAt: event.receivedAt
        }
      });
    },
    async listInboundEvents(limit) {
      const events = await prisma.inboundEvent.findMany({
        orderBy: { receivedAt: "desc" },
        take: limit
      });
      return events.map(toInboundEvent);
    },
    async recordRateLimitEvent(event) {
      await prisma.rateLimitEvent.create({
        data: {
          id: event.id,
          bucket: event.bucket,
          action: event.action,
          createdAt: event.createdAt
        }
      });
    },
    async countRateLimitEvents(bucket, action, since) {
      return prisma.rateLimitEvent.count({
        where: {
          bucket,
          action,
          createdAt: { gte: since }
        }
      });
    },
    async listRateLimitEvents(limit) {
      const events = await prisma.rateLimitEvent.findMany({
        orderBy: { createdAt: "desc" },
        take: limit
      });
      return events.map(toRateLimitEvent);
    },
    async countMailboxes() {
      return prisma.mailbox.count();
    },
    async countMessages() {
      return prisma.message.count();
    },
    async countActiveMailboxes() {
      return prisma.mailbox.count({ where: { expiresAt: { gt: new Date() } } });
    },
    async countAttachments() {
      return prisma.attachment.count();
    },
    async countMailboxesByDomain() {
      const rows = await prisma.$queryRaw<{ domain: string; count: bigint }[]>`
        SELECT split_part(address, '@', 2) AS domain, COUNT(*)::bigint AS count
        FROM mailboxes GROUP BY domain`;
      return rows.map(r => ({ domain: r.domain, count: Number(r.count) }));
    },
    async countMessagesByDomain() {
      const rows = await prisma.$queryRaw<{ domain: string; count: bigint }[]>`
        SELECT split_part(recipient, '@', 2) AS domain, COUNT(*)::bigint AS count
        FROM messages GROUP BY domain`;
      return rows.map(r => ({ domain: r.domain, count: Number(r.count) }));
    },
    async countMessagesBySenderDomain() {
      const rows = await prisma.$queryRaw<{ domain: string; count: bigint }[]>`
        SELECT split_part(sender, '@', 2) AS domain, COUNT(*)::bigint AS count
        FROM messages GROUP BY domain ORDER BY count DESC`;
      return rows.map(r => ({ domain: r.domain, count: Number(r.count) }));
    }
  };
}

function toMailbox(row: {
  id: string;
  address: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  lastExtendedAt: Date | null;
  messageCount: number;
}): MailboxRecord {
  return {
    id: row.id,
    address: row.address,
    tokenHash: row.tokenHash,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    lastExtendedAt: row.lastExtendedAt,
    messageCount: row.messageCount
  };
}

function toMessage(row: {
  id: string;
  mailboxId: string;
  sender: string;
  recipient: string;
  subject: string;
  textBody: string;
  htmlBody: string;
  receivedAt: Date;
  createdAt: Date;
}): MessageRecord {
  return { ...row };
}

function toAttachment(row: {
  id: string;
  messageId: string;
  mailboxId: string;
  filename: string;
  contentType: string;
  size: number;
  objectKey: string;
  scanStatus: string;
  scanSignature: string | null;
  createdAt: Date;
}): AttachmentRecord {
  return {
    ...row,
    scanStatus: row.scanStatus === "infected" ? "infected" : "clean"
  };
}

function toInboundEvent(row: {
  id: string;
  recipient: string;
  sender: string;
  status: string;
  reason: string | null;
  receivedAt: Date;
}): InboundEventRecord {
  return {
    ...row,
    status: row.status === "accepted" ? "accepted" : "rejected"
  };
}

function toRateLimitEvent(row: {
  id: string;
  bucket: string;
  action: string;
  createdAt: Date;
}): RateLimitEventRecord {
  return { ...row };
}
