"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import DOMPurify from "dompurify";
import {
  AlertTriangle,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  Inbox,
  Link2,
  Loader2,
  Mail,
  Paperclip,
  RefreshCw,
  ShieldAlert
} from "lucide-react";

(globalThis as typeof globalThis & { React?: typeof React }).React ??= React;

export type MailboxStatus = "active" | "expired" | "rate_limited" | "error" | "loading";

export type Mailbox = {
  id: string;
  token: string;
  address: string;
  expiresAt: string;
  status: MailboxStatus;
};

export type InboxMessage = {
  id: string;
  sender: string;
  recipient?: string;
  subject: string;
  receivedAt: string;
  preview?: string;
  bodyText?: string;
  bodyHtml?: string;
  sanitizedHtml?: string;
  links?: string[];
  otp?: string;
  attachments?: InboxAttachment[];
};

export type InboxAttachment = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  scanStatus: "clean" | "infected";
};

type InboxClientProps = {
  initialMailbox?: Mailbox | null;
  initialMessages?: InboxMessage[];
};

type UiState = "idle" | "loading" | "rate_limited" | "error";

const fallbackMailbox = (): Mailbox => ({
  id: "local-pending",
  token: "",
  address: "creating@dropmail.local",
  expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
  status: "loading"
});

const formatCountdown = (expiresAt: string) => {
  const remaining = Math.max(0, new Date(expiresAt).getTime() - Date.now());
  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const formatTime = (value: string) =>
  new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric"
  }).format(new Date(value));

const extractOtp = (message?: InboxMessage | null) => {
  if (!message) return "";
  if (message.otp) return message.otp;
  const text = `${message.subject} ${message.preview ?? ""} ${message.bodyText ?? ""}`;
  return text.match(/\b\d{4,8}\b/)?.[0] ?? "";
};

