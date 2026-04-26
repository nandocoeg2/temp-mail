import { Pool } from "pg";
import type {
  InboundEventRecord,
  MailboxRecord,
  MailboxRepository,
  MessageRecord,
  RateLimitEventRecord
} from "./types";

export function createPostgresRepository(pool: Pool): MailboxRepository {
  return {
    async createMailbox(mailbox) {
      await pool.query(
        `INSERT INTO mailboxes (id, address, token_hash, expires_at, created_at, last_extended_at, message_count)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          mailbox.id,
          mailbox.address,
          mailbox.tokenHash,
          mailbox.expiresAt,
          mailbox.createdAt,
          mailbox.lastExtendedAt,
          mailbox.messageCount
        ]
      );
    },
    async findMailboxById(id) {
      const result = await pool.query("SELECT * FROM mailboxes WHERE id = $1", [id]);
      return result.rows[0] ? toMailbox(result.rows[0]) : null;
    },
    async findMailboxByAddress(address) {
      const result = await pool.query("SELECT * FROM mailboxes WHERE address = $1", [address]);
      return result.rows[0] ? toMailbox(result.rows[0]) : null;
    },
    async updateMailbox(mailbox) {
      await pool.query(
        `UPDATE mailboxes
         SET expires_at = $2, last_extended_at = $3, message_count = $4
         WHERE id = $1`,
        [mailbox.id, mailbox.expiresAt, mailbox.lastExtendedAt, mailbox.messageCount]
      );
    },
    async createMessage(message) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          `INSERT INTO messages (id, mailbox_id, sender, recipient, subject, text_body, html_body, received_at, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            message.id,
            message.mailboxId,
            message.sender,
            message.recipient,
            message.subject,
            message.textBody,
            message.htmlBody,
            message.receivedAt,
            message.createdAt
          ]
        );
        await client.query("UPDATE mailboxes SET message_count = message_count + 1 WHERE id = $1", [
          message.mailboxId
        ]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    async listMessages(mailboxId) {
      const result = await pool.query(
        `SELECT * FROM messages WHERE mailbox_id = $1 ORDER BY received_at DESC`,
        [mailboxId]
      );
      return result.rows.map(toMessage);
    },
    async findMessage(mailboxId, messageId) {
      const result = await pool.query(
        `SELECT * FROM messages WHERE mailbox_id = $1 AND id = $2`,
        [mailboxId, messageId]
      );
      return result.rows[0] ? toMessage(result.rows[0]) : null;
    },
    async deleteMessagesForMailboxesExpiredBefore(cutoff) {
      const result = await pool.query(
        `DELETE FROM messages
         WHERE mailbox_id IN (SELECT id FROM mailboxes WHERE expires_at <= $1)`,
        [cutoff]
      );
      return result.rowCount ?? 0;
    },
    async recordInboundEvent(event) {
      await pool.query(
        `INSERT INTO inbound_events (id, recipient, sender, status, reason, received_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [event.id, event.recipient, event.sender, event.status, event.reason, event.receivedAt]
      );
    },
    async listInboundEvents(limit) {
      const result = await pool.query(
        `SELECT * FROM inbound_events ORDER BY received_at DESC LIMIT $1`,
        [limit]
      );
      return result.rows.map(toInboundEvent);
    },
    async recordRateLimitEvent(event) {
      await pool.query(
        `INSERT INTO rate_limit_events (id, bucket, action, created_at)
         VALUES ($1, $2, $3, $4)`,
        [event.id, event.bucket, event.action, event.createdAt]
      );
    },
    async countRateLimitEvents(bucket, action, since) {
      const result = await pool.query(
        `SELECT COUNT(*)::int AS count
         FROM rate_limit_events
         WHERE bucket = $1 AND action = $2 AND created_at >= $3`,
        [bucket, action, since]
      );
      return result.rows[0]?.count ?? 0;
    },
    async listRateLimitEvents(limit) {
      const result = await pool.query(
        `SELECT * FROM rate_limit_events ORDER BY created_at DESC LIMIT $1`,
        [limit]
      );
      return result.rows.map(toRateLimitEvent);
    },
    async countMailboxes() {
      const result = await pool.query("SELECT COUNT(*)::int AS count FROM mailboxes");
      return result.rows[0]?.count ?? 0;
    },
    async countMessages() {
      const result = await pool.query("SELECT COUNT(*)::int AS count FROM messages");
      return result.rows[0]?.count ?? 0;
    }
  };
}

function toMailbox(row: Record<string, unknown>): MailboxRecord {
  return {
    id: String(row.id),
    address: String(row.address),
    tokenHash: String(row.token_hash),
    expiresAt: new Date(String(row.expires_at)),
    createdAt: new Date(String(row.created_at)),
    lastExtendedAt: row.last_extended_at ? new Date(String(row.last_extended_at)) : null,
    messageCount: Number(row.message_count)
  };
}

function toMessage(row: Record<string, unknown>): MessageRecord {
  return {
    id: String(row.id),
    mailboxId: String(row.mailbox_id),
    sender: String(row.sender),
    recipient: String(row.recipient),
    subject: String(row.subject),
    textBody: String(row.text_body),
    htmlBody: String(row.html_body),
    receivedAt: new Date(String(row.received_at)),
    createdAt: new Date(String(row.created_at))
  };
}

function toInboundEvent(row: Record<string, unknown>): InboundEventRecord {
  return {
    id: String(row.id),
    recipient: String(row.recipient),
    sender: String(row.sender),
    status: row.status === "accepted" ? "accepted" : "rejected",
    reason: row.reason ? String(row.reason) : null,
    receivedAt: new Date(String(row.received_at))
  };
}

function toRateLimitEvent(row: Record<string, unknown>): RateLimitEventRecord {
  return {
    id: String(row.id),
    bucket: String(row.bucket),
    action: String(row.action),
    createdAt: new Date(String(row.created_at))
  };
}
