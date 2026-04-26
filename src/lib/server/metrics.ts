import type { MailboxRepository } from "./types";

type LabelMap = Record<string, string>;

type Metric = {
  name: string;
  help: string;
  type: "counter" | "gauge";
  values: Map<string, number>;
};

export function createMetrics() {
  const metrics = new Map<string, Metric>();
  let repository: MailboxRepository | null = null;

  function counter(name: string, help: string, amount = 1, labels: LabelMap = {}) {
    const metric = metrics.get(name) ?? { name, help, type: "counter" as const, values: new Map<string, number>() };
    const key = labelKey(labels);
    metric.values.set(key, (metric.values.get(key) ?? 0) + amount);
    metrics.set(name, metric);
  }

  return {
    setRepository: (repo: MailboxRepository) => { repository = repo; },
    mailboxCreated: (domain?: string) => counter("dropmail_mailbox_created_total", "Mailboxes created", 1, domain ? { domain } : {}),
    inboundAccepted: (domain?: string) => counter("dropmail_inbound_accepted_total", "Inbound emails accepted", 1, domain ? { domain } : {}),
    inboundRejected: (reason: string) =>
      counter("dropmail_inbound_rejected_total", "Inbound emails rejected", 1, { reason }),
    rateLimited: (action: string) =>
      counter("dropmail_rate_limited_total", "Rate limited actions", 1, { action }),
    cleanupDeleted: (count: number) =>
      counter("dropmail_cleanup_deleted_messages_total", "Expired messages deleted", count),
    attachmentScanned: (status: string) =>
      counter("dropmail_attachment_scan_total", "Attachment scan results", 1, { status }),
    render: async () => {
      const lines = [...metrics.values()].map((metric) => renderMetric(metric)).join("\n");

      // DB-backed persistent gauges
      let dbLines = "";
      if (repository) {
        try {
          const [mailboxCount, messageCount, activeCount, attachmentCount, mailboxByDomain, messageByDomain, messageBySender] = await Promise.all([
            repository.countMailboxes(),
            repository.countMessages(),
            repository.countActiveMailboxes(),
            repository.countAttachments(),
            repository.countMailboxesByDomain(),
            repository.countMessagesByDomain(),
            repository.countMessagesBySenderDomain()
          ]);

          const dbMetrics: string[] = [];

          dbMetrics.push(
            "# HELP dropmail_mailboxes_total Total mailboxes in database",
            "# TYPE dropmail_mailboxes_total gauge",
            `dropmail_mailboxes_total ${mailboxCount}`,
            "# HELP dropmail_mailboxes_active Active (non-expired) mailboxes",
            "# TYPE dropmail_mailboxes_active gauge",
            `dropmail_mailboxes_active ${activeCount}`,
            "# HELP dropmail_messages_total Total messages in database",
            "# TYPE dropmail_messages_total gauge",
            `dropmail_messages_total ${messageCount}`,
            "# HELP dropmail_attachments_total Total attachments in storage",
            "# TYPE dropmail_attachments_total gauge",
            `dropmail_attachments_total ${attachmentCount}`
          );

          if (mailboxByDomain.length > 0) {
            dbMetrics.push(
              "# HELP dropmail_mailboxes_by_domain Mailboxes per domain",
              "# TYPE dropmail_mailboxes_by_domain gauge"
            );
            for (const { domain, count } of mailboxByDomain) {
              dbMetrics.push(`dropmail_mailboxes_by_domain{domain="${domain}"} ${count}`);
            }
          }

          if (messageByDomain.length > 0) {
            dbMetrics.push(
              "# HELP dropmail_messages_by_domain Messages per domain",
              "# TYPE dropmail_messages_by_domain gauge"
            );
            for (const { domain, count } of messageByDomain) {
              dbMetrics.push(`dropmail_messages_by_domain{domain="${domain}"} ${count}`);
            }
          }

          if (messageBySender.length > 0) {
            dbMetrics.push(
              "# HELP dropmail_messages_by_sender_domain Messages per sender domain",
              "# TYPE dropmail_messages_by_sender_domain gauge"
            );
            for (const { domain, count } of messageBySender) {
              dbMetrics.push(`dropmail_messages_by_sender_domain{domain="${domain}"} ${count}`);
            }
          }

          dbLines = dbMetrics.join("\n");
        } catch {
          // DB unavailable, skip persistent metrics
        }
      }

      return [lines, dbLines].filter(Boolean).join("\n").concat("\n");
    }
  };
}

export const productionMetrics = createMetrics();

function renderMetric(metric: Metric): string {
  const lines = [`# HELP ${metric.name} ${metric.help}`, `# TYPE ${metric.name} ${metric.type}`];
  for (const [labels, value] of metric.values.entries()) {
    lines.push(`${metric.name}${labels} ${value}`);
  }
  return lines.join("\n");
}

function labelKey(labels: LabelMap): string {
  const entries = Object.entries(labels);
  if (entries.length === 0) return "";
  return `{${entries.map(([key, value]) => `${key}="${escapeLabel(value)}"`).join(",")}}`;
}

function escapeLabel(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}
