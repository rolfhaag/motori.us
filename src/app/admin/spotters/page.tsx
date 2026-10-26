"use client";

import { useCallback, useEffect, useState } from "react";
import AdminShell, { type AdminFetch } from "@/components/AdminShell";

interface SpotterRow {
  id: string;
  user_id: string;
  handle: string;
  display_name: string;
  social_url: string | null;
  status: "active" | "revoked";
  builders: number;
  builds: number;
  nominations: number;
}
interface InviteRow {
  id: string;
  name: string | null;
  email: string | null;
  created_at: string;
  expires_at: string;
  state: "open" | "used" | "expired" | "revoked";
  url: string | null;
  dm: string | null;
}
interface Created {
  url: string;
  dm: string;
  emailed: boolean;
  name: string | null;
}

function Spotters({ authedFetch }: { authedFetch: AdminFetch }) {
  const [spotters, setSpotters] = useState<SpotterRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [created, setCreated] = useState<Created | null>(null);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const load = useCallback(async () => {
    try {
      const res = await authedFetch("/api/admin/spotters");
      const data = await res.json();
      if (res.ok) {
        setSpotters(data.spotters);
        setInvites(data.invites);
      } else setMsg({ text: data.error ?? "Couldn't load.", bad: true });
    } catch {
      setMsg({ text: "Couldn't load.", bad: true });
    }
  }, [authedFetch]);

  useEffect(() => {
    load();
  }, [load]);

  async function post(body: Record<string, unknown>) {
    const res = await authedFetch("/api/admin/spotters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  }

  async function createInvite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setCreated(null);
    const { ok, data } = await post({ action: "invite", name, email });
    setBusy(false);
    if (!ok) {
      setMsg({ text: data.error ?? "Couldn't create the invite.", bad: true });
      return;
    }
    setCreated({ url: data.url, dm: data.dm, emailed: data.emailed, name: data.name });
    setName("");
    setEmail("");
    load();
  }

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMsg({ text: `${what} copied.` });
    } catch {
      setMsg({ text: "Couldn't copy. Select and copy it by hand.", bad: true });
    }
  }

  function share(c: { dm: string; url: string }) {
    navigator.share({ text: c.dm }).catch(() => {});
  }

  async function act(body: Record<string, unknown>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    const { ok, data } = await post(body);
    if (!ok) setMsg({ text: data.error ?? "That didn't work.", bad: true });
    else setMsg(null);
    load();
  }

  const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <>
      <p className="lede">
        Invite someone to be a Spotter. You get a single-use link to send however you like, including an Instagram DM.{" "}
        <a href="/admin/">Back to Admin</a>
      </p>
      {msg && <p className={msg.bad ? "form-error" : "hint"}>{msg.text}</p>}

      <div className="formcard" style={{ marginBottom: 24 }}>
        <h4 style={{ margin: "0 0 12px" }}>Create an invite</h4>
        <form onSubmit={createInvite}>
          <div className="field">
            <label htmlFor="inviteName">Name (optional)</label>
            <input id="inviteName" type="text" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Gatsby" />
          </div>
          <div className="field">
            <label htmlFor="inviteEmail">Email (optional: we&rsquo;ll also email the invite)</label>
            <input id="inviteEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
          </div>
          <button className="btn-primary" type="submit" disabled={busy}>
            {busy ? "Creating…" : "Create invite link"}
          </button>
        </form>

        {created && (
          <div className="spotter-invite-made">
            <p style={{ margin: "0 0 8px" }}>
              <strong>Invite ready.</strong> {created.emailed ? "Emailed too. " : ""}Expires in 14 days, works once.
            </p>
            <input type="text" readOnly value={created.url} onFocus={(e) => e.currentTarget.select()} style={{ width: "100%", marginBottom: 10 }} />
            <div className="btn-row">
              <button className="btn-primary" type="button" onClick={() => copy(created.dm, "Message")}>
                Copy DM message
              </button>
              <button className="btn-secondary" type="button" onClick={() => copy(created.url, "Link")}>
                Copy link
              </button>
              {canShare && (
                <button className="btn-secondary" type="button" onClick={() => share(created)}>
                  Share…
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <h4>Spotters</h4>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Spotter</th>
            <th>Nominations</th>
            <th>Builders</th>
            <th>Builds</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {spotters.map((s) => (
            <tr key={s.id}>
              <td>
                <a className="cta-link" href={`/spotters/${s.handle}/`}>
                  {s.display_name}
                </a>{" "}
                <span className="fmono">@{s.handle}</span>
                {s.status === "revoked" && <span className="badge denied" style={{ marginLeft: 8 }}>paused</span>}
              </td>
              <td>{s.nominations}</td>
              <td>{s.builders}</td>
              <td>{s.builds}</td>
              <td>
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() =>
                    act(
                      { action: "set_status", id: s.id, status: s.status === "active" ? "revoked" : "active" },
                      s.status === "active" ? `Pause ${s.display_name}'s Spotter access? Their page and credits are hidden until restored.` : undefined
                    )
                  }
                >
                  {s.status === "active" ? "Pause" : "Restore"}
                </button>
              </td>
            </tr>
          ))}
          {spotters.length === 0 && (
            <tr>
              <td colSpan={5}>No Spotters yet. Create an invite above.</td>
            </tr>
          )}
        </tbody>
      </table>

      <h4 style={{ marginTop: 28 }}>Invites</h4>
      <table className="admin-table">
        <thead>
          <tr>
            <th>For</th>
            <th>Created</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {invites.map((i) => (
            <tr key={i.id}>
              <td>
                {i.name || "(no name)"}
                {i.email && <div className="hint">{i.email}</div>}
              </td>
              <td>{fmt(i.created_at)}</td>
              <td>
                <span className={`badge ${i.state === "open" ? "published" : "denied"}`}>
                  {i.state === "open" ? `open until ${fmt(i.expires_at)}` : i.state}
                </span>
              </td>
              <td>
                {i.state === "open" && i.url && i.dm && (
                  <div className="row-actions">
                    <button className="btn-secondary" type="button" onClick={() => copy(i.dm!, "Message")}>
                      Copy DM
                    </button>
                    <button className="btn-secondary" type="button" onClick={() => copy(i.url!, "Link")}>
                      Copy link
                    </button>
                    <button className="btn-secondary" type="button" onClick={() => act({ action: "revoke_invite", id: i.id }, "Revoke this invite link?")}>
                      Revoke
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
          {invites.length === 0 && (
            <tr>
              <td colSpan={4}>No invites yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}

export default function AdminSpottersPage() {
  return <AdminShell title="Spotters">{(authedFetch) => <Spotters authedFetch={authedFetch} />}</AdminShell>;
}
