export type Clock = {
  now: () => Date;
};

export type MailboxStatus = "active" | "expired";

export type MailboxRecord = {
  id: string;
  address: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  lastExtendedAt: Date | null;
  messageCount: number;
};

export type MessageRecord = {
  id: string;
  mailboxId: string;
  sender: string;
  recipient: string;
  subject: string;
  textBody: string;
  htmlBody: string;
  receivedAt: Date;
  createdAt: Date;
};

export type InboundEventRecord = {
  id: string;
  recipient: string;
  sender: string;
  status: "accepted" | "rejected";
  reason: string | null;
  receivedAt: Date;
};

export type RateLimitEventRecord = {
  id: string;
  bucket: string;
  action: string;
  createdAt: Date;
};

export type MailboxRepository = {
  createMailbox: (mailbox: MailboxRecord) => Promise<void>;
  findMailboxById: (id: string) => Promise<MailboxRecord | null>;
  findMailboxByAddress: (address: string) => Promise<MailboxRecord | null>;
  updateMailbox: (mailbox: MailboxRecord) => Promise<void>;
  createMessage: (message: MessageRecord) => Promise<void>;
  listMessages: (mailboxId: string) => Promise<MessageRecord[]>;
  findMessage: (mailboxId: string, messageId: string) => Promise<MessageRecord | null>;
  deleteMessagesForMailboxesExpiredBefore: (cutoff: Date) => Promise<number>;
  recordInboundEvent: (event: InboundEventRecord) => Promise<void>;
  listInboundEvents: (limit: number) => Promise<InboundEventRecord[]>;
  recordRateLimitEvent: (event: RateLimitEventRecord) => Promise<void>;
  countRateLimitEvents: (bucket: string, action: string, since: Date) => Promise<number>;
  listRateLimitEvents: (limit: number) => Promise<RateLimitEventRecord[]>;
  countMailboxes: () => Promise<number>;
  countMessages: () => Promise<number>;
};

export type MailboxSummary = {
  id: string;
  token: string;
  address: string;
  expiresAt: Date;
  status: MailboxStatus;
};

export type MessageSummary = {
  id: string;
  sender: string;
  recipient: string;
  subject: string;
  receivedAt: Date;
};

export type MessageDetail = MessageSummary & {
  textBody: string;
  htmlBody: string;
};