const extractLinks = (message?: InboxMessage | null) => {
  if (!message) return [];
  const text = `${message.preview ?? ""} ${message.bodyText ?? ""}`;
  const parsed = text.match(/https?:\/\/[^\s<>"')]+/g) ?? [];
  return Array.from(new Set([...(message.links ?? []), ...parsed]));
};

export function InboxClient({ initialMailbox, initialMessages = [] }: InboxClientProps) {
  const [mailbox, setMailbox] = useState<Mailbox>(initialMailbox ?? fallbackMailbox);
  const [messages, setMessages] = useState<InboxMessage[]>(initialMessages);
  const [selectedId, setSelectedId] = useState(initialMessages[0]?.id ?? "");
  const [uiState, setUiState] = useState<UiState>(initialMailbox ? "idle" : "loading");
  const [notice, setNotice] = useState("");
  const [nowTick, setNowTick] = useState(Date.now());

  const selectedMessage = messages.find((message) => message.id === selectedId) ?? messages[0] ?? null;
  const expired = mailbox.status === "expired" || new Date(mailbox.expiresAt).getTime() <= nowTick;
  const rateLimited = mailbox.status === "rate_limited" || uiState === "rate_limited";
  const countdown = useMemo(() => formatCountdown(mailbox.expiresAt), [mailbox.expiresAt, nowTick]);
  const otp = extractOtp(selectedMessage);
  const links = extractLinks(selectedMessage);

  const createMailbox = useCallback(async () => {
    setUiState("loading");
    try {
      const response = await fetch("/api/mailboxes", { method: "POST" });
      if (response.status === 429) {
        setUiState("rate_limited");
        setMailbox((current) => ({ ...current, status: "rate_limited" }));
        return;
      }
      if (!response.ok) throw new Error("Mailbox creation failed");
      const payload = (await response.json()) as { mailbox?: Mailbox; messages?: InboxMessage[] } & Mailbox;
      const nextMailbox = payload.mailbox ?? payload;
      setMailbox(nextMailbox);
      setMessages(payload.messages ?? []);
      setSelectedId("");
      setUiState("idle");
    } catch {
      setUiState("error");
      setMailbox((current) => ({ ...current, status: "error" }));
    }
  }, []);

  const refreshInbox = useCallback(async () => {
    if (!mailbox.id || mailbox.id === "local-pending") return;
    setUiState("loading");
    try {
      const response = await fetch(`/api/mailboxes/${encodeURIComponent(mailbox.id)}/messages`, {
        headers: mailbox.token ? { Authorization: `Bearer ${mailbox.token}` } : undefined
      });
      if (response.status === 429) {
        setUiState("rate_limited");
        return;
      }
      if (!response.ok) throw new Error("Inbox refresh failed");
      const payload = (await response.json()) as { messages?: InboxMessage[] } | InboxMessage[];
      const nextMessages = Array.isArray(payload) ? payload : payload.messages ?? [];
      setMessages(nextMessages);
      setSelectedId((current) => current || nextMessages[0]?.id || "");
      setUiState("idle");
    } catch {
      setUiState("error");
    }
  }, [mailbox.id, mailbox.token]);

  const loadMessageDetail = useCallback(
    async (messageId: string) => {
      const existing = messages.find((message) => message.id === messageId);
      if (!existing || existing.bodyHtml || existing.bodyText || mailbox.id === "local-pending") return;

      try {
        const response = await fetch(
          `/api/mailboxes/${encodeURIComponent(mailbox.id)}/messages/${encodeURIComponent(messageId)}`,
          {
            headers: mailbox.token ? { Authorization: `Bearer ${mailbox.token}` } : undefined
          }
        );
        if (!response.ok) throw new Error("Message detail failed");
        const detail = (await response.json()) as {
          id: string;
          sender: string;
          recipient: string;
          subject: string;
          receivedAt: string;
          textBody: string;
          htmlBody: string;
          attachments?: InboxAttachment[];
        };
        setMessages((current) =>
          current.map((message) =>
            message.id === detail.id
              ? {
                  ...message,
                  recipient: detail.recipient,
                  bodyText: detail.textBody,
                  bodyHtml: detail.htmlBody,
                  sanitizedHtml: detail.htmlBody,
                  attachments: detail.attachments ?? []
                }
              : message
          )
        );
      } catch {
        setUiState("error");
      }
    },
    [mailbox.id, mailbox.token, messages]
  );

  const copyValue = useCallback(async (value: string, label: string) => {
    if (!value) return;
    await navigator.clipboard?.writeText(value);
    setNotice(`${label} copied`);
    window.setTimeout(() => setNotice(""), 1800);
  }, []);

  const downloadAttachment = useCallback(
    async (messageId: string, attachment: InboxAttachment) => {
      try {
        const response = await fetch(
          `/api/mailboxes/${encodeURIComponent(mailbox.id)}/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachment.id)}`,
          {
            method: "POST",
            headers: mailbox.token ? { Authorization: `Bearer ${mailbox.token}` } : undefined
          }
        );
        if (!response.ok) throw new Error("Attachment download failed");
        const payload = (await response.json()) as { url: string };
        window.open(payload.url, "_blank", "noopener,noreferrer");
      } catch {
        setUiState("error");
      }
    },
    [mailbox.id, mailbox.token]
  );

  useEffect(() => {
    const interval = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!initialMailbox || mailbox.status === "loading") {
      void createMailbox();
    }
  }, [createMailbox, initialMailbox, mailbox.status]);

  useEffect(() => {
    if (selectedMessage?.id) {
      void loadMessageDetail(selectedMessage.id);
    }
  }, [loadMessageDetail, selectedMessage?.id]);

  return (
    <section className="mail-workspace" aria-label="DropMail mailbox">
      <div className="mailbox-strip">
        <div className="address-block">
          <span className="eyebrow">Anonymous mailbox</span>
          <div className="address-line">
            <Mail aria-hidden="true" size={20} />
            <strong>{mailbox.address}</strong>
          </div>
        </div>
        <div className="mailbox-actions">
          <span className={`status-pill ${expired ? "danger" : rateLimited ? "warning" : ""}`}>
            <Clock3 aria-hidden="true" size={16} />
            {expired ? "Expired" : rateLimited ? "Rate limited" : countdown}
          </span>
          <button className="icon-button" type="button" onClick={() => copyValue(mailbox.address, "Address")} aria-label="Copy address">
            <Copy aria-hidden="true" size={18} />
          </button>
          <button className="icon-button" type="button" onClick={refreshInbox} disabled={expired} aria-label="Refresh inbox">
            <RefreshCw aria-hidden="true" size={18} className={uiState === "loading" ? "spin" : ""} />
          </button>
        </div>
      </div>

      {notice ? <div className="toast" role="status">{notice}</div> : null}
      {uiState === "error" ? <StateBanner tone="danger" icon={<AlertTriangle size={18} />} title="Mailbox service unavailable" text="The UI is ready, but the mailbox API did not respond." /> : null}
      {rateLimited ? <StateBanner tone="warning" icon={<ShieldAlert size={18} />} title="Rate limit reached" text="Pause briefly before creating or refreshing mailboxes." /> : null}
      {expired ? <StateBanner tone="danger" icon={<Clock3 size={18} />} title="Mailbox expired" text="Create a new mailbox to receive more messages." /> : null}

      <div className="inbox-grid">
        <div className="inbox-list" aria-label="Inbox messages">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Inbox</span>
              <h2>{messages.length} message{messages.length === 1 ? "" : "s"}</h2>
            </div>
            {uiState === "loading" ? <Loader2 aria-label="Loading inbox" className="spin muted" size={18} /> : <Inbox className="muted" aria-hidden="true" size={19} />}
          </div>

          {messages.length === 0 ? (
            <div className="empty-state">
              <Inbox aria-hidden="true" size={34} />
              <h3>Waiting for incoming mail</h3>
              <p>Messages sent to this address will appear here without a sign-in.</p>
            </div>
          ) : (
            <ul className="message-list">
              {messages.map((message) => (
                <li key={message.id}>
                  <button
                    className={message.id === selectedMessage?.id ? "message-row selected" : "message-row"}
                    type="button"
                    onClick={() => {
                      setSelectedId(message.id);
                      void loadMessageDetail(message.id);
                    }}
                  >
                    <span className="message-sender">{message.sender}</span>
                    <span className="message-time">{formatTime(message.receivedAt)}</span>
                    <strong>{message.subject || "(No subject)"}</strong>
                    <span>{message.preview || message.bodyText || "Open message"}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <article className="message-detail" aria-label="Email detail">
          {selectedMessage ? (
            <>
              <div className="detail-header">
                <span className="eyebrow">Message</span>
                <h2>{selectedMessage.subject || "(No subject)"}</h2>
                <dl>
                  <div>
                    <dt>From</dt>
                    <dd>{selectedMessage.sender}</dd>
                  </div>
                  <div>
                    <dt>Received</dt>
                    <dd>{formatTime(selectedMessage.receivedAt)}</dd>
                  </div>
                </dl>
              </div>
              <div className="quick-actions">
                <button className="text-button" type="button" onClick={() => copyValue(otp, "OTP")} disabled={!otp}>
                  <Copy aria-hidden="true" size={16} />
                  Copy OTP
                </button>
                <button className="text-button" type="button" onClick={() => copyValue(links[0] ?? "", "Link")} disabled={links.length === 0}>
                  <Link2 aria-hidden="true" size={16} />
                  Copy link
                </button>
                {links[0] ? (
                  <a className="text-button" href={links[0]} target="_blank" rel="noreferrer">
                    <ExternalLink aria-hidden="true" size={16} />
                    Open
                  </a>
                ) : null}
              </div>
              <MessageBody message={selectedMessage} />
              <AttachmentList
                message={selectedMessage}
                onDownload={(attachment) => downloadAttachment(selectedMessage.id, attachment)}
              />
            </>
          ) : (
            <div className="empty-state detail-empty">
              <Mail aria-hidden="true" size={34} />
              <h3>No message selected</h3>
              <p>Select a message when one arrives to view sanitized content and actions.</p>
            </div>
          )}
        </article>
      </div>
    </section>
  );
}

function StateBanner({ tone, icon, title, text }: { tone: "danger" | "warning"; icon: ReactNode; title: string; text: string }) {
  return (
    <div className={`state-banner ${tone}`} role="status">
      {icon}
      <div>
        <strong>{title}</strong>
        <span>{text}</span>
      </div>
    </div>
  );
}

function AttachmentList({
  message,
  onDownload
}: {
  message: InboxMessage;
  onDownload: (attachment: InboxAttachment) => void;
}) {
  const attachments = message.attachments ?? [];
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="attachment-list" aria-label="Attachments">
      <div className="attachment-heading">
        <Paperclip aria-hidden="true" size={16} />
        <strong>Attachments</strong>
      </div>
      {attachments.map((attachment) => (
        <div className="attachment-row" key={attachment.id}>
          <div>
            <strong>{attachment.filename}</strong>
            <span>{formatAttachmentMeta(attachment)}</span>
          </div>
          <button
            className="text-button"
            type="button"
            onClick={() => onDownload(attachment)}
            disabled={attachment.scanStatus !== "clean"}
            aria-label={`Download ${attachment.filename}`}
          >
            <Download aria-hidden="true" size={16} />
            Download
          </button>
        </div>
      ))}
    </div>
  );
}

function MessageBody({ message }: { message: InboxMessage }) {
  const html = message.sanitizedHtml ?? message.bodyHtml;

  if (html) {
    return <div className="message-body" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />;
  }

  return <pre className="message-body text-body">{message.bodyText || message.preview || "This message has no readable body."}</pre>;
}

function formatAttachmentMeta(attachment: InboxAttachment): string {
  const size =
    attachment.size >= 1024 * 1024
      ? `${(attachment.size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.max(1, Math.ceil(attachment.size / 1024))} KB`;
  return `${attachment.contentType} - ${size} - ${attachment.scanStatus}`;
}
