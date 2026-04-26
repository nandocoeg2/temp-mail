const sections = [
  {
    title: "What DropMail handles",
    body:
      "DropMail provides temporary mailbox data so you can receive messages at disposable addresses. Mailbox records include the generated address, mailbox token metadata, status, timestamps, sender and recipient details, message headers, message subject, message body previews, sanitized message content, attachment metadata, and operational event records needed to run the service."
  },
  {
    title: "Mailbox lifetime and deletion",
    body:
      "Each mailbox targets a fixed 1-hour receiving window. Messages are cleaned up after 24 hours, and full database backups are retained for 3 days before they are rotated out. Deleted temporary data may remain in those short-lived backups until the backup retention period ends."
  },
  {
    title: "Attachments and scanning",
    body:
      "Attachments may be stored separately from message records so they can be downloaded during the temporary mailbox lifetime. DropMail may scan attachments for malware, unsafe content, and abuse signals, and may block or remove attachments that fail those checks."
  },
  {
    title: "Infrastructure and processors",
    body:
      "Cloudflare may process requests, IP addresses, headers, security events, cache metadata, and related traffic data when protecting and delivering DropMail. Other hosting, storage, database, logging, and monitoring providers may process data only as needed to operate the service."
  },
  {
    title: "Analytics and operations",
    body:
      "DropMail may collect basic analytics and operational metrics such as request counts, rate-limit events, mailbox creation counts, delivery outcomes, cleanup activity, attachment scan results, errors, latency, and coarse usage trends. These metrics are used to operate, secure, debug, and capacity-plan the service."
  },
  {
    title: "No selling personal data",
    body:
      "DropMail does not sell personal data. We do not use temporary mailbox contents for advertising profiles, and we do not share message contents except where necessary to operate the service, comply with law, prevent abuse, or protect users and infrastructure."
  }
];

export default function PrivacyPage() {
  return (
    <main className="public-shell">
      <header className="topbar">
        <a className="brand-mark" href="/" aria-label="DropMail home">
          <span>DM</span>
          <strong>DropMail</strong>
        </a>
        <a href="/terms" className="admin-link">Terms</a>
      </header>

      <article style={{ maxWidth: "860px", margin: "42px 0 0" }}>
        <span className="eyebrow">Legal</span>
        <h1 style={{ fontSize: "clamp(32px, 5vw, 52px)", lineHeight: 1.04, margin: "6px 0 14px" }}>Privacy Notice</h1>
        <p style={{ color: "var(--muted)", lineHeight: 1.6, fontSize: "18px" }}>
          This notice explains how DropMail handles data for its temporary receive-only mailbox service.
        </p>

        <div style={{ display: "grid", gap: "18px", marginTop: "30px" }}>
          {sections.map((section) => (
            <section key={section.title}>
              <h2 style={{ fontSize: "22px", margin: "0 0 8px" }}>{section.title}</h2>
              <p style={{ color: "var(--muted)", lineHeight: 1.65, margin: 0 }}>{section.body}</p>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
