"use client";

import { useCallback, useEffect, useState } from "react";
import AdminShell, { type AdminFetch } from "@/components/AdminShell";

interface Doc {
  type: string;
  title: string;
  version: string;
  effectiveDate: string;
  changeSummary: string;
  path: string;
  accountHolders: number;
  notAccepted: number;
}

function Legal({ authedFetch }: { authedFetch: AdminFetch }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await authedFetch("/api/admin/legal");
      const data = await res.json();
      if (res.ok) setDocs(data.docs);
      else setMsg({ text: data.error ?? "Couldn't load.", bad: true });
    } catch {
      setMsg({ text: "Couldn't load.", bad: true });
    }
  }, [authedFetch]);

  useEffect(() => {
    load();
  }, [load]);

  async function notify(d: Doc) {
    if (!window.confirm(`Email ${d.notAccepted} account holder(s) about the ${d.title} (version ${d.version})?`)) return;
    setBusy(d.type);
    setMsg(null);
    const res = await authedFetch("/api/admin/legal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "notify", type: d.type }),
    });
    const data = await res.json().catch(() => ({}));
    setMsg(res.ok ? { text: `Queued ${data.queued} notice email(s).` } : { text: data.error ?? "Failed.", bad: true });
    setBusy(null);
  }

  return (
    <>
      <p className="lede">
        Current versions on file and who still has to accept them. To publish a change, edit the text and bump the version in{" "}
        <code>src/lib/legal/documents.ts</code>, then deploy. People are asked to accept it next time they use their account;
        send the notice email from here. <a href="/admin/">Back to Admin</a>
      </p>
      {msg && <p className={msg.bad ? "form-error" : "hint"}>{msg.text}</p>}
      {docs.map((d) => (
        <div className="formcard" key={d.type} style={{ marginBottom: 16 }}>
          <p style={{ margin: "0 0 4px" }}>
            <a href={d.path} target="_blank" rel="noopener noreferrer">
              <strong>{d.title}</strong>
            </a>{" "}
            <span className="fmono">version {d.version}, effective {d.effectiveDate}</span>
          </p>
          <p className="hint" style={{ margin: "0 0 10px" }}>
            {d.changeSummary}
          </p>
          <p style={{ margin: "0 0 12px" }}>
            {d.notAccepted} of {d.accountHolders} account holders haven&rsquo;t accepted this version yet.
          </p>
          <button className="btn-secondary" type="button" disabled={busy !== null || d.notAccepted === 0} onClick={() => notify(d)}>
            {busy === d.type ? "Queuing…" : "Email the notice"}
          </button>
        </div>
      ))}
    </>
  );
}

export default function LegalAdminPage() {
  return <AdminShell title="Terms and privacy">{(f) => <Legal authedFetch={f} />}</AdminShell>;
}
