"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useCallback, useEffect, useState, type ReactNode } from "react";

interface Application {
  id: string;
  user_id: string;
  handle: string;
  description: string;
  socials: string | null;
  photos: string[];
  photoUrls: string[];
  status: string;
  admin_notes: string | null;
  created_at: string;
  reapply_after: string | null;
}

interface Build {
  id: string;
  builder_id: string;
  title: string;
  status: string;
  hidden: boolean;
  visibility: "public" | "private";
  slug: string | null;
  admin_notes: string | null;
  created_at: string;
}

interface UserRow {
  id: string;
  email: string | null;
  role: string;
  banned: boolean;
}

interface BuilderRow {
  user_id: string;
  handle: string;
  description: string;
  hidden: boolean;
}

interface Dashboard {
  applications: Application[];
  builds: Build[];
  users: UserRow[];
  builders: BuilderRow[];
}

type Tab = "applications" | "builds" | "builders" | "users";

const ACTIVE_APPLICATION_STATUSES = ["submitted", "denied_resubmit"];


/** Simple overlay dialog: closes on Escape or a click on the backdrop. */
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h4>{title}</h4>
          <button type="button" className="modal-x" aria-label="Close" onClick={onClose}>
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function AdminPage() {
  const { ready, authenticated, login, getAccessToken } = usePrivy();
  const [role, setRole] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [tab, setTab] = useState<Tab>("applications");
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [selectedBuild, setSelectedBuild] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Shown once after a private publish / password regeneration -- the server
  // only keeps a hash, so this is the only time the password is visible.
  const [privateShare, setPrivateShare] = useState<{ title: string; url: string; password: string } | null>(null);
  // One-off E9 conversion: private dynamic copy for side-by-side comparison.
  const [e9Copy, setE9Copy] = useState<{ url: string; password: string; photos: number } | null>(null);
  const [e9Busy, setE9Busy] = useState(false);
  const [e9Swapped, setE9Swapped] = useState(false);
  const [e9ConfirmSwap, setE9ConfirmSwap] = useState(false);

  async function swapE9() {
    setE9Busy(true);
    setError(null);
    try {
      const res = await authedFetch("/api/admin/e9-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "swap" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? "Couldn't swap the E9 page.");
      else {
        setE9Swapped(true);
        setE9Copy(null);
      }
    } catch {
      setError("Couldn't swap the E9 page.");
    }
    setE9Busy(false);
    setE9ConfirmSwap(false);
  }

  async function createE9Copy() {
    setE9Busy(true);
    setError(null);
    try {
      const res = await authedFetch("/api/admin/e9-copy", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? "Couldn't create the E9 copy.");
      else setE9Copy(data);
    } catch {
      setError("Couldn't create the E9 copy.");
    }
    setE9Busy(false);
  }

  const authedFetch = useCallback(
    async (url: string, init?: RequestInit) => {
      const token = await getAccessToken();
      return fetch(url, {
        ...init,
        headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` },
      });
    },
    [getAccessToken]
  );

  const loadDashboard = useCallback(async () => {
    setError(null);
    try {
      const res = await authedFetch("/api/admin/dashboard");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't load the dashboard.");
        return;
      }
      setDashboard(data);
    } catch {
      setError("Couldn't load the dashboard.");
    }
  }, [authedFetch]);

  useEffect(() => {
    if (!authenticated) return;
    (async () => {
      try {
        const token = await getAccessToken();
        const res = await fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        setRole(data.role ?? null);
        if (data.role === "admin") await loadDashboard();
      } catch {
        setError("Couldn't verify your account.");
      }
    })();
  }, [authenticated, getAccessToken, loadDashboard]);

  async function decideApplication(id: string, action: "approve" | "deny_resubmit" | "deny_final") {
    setBusy(true);
    setError(null);
    try {
      const res = await authedFetch(`/api/admin/applications/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, notes }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setNotes("");
      setSelectedApp(null);
      await loadDashboard();
    } catch {
      setError("Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleBan(userId: string, banned: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await authedFetch(`/api/admin/users/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ banned }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      await loadDashboard();
    } catch {
      setError("Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleBuilderHidden(userId: string, hidden: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await authedFetch(`/api/admin/builders/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hidden }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      await loadDashboard();
    } catch {
      setError("Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function decideBuild(
    id: string,
    action:
      | "publish"
      | "publish_private"
      | "new_password"
      | "make_public"
      | "deny_resubmit"
      | "deny_final"
      | "hide"
      | "unhide"
  ) {
    setBusy(true);
    setError(null);
    try {
      const res = await authedFetch(`/api/admin/builds/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, notes }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setNotes("");
      if (data.password && data.slug) {
        const title = dashboard?.builds.find((b) => b.id === id)?.title ?? "Build";
        // Keep the Review dialog open to show the one-time password.
        setPrivateShare({ title, url: `${window.location.origin}/builds/${data.slug}/`, password: data.password });
      } else {
        setSelectedBuild(null);
      }
      await loadDashboard();
    } catch {
      setError("Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return null;

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
            <h1 className="title mid">Dashboard</h1>
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
            ) : !dashboard ? (
              <p className="lede">Loading…</p>
            ) : (
              <>
                <div className="gallery-tabs" role="tablist">
                  <button
                    className={`gtab ${tab === "applications" ? "active" : ""}`}
                    type="button"
                    onClick={() => setTab("applications")}
                  >
                    Applications
                  </button>
                  <button
                    className={`gtab ${tab === "builds" ? "active" : ""}`}
                    type="button"
                    onClick={() => setTab("builds")}
                  >
                    Builds
                  </button>
                  <button
                    className={`gtab ${tab === "builders" ? "active" : ""}`}
                    type="button"
                    onClick={() => setTab("builders")}
                  >
                    Builders
                  </button>
                  <button
                    className={`gtab ${tab === "users" ? "active" : ""}`}
                    type="button"
                    onClick={() => setTab("users")}
                  >
                    Users
                  </button>
                </div>

                {error && <p className="form-error">{error}</p>}

                {tab === "applications" && (
                  <>
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Handle</th>
                          <th>Status</th>
                          <th>Submitted</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboard.applications.map((app) => (
                          <tr
                            key={app.id}
                            className={`clickable ${selectedApp === app.id ? "selected" : ""}`}
                            onClick={() => {
                              setSelectedApp(app.id === selectedApp ? null : app.id);
                              setNotes("");
                            }}
                          >
                            <td>{app.handle}</td>
                            <td>
                              <span className={`badge ${app.status}`}>{app.status.replace("_", " ")}</span>
                            </td>
                            <td>{fmtDate(app.created_at)}</td>
                          </tr>
                        ))}
                        {dashboard.applications.length === 0 && (
                          <tr>
                            <td colSpan={3}>No applications yet.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>

                    {selectedApp &&
                      (() => {
                        const app = dashboard.applications.find((a) => a.id === selectedApp);
                        if (!app) return null;
                        const canDecide = ACTIVE_APPLICATION_STATUSES.includes(app.status);
                        return (
                          <div className="detail-panel">
                            <h4>{app.handle}</h4>
                            <div className="detail-row">
                              <span className="label">Description</span>
                              {app.description}
                            </div>
                            {app.socials && (
                              <div className="detail-row">
                                <span className="label">Socials</span>
                                {app.socials}
                              </div>
                            )}
                            {app.photoUrls.length > 0 && (
                              <div className="detail-row">
                                <span className="label">Photos</span>
                                <div className="detail-photos">
                                  {app.photoUrls.map((url) => (
                                    <img src={url} alt="" key={url} />
                                  ))}
                                </div>
                              </div>
                            )}
                            {app.admin_notes && (
                              <div className="detail-row">
                                <span className="label">Previous admin note</span>
                                {app.admin_notes}
                              </div>
                            )}

                            {canDecide && (
                              <>
                                <div className="field">
                                  <label>Note to Builder (required for deny with resubmit)</label>
                                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
                                </div>
                                <div className="btn-row">
                                  <button
                                    className="btn-primary"
                                    type="button"
                                    disabled={busy}
                                    onClick={() => decideApplication(app.id, "approve")}
                                  >
                                    Approve
                                  </button>
                                  <button
                                    className="btn-secondary"
                                    type="button"
                                    disabled={busy}
                                    onClick={() => decideApplication(app.id, "deny_resubmit")}
                                  >
                                    Deny, allow resubmit
                                  </button>
                                  <button
                                    className="btn-danger"
                                    type="button"
                                    disabled={busy}
                                    onClick={() => decideApplication(app.id, "deny_final")}
                                  >
                                    Deny (30-day cooldown)
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })()}
                  </>
                )}

                {tab === "builds" && (
                  <>
                    <div className="status-banner">
                      <span className="label">E9 conversion</span>
                      <span>
                        Builds a private, password-protected copy of the original E9 page from the dynamic template,
                        for side-by-side comparison. The live E9 page is not changed.
                      </span>
                      <button className="btn-secondary" type="button" disabled={e9Busy} onClick={createE9Copy}>
                        {e9Busy ? "Creating…" : e9Copy ? "Re-create copy" : "Create private E9 copy"}
                      </button>
                      {!e9Swapped && !e9ConfirmSwap && (
                        <button className="btn-secondary" type="button" disabled={e9Busy} onClick={() => setE9ConfirmSwap(true)}>
                          Swap into live E9…
                        </button>
                      )}
                      {e9ConfirmSwap && (
                        <span>
                          This makes the live E9 page render from the database copy.{" "}
                          <button className="btn-primary" type="button" disabled={e9Busy} onClick={swapE9}>
                            {e9Busy ? "Swapping…" : "Yes, swap now"}
                          </button>{" "}
                          <button className="btn-secondary" type="button" onClick={() => setE9ConfirmSwap(false)}>
                            Cancel
                          </button>
                        </span>
                      )}
                      {e9Swapped && (
                        <span>
                          Done. <a className="cta-link" href="/builds/71e9S38B36/">/builds/71e9S38B36/</a> now renders from the database.
                        </span>
                      )}
                      {e9Copy && (
                        <span>
                          <a className="cta-link" href={e9Copy.url} target="_blank" rel="noreferrer">
                            {e9Copy.url}
                          </a>{" "}
                          Password: <code>{e9Copy.password}</code> (shown once; re-creating issues a new one)
                        </span>
                      )}
                    </div>
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Title</th>
                          <th>Status</th>
                          <th>Submitted</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboard.builds.map((build) => {
                          const reviewable =
                            build.status === "submitted" ||
                            (build.status === "published" && build.visibility === "private");
                          return (
                            <tr key={build.id}>
                              <td>{build.title}</td>
                              <td>
                                <span className={`badge ${build.status}`}>{build.status}</span>
                                {build.status === "published" && build.visibility === "private" && (
                                  <span className="badge" style={{ marginLeft: 6 }}>private</span>
                                )}
                                {build.hidden && <span className="badge" style={{ marginLeft: 6 }}>hidden</span>}
                              </td>
                              <td>{fmtDate(build.created_at)}</td>
                              <td>
                                <div className="row-actions">
                                  <a
                                    className="btn-secondary"
                                    href={`/admin/preview/${build.id}`}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Preview
                                  </a>
                                  {reviewable && (
                                    <button
                                      className="btn-primary"
                                      type="button"
                                      disabled={busy}
                                      onClick={() => {
                                        setNotes("");
                                        setPrivateShare(null);
                                        setSelectedBuild(build.id);
                                      }}
                                    >
                                      Review
                                    </button>
                                  )}
                                  {build.status === "published" && (
                                    <button
                                      className="btn-secondary"
                                      type="button"
                                      disabled={busy}
                                      onClick={() => decideBuild(build.id, build.hidden ? "unhide" : "hide")}
                                    >
                                      {build.hidden ? "Unhide" : "Hide"}
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {dashboard.builds.length === 0 && (
                          <tr>
                            <td colSpan={4}>No build submissions yet.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>

                    {selectedBuild &&
                      (() => {
                        const build = dashboard.builds.find((b) => b.id === selectedBuild);
                        if (!build) return null;
                        const close = () => {
                          setSelectedBuild(null);
                          setPrivateShare(null);
                          setNotes("");
                        };
                        return (
                          <Modal title={build.title} onClose={close}>
                            {privateShare ? (
                              <>
                                <p style={{ margin: "0 0 12px" }}>
                                  Copy this now &mdash; the password can&rsquo;t be shown again (you can generate a new
                                  one).
                                </p>
                                <div className="detail-row">
                                  <span className="label">Link</span>
                                  {privateShare.url}
                                </div>
                                <div className="detail-row">
                                  <span className="label">Password</span>
                                  <code style={{ fontSize: 18, letterSpacing: 1 }}>{privateShare.password}</code>
                                </div>
                                <div className="btn-row">
                                  <button
                                    className="btn-primary"
                                    type="button"
                                    onClick={() =>
                                      navigator.clipboard?.writeText(
                                        `${privateShare.url}\nPassword: ${privateShare.password}`
                                      )
                                    }
                                  >
                                    Copy link + password
                                  </button>
                                  <button className="btn-secondary" type="button" onClick={close}>
                                    Done
                                  </button>
                                </div>
                              </>
                            ) : build.status === "submitted" ? (
                              <>
                                {build.admin_notes && (
                                  <div className="detail-row">
                                    <span className="label">Previous admin note</span>
                                    {build.admin_notes}
                                  </div>
                                )}
                                <div className="field">
                                  <label>Note to Builder (required if requesting changes)</label>
                                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
                                </div>
                                <div className="btn-row">
                                  <a
                                    className="btn-secondary"
                                    href={`/admin/preview/${build.id}`}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Preview page
                                  </a>
                                  <button
                                    className="btn-primary"
                                    type="button"
                                    disabled={busy}
                                    onClick={() => decideBuild(build.id, "publish")}
                                  >
                                    Publish
                                  </button>
                                  <button
                                    className="btn-secondary"
                                    type="button"
                                    disabled={busy}
                                    title="Live at its own link, but only viewable with a generated password. Not in search or the sitemap."
                                    onClick={() => decideBuild(build.id, "publish_private")}
                                  >
                                    Publish privately
                                  </button>
                                  <button
                                    className="btn-secondary"
                                    type="button"
                                    disabled={busy}
                                    onClick={() => decideBuild(build.id, "deny_resubmit")}
                                  >
                                    Request changes
                                  </button>
                                  <button
                                    className="btn-danger"
                                    type="button"
                                    disabled={busy}
                                    onClick={() => decideBuild(build.id, "deny_final")}
                                  >
                                    Deny
                                  </button>
                                </div>
                              </>
                            ) : (
                              <>
                                <p style={{ margin: "0 0 12px" }}>
                                  This build is published privately: only people with the link and password can see
                                  it, and it&rsquo;s kept out of search and the sitemap.
                                </p>
                                <div className="btn-row">
                                  <button
                                    className="btn-primary"
                                    type="button"
                                    disabled={busy}
                                    onClick={() => decideBuild(build.id, "new_password")}
                                  >
                                    New password
                                  </button>
                                  <button
                                    className="btn-secondary"
                                    type="button"
                                    disabled={busy}
                                    onClick={() => {
                                      if (
                                        window.confirm(
                                          "Make this build public? Anyone with the link will be able to see it and search engines can index it."
                                        )
                                      ) {
                                        decideBuild(build.id, "make_public");
                                      }
                                    }}
                                  >
                                    Make public
                                  </button>
                                  <button className="btn-secondary" type="button" onClick={close}>
                                    Close
                                  </button>
                                </div>
                              </>
                            )}
                          </Modal>
                        );
                      })()}
                  </>
                )}

                {tab === "builders" && (
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Handle</th>
                        <th>Description</th>
                        <th>Visibility</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.builders.map((b) => (
                        <tr key={b.user_id}>
                          <td>
                            <a className="cta-link" href={`/builders/${b.handle}/`}>
                              {b.handle}
                            </a>
                          </td>
                          <td>{b.description}</td>
                          <td>
                            <span className={`badge ${b.hidden ? "denied" : "published"}`}>
                              {b.hidden ? "hidden" : "visible"}
                            </span>
                          </td>
                          <td>
                            <button
                              className="btn-secondary"
                              type="button"
                              disabled={busy}
                              onClick={() => toggleBuilderHidden(b.user_id, !b.hidden)}
                            >
                              {b.hidden ? "Unhide" : "Hide"}
                            </button>
                          </td>
                        </tr>
                      ))}
                      {dashboard.builders.length === 0 && (
                        <tr>
                          <td colSpan={4}>No approved Builders yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}

                {tab === "users" && (
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.users.map((u) => (
                        <tr key={u.id}>
                          <td>{u.email ?? u.id}</td>
                          <td>{u.role}</td>
                          <td>
                            {u.banned ? <span className="badge banned">banned</span> : <span className="badge">active</span>}
                          </td>
                          <td>
                            {u.role !== "admin" && (
                              <button
                                className={u.banned ? "btn-secondary" : "btn-danger"}
                                type="button"
                                disabled={busy}
                                onClick={() => toggleBan(u.id, !u.banned)}
                              >
                                {u.banned ? "Unban" : "Ban"}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </div>
        </section>
      </main>

      <footer>
        <div className="wrap">
          <span>motori.us: one open record for every build.</span>
        </div>
      </footer>
    </>
  );
}
