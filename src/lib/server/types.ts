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

export type AttachmentScanStatus = "clean" | "infected" | "skipped";

export type AttachmentRecord = {
  id: string;
  messageId: string;
  mailboxId: string;
  filename: string;
  contentType: string;
  size: number;
  objectKey: string;
  scanStatus: AttachmentScanStatus;
  scanSignature: string | null;
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
  createAttachments: (attachments: AttachmentRecord[]) => Promise<void>;
  listMessages: (mailboxId: string) => Promise<MessageRecord[]>;
  findMessage: (mailboxId: string, messageId: string) => Promise<MessageRecord | null>;
  listAttachments: (messageId: string) => Promise<AttachmentRecord[]>;
  findAttachment: (messageId: string, attachmentId: string) => Promise<AttachmentRecord | null>;
  listAttachmentObjectKeysForMailboxesExpiredBefore: (cutoff: Date) => Promise<string[]>;
  deleteMessagesForMailboxesExpiredBefore: (cutoff: Date) => Promise<number>;
  recordInboundEvent: (event: InboundEventRecord) => Promise<void>;
  listInboundEvents: (limit: number) => Promise<InboundEventRecord[]>;
  recordRateLimitEvent: (event: RateLimitEventRecord) => Promise<void>;
  countRateLimitEvents: (bucket: string, action: string, since: Date) => Promise<number>;
  listRateLimitEvents: (limit: number) => Promise<RateLimitEventRecord[]>;
  countMailboxes: () => Promise<number>;
  countMessages: () => Promise<number>;
  countActiveMailboxes: () => Promise<number>;
  countAttachments: () => Promise<number>;
  countMailboxesByDomain: () => Promise<{ domain: string; count: number }[]>;
  countMessagesByDomain: () => Promise<{ domain: string; count: number }[]>;
  countMessagesBySenderDomain: () => Promise<{ domain: string; count: number }[]>;
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
  attachments: AttachmentSummary[];
};

export type AttachmentSummary = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  scanStatus: AttachmentScanStatus;
};
