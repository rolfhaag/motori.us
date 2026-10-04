"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useCallback, useEffect, useState, type ChangeEvent } from "react";

type BuildStatus = "draft" | "submitted" | "denied" | "published";

interface DocEntry {
  path: string;
  filename: string;
}

interface BuildRow {
  id: string;
  make: string | null;
  model: string | null;
  trim: string | null;
  vin: string | null;
  theme: string | null;
  builder_notes: string | null;
  photos: { path: string }[];
  documents: DocEntry[];
  photoUrls: string[];
  documentUrls: { filename: string; url: string }[];
  status: BuildStatus;
  admin_notes: string | null;
  slug: string | null;
  created_at: string;
}

const MAX_PHOTOS = 30;
const MAX_DOCS = 10;
const EDITABLE: BuildStatus[] = ["draft", "denied"];

function blankForm() {
  return {
    id: null as string | null,
    make: "",
    model: "",
    trim: "",
    vin: "",
    theme: "",
    builderNotes: "",
    existingPhotos: [] as string[],
    existingPhotoUrls: [] as string[],
    existingDocuments: [] as DocEntry[],
    newPhotos: [] as File[],
    newDocuments: [] as File[],
    status: "draft" as BuildStatus,
    adminNotes: null as string | null,
  };
}

export default function BuilderPage() {
  const { ready, authenticated, login, getAccessToken } = usePrivy();
  const [role, setRole] = useState<string | null>(null);
  const [hasBuilderProfile, setHasBuilderProfile] = useState<boolean | null>(null);
  const [builds, setBuilds] = useState<BuildRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(blankForm());
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState<"save" | "submit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState(false);

  const authedFetch = useCallback(
    async (url: string, init?: RequestInit) => {
      const token = await getAccessToken();
      return fetch(url, { ...init, headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` } });
    },
    [getAccessToken]
  );

  const loadBuilds = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authedFetch("/api/builds");
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403) setHasBuilderProfile(false);
        else setError(data.error ?? "Couldn't load your builds.");
        return;
      }
      setHasBuilderProfile(true);
      setBuilds(data.builds ?? []);
    } catch {
      setError("Couldn't load your builds.");
    } finally {
      setLoading(false);
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
      } catch {
        setError("Couldn't verify your account.");
      }
      await loadBuilds();
    })();
  }, [authenticated, getAccessToken, loadBuilds]);

  function startNew() {
    setForm(blankForm());
    setEditing(true);
    setError(null);
    setLastSaved(false);
  }

  function startEdit(b: BuildRow) {
    setForm({
      id: b.id,
      make: b.make ?? "",
      model: b.model ?? "",
      trim: b.trim ?? "",
      vin: b.vin ?? "",
      theme: b.theme ?? "",
      builderNotes: b.builder_notes ?? "",
      existingPhotos: b.photos.map((p) => p.path),
      existingPhotoUrls: b.photoUrls,
      existingDocuments: b.documents,
      newPhotos: [],
      newDocuments: [],
      status: b.status,
      adminNotes: b.admin_notes,
    });
    setEditing(true);
    setError(null);
    setLastSaved(false);
  }

  const totalPhotos = form.existingPhotos.length + form.newPhotos.length;
  const totalDocs = form.existingDocuments.length + form.newDocuments.length;

  function handlePhotoSelect(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (totalPhotos + files.length > MAX_PHOTOS) {
      setError(`No more than ${MAX_PHOTOS} photos allowed.`);
      return;
    }
    setForm((f) => ({ ...f, newPhotos: [...f.newPhotos, ...files] }));
    e.target.value = "";
  }

  function handleDocSelect(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type === "application/pdf");
    if (totalDocs + files.length > MAX_DOCS) {
      setError(`No more than ${MAX_DOCS} documents allowed.`);
      return;
    }
    setForm((f) => ({ ...f, newDocuments: [...f.newDocuments, ...files] }));
    e.target.value = "";
  }

  async function submitForm(action: "save" | "submit") {
    setError(null);
    setLastSaved(false);
    setSaving(action);
    try {
      const body = new FormData();
      body.set("action", action);
      body.set("make", form.make);
      body.set("model", form.model);
      body.set("trim", form.trim);
      body.set("vin", form.vin);
      body.set("theme", form.theme);
      body.set("builderNotes", form.builderNotes);
      if (form.id) {
        body.set("existingPhotos", JSON.stringify(form.existingPhotos));
        body.set("existingDocuments", JSON.stringify(form.existingDocuments.map((d) => d.path)));
      }
      form.newPhotos.forEach((f) => body.append("newPhotos", f));
      form.newDocuments.forEach((f) => body.append("newDocuments", f));

      const url = form.id ? `/api/builds/${form.id}` : "/api/builds";
      const res = await authedFetch(url, { method: "POST", body });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setLastSaved(true);
      setEditing(false);
      await loadBuilds();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(null);
    }
  }

  async function cancelDraft(id: string) {
    if (!window.confirm("Delete this draft build? Everything entered, including photos, will be deleted.")) {
      return;
    }
    setError(null);
    try {
      const res = await authedFetch(`/api/builds/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      await loadBuilds();
    } catch {
      setError("Something went wrong.");
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
            <p className="eyebrow">Builder</p>
            <h1 className="title mid">Your Builds</h1>
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
            ) : role !== null && role !== "builder" && role !== "admin" ? (
              <div className="status-banner bad">
                <span className="label">Not a Builder</span>
                <span>
                  This page is for approved Builders. <a href="/apply/">Apply here</a> if you haven&rsquo;t
                  yet.
                </span>
              </div>
            ) : hasBuilderProfile === false ? (
              <div className="status-banner bad">
                <span className="label">Builder profile required</span>
                <span>Your account doesn&rsquo;t have an approved Builder profile yet.</span>
              </div>
            ) : loading ? (
              <p className="lede">Loading…</p>
            ) : editing ? (
              <div className="formcard">
                {form.status === "denied" && (
                  <div className="status-banner warn">
                    <span className="label">Changes requested</span>
                    <span>{form.adminNotes}</span>
                  </div>
                )}

                <div className="field">
                  <label htmlFor="make">Make</label>
                  <input
                    id="make"
                    type="text"
                    value={form.make}
                    onChange={(e) => setForm((f) => ({ ...f, make: e.target.value }))}
                    placeholder="BMW"
                  />
                </div>
                <div className="field">
                  <label htmlFor="model">Model</label>
                  <input
                    id="model"
                    type="text"
                    value={form.model}
                    onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                    placeholder="E9"
                  />
                </div>
                <div className="field">
                  <label htmlFor="trim">Trim</label>
                  <input
                    id="trim"
                    type="text"
                    value={form.trim}
                    onChange={(e) => setForm((f) => ({ ...f, trim: e.target.value }))}
                    placeholder="S38B36"
                  />
                </div>
                <div className="field">
                  <label htmlFor="vin">VIN</label>
                  <input
                    id="vin"
                    type="text"
                    value={form.vin}
                    onChange={(e) => setForm((f) => ({ ...f, vin: e.target.value }))}
                    placeholder="Chassis or VIN number"
                  />
                </div>
                <div className="field">
                  <label htmlFor="theme">Theme</label>
                  <textarea
                    id="theme"
                    value={form.theme}
                    onChange={(e) => setForm((f) => ({ ...f, theme: e.target.value }))}
                    placeholder="Two sentences max -- a creative brief for the AI that drafts this car's page."
                  />
                  <p className="hint">
                    Two sentences max. This informs the AI-drafted page -- it isn&rsquo;t displayed verbatim.
                  </p>
                </div>
                <div className="field">
                  <label htmlFor="builderNotes">Notes to motori.us (optional)</label>
                  <textarea
                    id="builderNotes"
                    value={form.builderNotes}
                    onChange={(e) => setForm((f) => ({ ...f, builderNotes: e.target.value }))}
                    placeholder="Anything our team should know before reviewing this."
                  />
                </div>

                <div className="field">
                  <label>
                    Photos ({totalPhotos}/{MAX_PHOTOS})
                  </label>
                  <div className="photo-grid" style={{ maxWidth: "none" }}>
                    {form.existingPhotoUrls.map((url, i) => (
                      <div className="photo-thumb" key={form.existingPhotos[i]}>
                        <img src={url} alt="" />
                        <button
                          type="button"
                          className="remove"
                          aria-label="Remove photo"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              existingPhotos: f.existingPhotos.filter((_, idx) => idx !== i),
                              existingPhotoUrls: f.existingPhotoUrls.filter((_, idx) => idx !== i),
                            }))
                          }
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                    {form.newPhotos.map((file, i) => (
                      <div className="photo-thumb" key={file.name + i}>
                        <img src={URL.createObjectURL(file)} alt="" />
                        <button
                          type="button"
                          className="remove"
                          aria-label="Remove photo"
                          onClick={() =>
                            setForm((f) => ({ ...f, newPhotos: f.newPhotos.filter((_, idx) => idx !== i) }))
                          }
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                    {totalPhotos < MAX_PHOTOS && (
                      <label className="photo-add">
                        + Add
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handlePhotoSelect}
                          style={{ display: "none" }}
                        />
                      </label>
                    )}
                  </div>
                </div>

                <div className="field">
                  <label>
                    Documents ({totalDocs}/{MAX_DOCS})
                  </label>
                  <div className="doc-chip-list">
                    {form.existingDocuments.map((doc, i) => (
                      <div className="doc-chip" key={doc.path}>
                        <span className="doc-chip-name">{doc.filename}</span>
                        <button
                          type="button"
                          className="remove"
                          aria-label="Remove document"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              existingDocuments: f.existingDocuments.filter((_, idx) => idx !== i),
                            }))
                          }
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                    {form.newDocuments.map((file, i) => (
                      <div className="doc-chip" key={file.name + i}>
                        <span className="doc-chip-name">{file.name}</span>
                        <button
                          type="button"
                          className="remove"
                          aria-label="Remove document"
                          onClick={() =>
                            setForm((f) => ({ ...f, newDocuments: f.newDocuments.filter((_, idx) => idx !== i) }))
                          }
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                  {totalDocs < MAX_DOCS && (
                    <label className="doc-add">
                      + Add PDF
                      <input type="file" accept="application/pdf" multiple onChange={handleDocSelect} style={{ display: "none" }} />
                    </label>
                  )}
                </div>

                {error && <p className="form-error">{error}</p>}
                {lastSaved && !error && <p className="hint">Saved.</p>}

                <div className="btn-row">
                  <button className="btn-secondary" type="button" disabled={saving !== null} onClick={() => submitForm("save")}>
                    {saving === "save" ? "Saving…" : "Save"}
                  </button>
                  <button className="btn-primary" type="button" disabled={saving !== null} onClick={() => submitForm("submit")}>
                    {saving === "submit" ? "Submitting…" : "Submit"}
                  </button>
                  <button
                    className="btn-secondary btn-cancel"
                    type="button"
                    disabled={saving !== null}
                    onClick={() => setEditing(false)}
                    style={{ marginLeft: "auto" }}
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="btn-row" style={{ marginTop: 0, marginBottom: 22 }}>
                  <button className="btn-primary" type="button" onClick={startNew}>
                    + New Build
                  </button>
                </div>

                {error && <p className="form-error">{error}</p>}

                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Build</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {builds.map((b) => (
                      <tr key={b.id}>
                        <td>{[b.make, b.model, b.trim].filter(Boolean).join(" ") || "Untitled"}</td>
                        <td>
                          <span className={`badge ${b.status}`}>{b.status}</span>
                        </td>
                        <td>
                          <div className="btn-row" style={{ marginTop: 0 }}>
                            {EDITABLE.includes(b.status) ? (
                              <button className="btn-secondary" type="button" onClick={() => startEdit(b)}>
                                Edit
                              </button>
                            ) : (
                              <button className="btn-secondary" type="button" onClick={() => startEdit(b)} disabled>
                                {b.status === "submitted" ? "Under review" : "View"}
                              </button>
                            )}
                            {b.status === "draft" && (
                              <button className="btn-danger" type="button" onClick={() => cancelDraft(b.id)}>
                                Delete
                              </button>
                            )}
                            {b.status === "published" && b.slug && (
                              <a className="cta-link" href={`/builds/${b.slug}/`}>
                                View live &rarr;
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {builds.length === 0 && (
                      <tr>
                        <td colSpan={3}>No builds yet. Start your first one above.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
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
