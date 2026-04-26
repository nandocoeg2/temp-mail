const abuseContactEmail = process.env.ABUSE_CONTACT_EMAIL ?? "abuse@fjulian.space";

const reportDetails = [
  "The DropMail address involved.",
  "The sender address and sending service, if visible.",
  "Message subject, timestamps, headers, URLs, attachment names, and screenshots where relevant.",
  "Why the message or mailbox appears abusive, illegal, unsafe, or policy-violating.",
  "Any law-enforcement, platform, or ticket reference that should be associated with the report."
];

export default function AbusePage() {
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
        <span className="eyebrow">Safety</span>
        <h1 style={{ fontSize: "clamp(32px, 5vw, 52px)", lineHeight: 1.04, margin: "6px 0 14px" }}>Abuse Contact</h1>
        <p style={{ color: "var(--muted)", lineHeight: 1.6, fontSize: "18px" }}>
          Report abuse involving DropMail addresses to <a href={`mailto:${abuseContactEmail}`}>{abuseContactEmail}</a>.
        </p>

        <section style={{ marginTop: "30px" }}>
          <h2 style={{ fontSize: "22px", margin: "0 0 8px" }}>What to include</h2>
          <ul style={{ color: "var(--muted)", lineHeight: 1.65, paddingLeft: "22px", margin: 0 }}>
            {reportDetails.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        </section>

        <section style={{ marginTop: "24px" }}>
          <h2 style={{ fontSize: "22px", margin: "0 0 8px" }}>How reports are handled</h2>
          <p style={{ color: "var(--muted)", lineHeight: 1.65, margin: 0 }}>
            DropMail may review mailbox metadata, message records, attachments, logs, rate-limit activity, and provider signals to investigate reports. We may block mailboxes, reject inbound messages, remove attachments, preserve limited evidence when legally required, or cooperate with valid legal requests.
          </p>
        </section>
      </article>
    </main>
  );
}
