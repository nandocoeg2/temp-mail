import {
  Activity,
  Gauge,
  Globe2,
  MailCheck,
  ShieldAlert,
  TimerReset,
  TrendingUp
} from "lucide-react";
import type { ComponentType } from "react";

type Metric = {
  label: string;
  value: string;
  helper: string;
  icon: ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
};

type AdminDashboardProps = {
  metrics?: {
    mailboxes: number;
    messages: number;
    inboundEvents: Array<{
      id: string;
      recipient: string;
      sender: string;
      status: "accepted" | "rejected";
      reason: string | null;
      receivedAt: Date | string;
    }>;
    rateLimitEvents: Array<{
      id: string;
      bucket: string;
      action: string;
      createdAt: Date | string;
    }>;
  };
};

const domains = [
  { name: "dropmail.app", mx: "Healthy", dkim: "Aligned", load: "41%" },
  { name: "dropmail.dev", mx: "Degraded", dkim: "Aligned", load: "68%" },
  { name: "dropmail.net", mx: "Healthy", dkim: "Pending", load: "37%" }
];

export function AdminDashboard({ metrics }: AdminDashboardProps) {
  const inboundEvents = metrics?.inboundEvents ?? [];
  const rateLimitEvents = metrics?.rateLimitEvents ?? [];
  const acceptedEvents = inboundEvents.filter((event) => event.status === "accepted").length;
  const metricTiles: Metric[] = [
    { label: "Mailboxes", value: String(metrics?.mailboxes ?? 0), helper: "Total issued addresses", icon: MailCheck },
    { label: "Stored messages", value: String(metrics?.messages ?? 0), helper: "No message bodies shown here", icon: Activity },
    { label: "Inbound events", value: String(inboundEvents.length), helper: `${acceptedEvents} accepted in recent events`, icon: Gauge },
    { label: "Rate-limit events", value: String(rateLimitEvents.length), helper: "Recent protected actions", icon: ShieldAlert }
  ];

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <span className="eyebrow">Protected admin</span>
          <h1>DropMail operations</h1>
          <p>Service health and abuse visibility without exposing user email contents.</p>
        </div>
        <span className="status-pill">
          <TrendingUp aria-hidden="true" size={16} />
          Live overview
        </span>
      </header>

      <section className="metric-grid" aria-label="Admin metrics">
        {metricTiles.map((metric) => {
          const Icon = metric.icon;
          return (
            <div className="metric-tile" key={metric.label}>
              <Icon aria-hidden={true} size={20} />
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.helper}</small>
            </div>
          );
        })}
      </section>

      <section className="admin-grid">
        <div className="admin-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Events</span>
              <h2>Inbound stream</h2>
            </div>
            <Activity aria-hidden="true" className="muted" size={19} />
          </div>
          <table>
            <thead>
              <tr>
                <th>Event</th>
                <th>Domain</th>
                <th>MX</th>
                <th>Status</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {inboundEvents.length === 0 ? (
                <tr>
                  <td colSpan={5}>No inbound events yet</td>
                </tr>
              ) : null}
              {inboundEvents.map((event) => (
                <tr key={event.id}>
                  <td>{event.id.slice(0, 8)}</td>
                  <td>{domainOf(event.recipient)}</td>
                  <td>{domainOf(event.sender)}</td>
                  <td><span className={`table-status ${event.status}`}>{event.reason ?? event.status}</span></td>
                  <td>{formatTime(event.receivedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="admin-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Domains</span>
              <h2>Health</h2>
            </div>
            <Globe2 aria-hidden="true" className="muted" size={19} />
          </div>
          <div className="domain-list">
            {domains.map((domain) => (
              <div className="domain-row" key={domain.name}>
                <strong>{domain.name}</strong>
                <span>{domain.mx}</span>
                <span>{domain.dkim}</span>
                <meter min="0" max="100" value={Number.parseInt(domain.load, 10)} />
              </div>
            ))}
          </div>
        </div>

        <div className="admin-panel limits-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Controls</span>
              <h2>Rate limits</h2>
            </div>
            <TimerReset aria-hidden="true" className="muted" size={19} />
          </div>
          {rateLimitEvents.length === 0 ? (
            <div className="limit-row">
              <div>
                <strong>No rate-limit events yet</strong>
                <span>Mailbox creation and refresh limits are quiet.</span>
              </div>
              <div className="limit-bar" aria-label="Rate limit usage 0%">
                <span style={{ width: "0%" }} />
              </div>
            </div>
          ) : null}
          {rateLimitEvents.map((event, index) => (
            <div className="limit-row" key={event.id}>
              <div>
                <strong>{event.action.replaceAll("_", " ")}</strong>
                <span>{event.bucket.slice(0, 12)}... at {formatTime(event.createdAt)}</span>
              </div>
              <div className="limit-bar" aria-label={`${event.action} activity ${Math.max(8, 100 - index * 14)}%`}>
                <span style={{ width: `${Math.max(8, 100 - index * 14)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function domainOf(address: string): string {
  return address.split("@")[1] || "unknown";
}

function formatTime(value: Date | string): string {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}
