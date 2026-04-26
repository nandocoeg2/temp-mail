type LabelMap = Record<string, string>;

type Metric = {
  name: string;
  help: string;
  values: Map<string, number>;
};

export function createMetrics() {
  const metrics = new Map<string, Metric>();

  function counter(name: string, help: string, amount = 1, labels: LabelMap = {}) {
    const metric = metrics.get(name) ?? { name, help, values: new Map<string, number>() };
    const key = labelKey(labels);
    metric.values.set(key, (metric.values.get(key) ?? 0) + amount);
    metrics.set(name, metric);
  }

  return {
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
    render: async () =>
      [...metrics.values()]
        .map((metric) => renderMetric(metric))
        .join("\n")
        .concat("\n")
  };
}

export const productionMetrics = createMetrics();

function renderMetric(metric: Metric): string {
  const lines = [`# HELP ${metric.name} ${metric.help}`, `# TYPE ${metric.name} counter`];
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
