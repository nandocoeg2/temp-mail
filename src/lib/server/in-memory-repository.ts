import type {
  Clock,
  InboundEventRecord,
  MailboxRecord,
  MailboxRepository,
  MessageRecord,
  RateLimitEventRecord
} from "./types";

export function createInMemoryRepository(clock: Clock): MailboxRepository {
  const mailboxes = new Map<string, MailboxRecord>();
  const messages = new Map<string, MessageRecord>();
  const inboundEvents: InboundEventRecord[] = [];
  const rateLimitEvents: RateLimitEventRecord[] = [];

  return {
    async createMailbox(mailbox) {
      mailboxes.set(mailbox.id, cloneMailbox(mailbox));
    },
    async findMailboxById(id) {
      const mailbox = mailboxes.get(id);
      return mailbox ? cloneMailbox(mailbox) : null;
    },
    async findMailboxByAddress(address) {
      const mailbox = [...mailboxes.values()].find((candidate) => candidate.address === address);
      return mailbox ? cloneMailbox(mailbox) : null;
    },
    async updateMailbox(mailbox) {
      mailboxes.set(mailbox.id, cloneMailbox(mailbox));
    },
    async createMessage(message) {
      messages.set(message.id, cloneMessage(message));
      const mailbox = mailboxes.get(message.mailboxId);
      if (mailbox) {
        mailbox.messageCount += 1;
        mailboxes.set(mailbox.id, mailbox);
      }
    },
    async listMessages(mailboxId) {
      return [...messages.values()]
        .filter((message) => message.mailboxId === mailboxId)
        .sort((left, right) => right.receivedAt.getTime() - left.receivedAt.getTime())
        .map(cloneMessage);
    },
    async findMessage(mailboxId, messageId) {
      const message = messages.get(messageId);
      return message?.mailboxId === mailboxId ? cloneMessage(message) : null;
    },
    async deleteMessagesForMailboxesExpiredBefore(cutoff) {
      const expiredMailboxIds = new Set(
        [...mailboxes.values()]
          .filter((mailbox) => mailbox.expiresAt <= cutoff)
          .map((mailbox) => mailbox.id)
      );
      let deleted = 0;
      for (const [id, message] of messages.entries()) {
        if (expiredMailboxIds.has(message.mailboxId)) {
          messages.delete(id);
          deleted += 1;
        }
      }
      return deleted;
    },
    async recordInboundEvent(event) {
      inboundEvents.unshift({ ...event, receivedAt: new Date(event.receivedAt) });
    },
    async listInboundEvents(limit) {
      return inboundEvents.slice(0, limit).map((event) => ({
        ...event,
        receivedAt: new Date(event.receivedAt)
      }));
    },
    async recordRateLimitEvent(event) {
      rateLimitEvents.unshift({ ...event, createdAt: new Date(event.createdAt) });
    },
    async countRateLimitEvents(bucket, action, since) {
      return rateLimitEvents.filter(
        (event) => event.bucket === bucket && event.action === action && event.createdAt >= since
      ).length;
    },
    async listRateLimitEvents(limit) {
      return rateLimitEvents.slice(0, limit).map((event) => ({
        ...event,
        createdAt: new Date(event.createdAt)
      }));
    },
    async countMailboxes() {
      return mailboxes.size;
    },
    async countMessages() {
      return messages.size;
    }
  };
}

function cloneMailbox(mailbox: MailboxRecord): MailboxRecord {
  return {
    ...mailbox,
    expiresAt: new Date(mailbox.expiresAt),
    createdAt: new Date(mailbox.createdAt),
    lastExtendedAt: mailbox.lastExtendedAt ? new Date(mailbox.lastExtendedAt) : null
  };
}

function cloneMessage(message: MessageRecord): MessageRecord {
  return {
    ...message,
    receivedAt: new Date(message.receivedAt),
    createdAt: new Date(message.createdAt)
  };
}
