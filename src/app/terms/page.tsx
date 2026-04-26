const terms = [
  {
    title: "Receive-only temporary service",
    body:
      "DropMail is a receive-only temporary email service. It does not provide outbound sending, replying, forwarding, account registration, long-term inbox storage, or permanent email identities."
  },
  {
    title: "Acceptable use",
    body:
      "You may use DropMail for lawful, low-risk receipt of temporary messages such as verification emails, test messages, and short-lived links. You are responsible for how you use addresses and for complying with applicable laws and third-party terms."
  },
  {
    title: "Prohibited activity",
    body:
      "You must not use DropMail for illegal content, harassment, fraud, phishing, credential theft, malware, spam operations, privacy violations, child sexual abuse material, exploitation, threats, or attempts to bypass abuse controls on other services."
  },
  {
    title: "Abuse controls and rate limits",
    body:
      "DropMail may apply rate limiting, mailbox blocking, attachment scanning, message rejection, domain restrictions, provider filtering, traffic analysis, and other abuse controls. We may suspend, delete, or restrict access to data or addresses when needed to protect the service."
  },
  {
    title: "Delivery is not guaranteed",
    body:
      "DropMail does not guarantee message delivery, message availability, address availability, attachment availability, or compatibility with every sender. Messages can be delayed, rejected, filtered, truncated, deleted, or unavailable."
  },
  {
    title: "Temporary deletion",
    body:
      "Mailboxes are designed to be temporary. Mailboxes target a fixed 1-hour receiving window, messages are deleted after the temporary retention period, and backup copies expire under the service backup schedule."
  }
];

export default function TermsPage() {
  return (
    <main className="public-shell">
      <header className="topbar">
        <a className="brand-mark" href="/" aria-label="DropMail home">
          <span>DM</span>
          <strong>DropMail</strong>
        </a>
        <a href="/privacy" className="admin-link">Privacy</a>
      </header>

      <article style={{ maxWidth: "860px", margin: "42px 0 0" }}>
        <span className="eyebrow">Legal</span>
        <h1 style={{ fontSize: "clamp(32px, 5vw, 52px)", lineHeight: 1.04, margin: "6px 0 14px" }}>Terms of Service</h1>
        <p style={{ color: "var(--muted)", lineHeight: 1.6, fontSize: "18px" }}>
          These terms set the rules for using DropMail's temporary email service.
        </p>

        <div style={{ display: "grid", gap: "18px", marginTop: "30px" }}>
          {terms.map((term) => (
            <section key={term.title}>
              <h2 style={{ fontSize: "22px", margin: "0 0 8px" }}>{term.title}</h2>
              <p style={{ color: "var(--muted)", lineHeight: 1.65, margin: 0 }}>{term.body}</p>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
