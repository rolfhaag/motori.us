"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useCallback, useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import { readJson } from "@/lib/clientImage";

type Status = "sent" | "applied" | "approved" | "live";

interface Nomination {
  id: string;
  note: string | null;
  createdAt: string;
  url: string;
  status: Status;
  buildUrl: string | null;
}
interface Me {
  spotter: { handle: string; name: string; social: string | null; pageUrl: string };
  counts: { builders: number; builds: number };
  nominations: Nomination[];
}

const STATUS_LABEL: Record<Status, string> = { sent: "Sent", applied: "Applied", approved: "Approved", live: "Live" };
const STEPS: Status[] = ["sent", "applied", "approved", "live"];

function messageFor(name: string, note: string | null, url: string) {
  return `${name} spotted ${note ? `your ${note}` : "your car"} and nominated it for motori.us, where exceptional restomods get a documented, permanent record. Apply here: ${url}`;
}

export default function SpotterDashboard() {
  const { ready, authenticated, login, getAccessToken } = usePrivy();
  const [me, setMe] = useState<Me | null>(null);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ url: string; note: string | null } | "new" | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/spotter/me", { headers: { Authorization: `Bearer ${token}` } });
      const data = await readJson(res);
      if (res.status === 403) {
        setDenied(true);
        return;
      }
      if (!res.ok) {
        setError((data.error as string) ?? "Couldn't load your dashboard.");
        return;
      }
      setMe(data as unknown as Me);
    } catch {
      setError("Couldn't load your dashboard.");
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (authenticated) load();
  }, [authenticated, load]);

  async function remove(id: string) {
    if (!window.confirm("Delete this nomination link? It will stop working.")) return;
    const token = await getAccessToken();
    const res = await fetch(`/api/spotter/nominations?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) setError("That one can't be deleted.");
    load();
  }

  if (!ready) return null;
  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero compact">
          <div className="wrap">
            <p className="eyebrow">Spotter</p>
            <h1 className="title mid">{me ? me.spotter.name : "Your Spotter page"}</h1>
            {me && (
              <p className="thesis">
                <a href={`/spotters/${me.spotter.handle}/`}>View your public page</a>
              </p>
            )}
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
            ) : denied ? (
              <div className="status-banner bad">
                <span className="label">Not a Spotter</span>
                <span>This page is for invited Spotters. Ask us for an invite link.</span>
              </div>
            ) : !me ? (
              error ? <p className="form-error">{error}</p> : <p className="lede">Loading…</p>
            ) : (
              <>
                <div className="spotter-hero-actions">
                  <button className="btn-primary spotter-nominate" type="button" onClick={() => setSheet("new")}>
                    Nominate a car
                  </button>
                  <div className="spotter-counts">
                    <span>
                      <strong>{me.counts.builders}</strong> {me.counts.builders === 1 ? "Builder" : "Builders"} brought in
                    </span>
                    <span>
                      <strong>{me.counts.builds}</strong> {me.counts.builds === 1 ? "build" : "builds"} spotted
                    </span>
                  </div>
                </div>
                {error && <p className="form-error">{error}</p>}

                <h4 style={{ marginTop: 28 }}>Your nominations</h4>
                {me.nominations.length === 0 ? (
                  <p className="lede">
                    Nothing yet. Tap <strong>Nominate a car</strong>, add a short note about it, and send the owner the link.
                  </p>
                ) : (
                  <ul className="nom-list">
                    {me.nominations.map((n) => (
                      <li key={n.id}>
                        <div className="nom-main">
                          <p className="nom-title">{n.note || "Untitled car"}</p>
                          <p className="nom-date">{new Date(n.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                          <p className="nom-steps" aria-label={`Status: ${STATUS_LABEL[n.status]}`}>
                            {STEPS.map((s, i) => (
                              <span key={s} className={i <= STEPS.indexOf(n.status) ? "on" : ""}>
                                {STATUS_LABEL[s]}
                              </span>
                            ))}
                          </p>
                        </div>
                        <div className="row-actions">
                          {n.buildUrl && (
                            <a className="btn-secondary" href={n.buildUrl}>
                              View build
                            </a>
                          )}
                          {n.status === "sent" && (
                            <>
                              <button className="btn-secondary" type="button" onClick={() => setSheet({ url: n.url, note: n.note })}>
                                Share again
                              </button>
                              <button className="btn-secondary" type="button" onClick={() => remove(n.id)}>
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </section>
      </main>
      {sheet && me && (
        <NominateSheet
          name={me.spotter.name}
          existing={sheet === "new" ? null : sheet}
          getToken={getAccessToken}
          onClose={() => {
            setSheet(null);
            load();
          }}
        />
      )}
    </>
  );
}

function NominateSheet({
  name,
  existing,
  getToken,
  onClose,
}: {
  name: string;
  existing: { url: string; note: string | null } | null;
  getToken: () => Promise<string | null>;
  onClose: () => void;
}) {
  const [note, setNote] = useState(existing?.note ?? "");
  const [photo, setPhoto] = useState<File | null>(null);
  const [made, setMade] = useState<{ url: string; note: string | null } | null>(existing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch("/api/spotter/nominations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ note }),
      });
      const data = await readJson(res);
      if (!res.ok) {
        setError((data.error as string) ?? "Couldn't make your link.");
        return;
      }
      setMade({ url: data.url as string, note: (data.note as string | null) ?? null });
    } catch {
      setError("Couldn't make your link. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const text = made ? messageFor(name, made.note, made.url) : "";

  function copy() {
    try {
      navigator.clipboard?.writeText(text).then(() => setInfo("Message copied. Paste it into a DM or text.")).catch(() => setInfo("Select the message and copy it by hand."));
    } catch {
      setInfo("Select the message and copy it by hand.");
    }
  }

  function share() {
    if (!made) return;
    try {
      navigator.clipboard?.writeText(text).catch(() => {}); // some apps drop shared text
    } catch {
      /* clipboard is a convenience */
    }
    if (!canShare) {
      setInfo("Message copied. Paste it into a DM or text.");
      return;
    }
    const withFile = photo && navigator.canShare?.({ files: [photo] });
    const data: ShareData = withFile ? { files: [photo as File], text } : { title: "motori.us", text };
    navigator
      .share(data)
      .then(() => setInfo("Sent. Nominate another any time."))
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name !== "AbortError") setInfo("Couldn't open the share sheet. Message copied; paste it into a DM.");
      });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card nom-sheet" role="dialog" aria-modal="true" aria-label="Nominate a car" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h4>{made ? "Send it to the owner" : "Nominate a car"}</h4>
          <button type="button" className="modal-x" aria-label="Close" onClick={onClose}>
            &times;
          </button>
        </div>

        {!made ? (
          <form onSubmit={create}>
            <div className="field">
              <label htmlFor="car-note">What car is it?</label>
              <input
                id="car-note"
                type="text"
                value={note}
                maxLength={80}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Silver 911 at Cars & Coffee"
                autoFocus
              />
              <p className="hint">A few words so you remember it, and the owner knows which car you mean.</p>
            </div>
            {error && <p className="form-error">{error}</p>}
            <div className="btn-row">
              <button className="btn-primary" type="submit" disabled={busy}>
                {busy ? "Making your link…" : "Create link"}
              </button>
            </div>
          </form>
        ) : (
          <>
            <p className="nom-message">{text}</p>
            <div className="field">
              <label htmlFor="car-photo">Add a photo of the car (optional)</label>
              <input id="car-photo" type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
            </div>
            <div className="btn-row">
              <button className="btn-primary" type="button" onClick={share}>
                {canShare ? "Share" : "Copy message"}
              </button>
              {canShare && (
                <button className="btn-secondary" type="button" onClick={copy}>
                  Copy message
                </button>
              )}
            </div>
            {info && <p className="hint">{info}</p>}
          </>
        )}
      </div>
    </div>
  );
}
