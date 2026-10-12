"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useCallback, useEffect, useState } from "react";

interface TemplateItem {
  id: string;
  label: string;
  audience: string;
}

/**
 * Admin-only preview of every notification email, rendered with sample data,
 * plus a "send test" that mails the template to team@motori.us only.
 */
export default function AdminEmailsPage() {
  const { authenticated, login, getAccessToken } = usePrivy();
  const [role, setRole] = useState<string | null>(null);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [recipient, setRecipient] = useState("team@motori.us");
  const [selected, setSelected] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; bad?: boolean } | null>(null);

  const authedFetch = useCallback(
    async (url: string, init?: RequestInit) => {
      const token = await getAccessToken();
      return fetch(url, { ...init, headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` } });
    },
    [getAccessToken]
  );

  useEffect(() => {
    if (!authenticated) return;
    (async () => {
      try {
        const me = await (await authedFetch("/api/me")).json();
        setRole(me.role ?? null);
        if (me.role !== "admin") return;
        const res = await authedFetch("/api/admin/emails");
        const data = await res.json();
        if (res.ok) {
          setTemplates(data.templates);
          setRecipient(data.testRecipient);
          setSelected(data.templates[0]?.id ?? null);
        }
      } catch {
        setMessage({ text: "Couldn't load the templates.", bad: true });
      }
    })();
  }, [authenticated, authedFetch]);

  useEffect(() => {
    if (!selected) return;
    setMessage(null);
    (async () => {
      const res = await authedFetch(`/api/admin/emails?id=${encodeURIComponent(selected)}`);
      const data = await res.json();
      if (res.ok) {
        setSubject(data.subject);
        setHtml(data.html);
      } else {
        setMessage({ text: data.error ?? "Couldn't render that email.", bad: true });
      }
    })();
  }, [selected, authedFetch]);

  async function sendTest() {
    if (!selected) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await authedFetch("/api/admin/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected }),
      });
      const data = await res.json();
      setMessage(
        res.ok ? { text: `Test sent to ${data.to}.` } : { text: data.error ?? "Send failed.", bad: true }
      );
    } catch {
      setMessage({ text: "Send failed.", bad: true });
    }
    setBusy(false);
  }

  return (
    <>
    <header className="site">
      <div className="navbar">
        <div className="navleft">
          <a className="brand" href="/">
            motori<em>.</em>us
          </a>
        </div>
        <nav className="navright">
          <a href="/about/">About</a>
          <span id="auth-slot"></span>
        </nav>
      </div>
    </header>
    <main>
      <section className="hero compact">
        <div className="wrap">
          <p className="eyebrow">Admin</p>
          <h1 className="title mid">Email previews</h1>
        </div>
      </section>
      <section>
        <div className="wrap">
          {!authenticated ? (
            <div className="formcard">
              <button className="btn-primary" type="button" onClick={login}>
                Log in
              </button>
            </div>
          ) : role !== null && role !== "admin" ? (
            <div className="status-banner bad">
              <span className="label">Not authorized</span>
              <span>This page is for Admins only.</span>
            </div>
          ) : (
            <>
              <p className="lede">
                Sample data only. “Send test” mails the selected email to {recipient}, nobody else. <a href="/admin/">Back to Admin</a>
              </p>
              <div className="field">
                <label htmlFor="tpl">Email</label>
                <select id="tpl" value={selected ?? ""} onChange={(e) => setSelected(e.target.value)}>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <p>
                <strong>Subject:</strong> {subject}
              </p>
              <div className="btn-row">
                <button className="btn-primary" type="button" disabled={busy || !selected} onClick={sendTest}>
                  {busy ? "Sending…" : `Send test to ${recipient}`}
                </button>
              </div>
              {message && (
                <div className={`status-banner ${message.bad ? "bad" : ""}`}>
                  <span>{message.text}</span>
                </div>
              )}
              <iframe
                title="Email preview"
                srcDoc={html}
                sandbox=""
                style={{ width: "100%", height: 900, border: "1px solid #ddd", borderRadius: 8, background: "#fff", marginTop: 16 }}
              />
            </>
          )}
        </div>
      </section>
    </main>
    </>
  );
}
