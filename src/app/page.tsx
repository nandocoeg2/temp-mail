import { InboxClient, type Mailbox, type InboxMessage } from "@/components/inbox-client";

async function getInitialMailbox(): Promise<{ mailbox: Mailbox; messages: InboxMessage[] }> {
  const fallback: Mailbox = {
    id: "initial-local",
    token: "",
    address: "new@dropmail.local",
    expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    status: "loading"
  };

  return { mailbox: fallback, messages: [] };
}

export default async function Home() {
  const { mailbox, messages } = await getInitialMailbox();

  return (
    <main className="public-shell">
      <header className="topbar">
        <div className="brand-mark" aria-label="DropMail">
          <span>DM</span>
          <strong>DropMail</strong>
        </div>
        <a href="/admin" className="admin-link">Admin</a>
      </header>

      <section className="public-intro">
        <div>
          <span className="eyebrow">Temporary email</span>
          <h1>Receive mail without handing over your real inbox.</h1>
        </div>
        <p>DropMail creates a disposable mailbox, keeps it live for a short window, and lets you copy one-time codes or links as they arrive.</p>
      </section>

      <InboxClient initialMailbox={mailbox} initialMessages={messages} />
    </main>
  );
}
