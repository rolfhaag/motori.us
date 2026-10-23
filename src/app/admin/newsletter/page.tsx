"use client";

import { useEffect, useState } from "react";
import AdminShell, { type AdminFetch } from "@/components/AdminShell";

interface Stats {
  uniqueConfirmed: number;
  pending: number;
  unsubscribed: number;
  scopes: { scope: string; count: number }[];
  postalConfigured: boolean;
  maxPerSend: number;
}

function Newsletter({ authedFetch }: { authedFetch: AdminFetch }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [kind, setKind] = useState("all");
  const [value, setValue] = useState("");
  const [subject, setSubject] = useState("");
  const [lead, setLead] = useState("");
  const [body, setBody] = useState("");
  const [buttonLabel, setButtonLabel] = useState("");
  const [buttonUrl, setButtonUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);

  useEffect(() => {
    authedFetch("/api/admin/newsletter")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => setMsg({ text: "Couldn't load follower counts.", bad: true }));
  }, [authedFetch]);

  async function run(action: "test" | "send") {
    if (action === "send" && !window.confirm("Send this to the selected followers now? This can't be undone.")) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await authedFetch("/api/admin/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, audience: { kind, value }, subject, lead, body, buttonLabel, buttonUrl }),
      });
      const data = await res.json();
      if (!res.ok) setMsg({ text: data.error ?? "Something went wrong.", bad: true });
      else if (action === "test") setMsg({ text: `Test sent to ${data.sentTo}.` });
      else setMsg({ text: `Sending to ${data.queued} ${data.queued === 1 ? "person" : "people"}. It takes a minute; check Resend or the email log.` });
    } catch {
      setMsg({ text: "Something went wrong.", bad: true });
    }
    setBusy(false);
  }

  return (
    <>
      <p className="lede">
        Write an update to people who follow motori.us, a Builder or a Build. Only confirmed followers get it, each with their own
        unsubscribe link. <a href="/admin/">Back to Admin</a>
      </p>
      {stats && (
        <div className="status-banner">
          <span className="label">Followers</span>
          <span>
            {stats.uniqueConfirmed} confirmed, {stats.pending} waiting to confirm, {stats.unsubscribed} unsubscribed.
            {stats.scopes.length > 0 && <> Most followed: {stats.scopes.slice(0, 4).map((s) => `${s.scope} (${s.count})`).join(", ")}.</>}
          </span>
        </div>
      )}
      {stats && !stats.postalConfigured && (
        <div className="status-banner bad">
          <span className="label">Set up needed</span>
          <span>
            Add LEGAL_POSTAL_ADDRESS in Vercel (a PO box or registered-agent address, not your home). Update emails carry it
            in the footer and won&rsquo;t send without it.
          </span>
        </div>
      )}
      <div className="formcard">
        <div className="field">
          <label htmlFor="aud">Send to</label>
          <select id="aud" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="all">Everyone who follows anything</option>
            <option value="site">Followers of the whole site</option>
            <option value="builder">Followers of one Builder</option>
            <option value="build">Followers of one Build</option>
          </select>
        </div>
        {(kind === "builder" || kind === "build") && (
          <div className="field">
            <label htmlFor="val">{kind === "builder" ? "Builder handle" : "Build slug"}</label>
            <input id="val" type="text" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
        )}
        <div className="field">
          <label htmlFor="sub">Subject</label>
          <input id="sub" type="text" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} />
        </div>
        <div className="field">
          <label htmlFor="lead">Headline (first line in the email)</label>
          <input id="lead" type="text" value={lead} onChange={(e) => setLead(e.target.value)} maxLength={200} />
        </div>
        <div className="field">
          <label htmlFor="body">Message</label>
          <textarea id="body" rows={9} value={body} onChange={(e) => setBody(e.target.value)} />
          <p className="hint">Plain text. Leave a blank line between paragraphs. Signed &ldquo;The motori.us team&rdquo;.</p>
        </div>
        <div className="field">
          <label htmlFor="bl">Button label (optional)</label>
          <input id="bl" type="text" value={buttonLabel} onChange={(e) => setButtonLabel(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="bu">Button link (optional, https://…)</label>
          <input id="bu" type="text" value={buttonUrl} onChange={(e) => setButtonUrl(e.target.value)} />
        </div>
        {msg && <p className={msg.bad ? "form-error" : "hint"}>{msg.text}</p>}
        <div className="btn-row">
          <button className="btn-secondary" type="button" disabled={busy} onClick={() => run("test")}>
            Send test to team@
          </button>
          <button className="btn-primary" type="button" disabled={busy || !stats?.postalConfigured} onClick={() => run("send")}>
            Send
          </button>
        </div>
      </div>
    </>
  );
}

export default function NewsletterPage() {
  return <AdminShell title="Newsletter">{(f) => <Newsletter authedFetch={f} />}</AdminShell>;
}
