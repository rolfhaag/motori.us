"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useCallback, useEffect, useState, type ChangeEvent } from "react";

type BuildStatus = "draft" | "submitted" | "changes_requested" | "denied" | "published";

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
  draft_status: "none" | "running" | "done" | "failed";
  draft_error: string | null;
  draft_runs: number;
  draft_content: { hero?: { thesis?: string; specChips?: string[] }; baseline?: { glance?: unknown[]; detailed?: unknown[] }; roadmap?: unknown[]; updates?: unknown[] } | null;
}

const MAX_PHOTOS = 30;
const MAX_DOCS = 10;
const MAX_DRAFT_RUNS = 3; // first draft + 2 refreshes

// The status/action table the Builder dashboard is built around:
//   approved (published)      -> View
//   submitted                 -> View
//   unsubmitted (draft)       -> Edit
//   needs response (changes_requested) -> Edit
//   denied                    -> View
const STATUS_META: Record<BuildStatus, { label: string; action: "edit" | "view" }> = {
  draft: { label: "Unsubmitted", action: "edit" },
  submitted: { label: "Submitted", action: "view" },
  changes_requested: { label: "Needs response", action: "edit" },
  denied: { label: "Denied", action: "view" },
  published: { label: "Approved", action: "view" },
};

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
    slug: null as string | null,
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
  const [viewOnly, setViewOnly] = useState(false);
  const [saving, setSaving] = useState<"save" | "submit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState(false);
  const [draft, setDraft] = useState<{
    status: BuildRow["draft_status"];
    error: string | null;
    runs: number;
    content: BuildRow["draft_content"];
  }>({ status: "none", error: null, runs: 0, content: null });
  const [feedback, setFeedback] = useState("");
  const [draftBusy, setDraftBusy] = useState(false);

  const authedFetch = useCallback(
    async (url: string, init?: RequestInit) => {
      const token = await getAccessToken();
      return fetch(url, { ...init, headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` } });
    },
    [getAccessToken]
  );

  const loadBuilds = useCallback(async (): Promise<BuildRow[]> => {
    setLoading(true);
    setError(null);
    try {
      const res = await authedFetch("/api/builds");
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403) setHasBuilderProfile(false);
        else setError(data.error ?? "Couldn't load your builds.");
        return [];
      }
      setHasBuilderProfile(true);
      setBuilds(data.builds ?? []);
      return data.builds ?? [];
    } catch {
      setError("Couldn't load your builds.");
      return [];
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
      // Arriving via the "Add a Build" nav link or the roster's "+" card
      // (both link here with ?new=1) jumps straight into a blank form
      // instead of landing on the list first. Read directly from the URL
      // rather than useSearchParams, which would force this page out of
      // static rendering for a one-time, client-only check.
      if (new URLSearchParams(window.location.search).get("new") === "1") {
        startNew();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, getAccessToken, loadBuilds]);

  function startNew() {
    setForm(blankForm());
    setDraft({ status: "none", error: null, runs: 0, content: null });
    setFeedback("");
    setViewOnly(false);
    setEditing(true);
    setError(null);
    setLastSaved(false);
  }

  function applyRow(b: BuildRow) {
    setDraft({ status: b.draft_status, error: b.draft_error, runs: b.draft_runs, content: b.draft_content });
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
      slug: b.slug,
    });
  }

  function openBuild(b: BuildRow) {
    applyRow(b);
    setFeedback("");
    setViewOnly(STATUS_META[b.status].action === "view");
    setEditing(true);
    setError(null);
    setLastSaved(false);
  }

  const drafting = draft.status === "running";
  const locked = viewOnly || drafting;
  const hasDraft = Boolean(draft.content);
  const runsLeft = Math.max(0, MAX_DRAFT_RUNS - draft.runs);

  // Save the form without closing it, so a draft can be generated from
  // exactly what's on screen. Returns the build's id.
  async function saveInPlace(): Promise<string | null> {
    const body = new FormData();
    body.set("action", "save");
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
    const res = await authedFetch(form.id ? `/api/builds/${form.id}` : "/api/builds", { method: "POST", body });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return null;
    }
    const id: string = form.id ?? data.build.id;
    const rows = await loadBuilds();
    const row = rows.find((r) => r.id === id);
    if (row) applyRow(row);
    return id;
  }

  async function startDraft() {
    setError(null);
    setDraftBusy(true);
    try {
      const id = await saveInPlace();
      if (!id) return;
      const res = await authedFetch(`/api/builds/${id}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't start the draft.");
        return;
      }
      setDraft((d) => ({ ...d, status: "running", error: null }));
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setDraftBusy(false);
    }
  }

  // While a draft runs, poll until it settles, then pull the finished row.
  useEffect(() => {
    if (!drafting || !form.id) return;
    const id = form.id;
    const timer = setInterval(async () => {
      try {
        const res = await authedFetch(`/api/builds/${id}/draft`);
        const data = await res.json();
        if (res.ok && data.draft_status !== "running") {
          clearInterval(timer);
          const rows = await loadBuilds();
          const row = rows.find((r) => r.id === id);
          if (row) applyRow(row);
          setFeedback("");
        }
      } catch {
        /* keep polling */
      }
    }, 4000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drafting, form.id]);

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
                {form.status === "changes_requested" && (
                  <div className="status-banner warn">
                    <span className="label">Needs response</span>
                    <span>{form.adminNotes}</span>
                  </div>
                )}
                {form.status === "denied" && (
                  <div className="status-banner bad">
                    <span className="label">Denied</span>
                    <span>{form.adminNotes}</span>
                  </div>
                )}
                {form.status === "submitted" && (
                  <div className="status-banner warn">
                    <span className="label">Under review</span>
                    <span>This build has been submitted and is awaiting review.</span>
                  </div>
                )}
                {form.status === "published" && (
                  <div className="status-banner ok">
                    <span className="label">Approved</span>
                    <span>This build is live on motori.us.</span>
                    {form.slug && (
                      <>
                        {" "}
                        <a className="cta-link" href={`/builds/${form.slug}/`}>
                          View live &rarr;
                        </a>
                      </>
                    )}
                  </div>
                )}

                <div className="field">
                  <label htmlFor="make">Make</label>
                  <input
                    id="make"
                    type="text"
                    value={form.make}
                    disabled={locked}
                    onChange={(e) => setForm((f) => ({ ...f, make: e.target.value }))}
                    placeholder="Make"
                  />
                </div>
                <div className="field">
                  <label htmlFor="model">Model</label>
                  <input
                    id="model"
                    type="text"
                    value={form.model}
                    disabled={locked}
                    onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                    placeholder="Model"
                  />
                </div>
                <div className="field">
                  <label htmlFor="trim">Trim</label>
                  <input
                    id="trim"
                    type="text"
                    value={form.trim}
                    disabled={locked}
                    onChange={(e) => setForm((f) => ({ ...f, trim: e.target.value }))}
                    placeholder="Trim"
                  />
                </div>
                <div className="field">
                  <label htmlFor="vin">VIN</label>
                  <input
                    id="vin"
                    type="text"
                    value={form.vin}
                    disabled={locked}
                    onChange={(e) => setForm((f) => ({ ...f, vin: e.target.value }))}
                    placeholder="Chassis or VIN number"
                  />
                </div>
                <div className="field">
                  <label htmlFor="theme">Theme</label>
                  <textarea
                    id="theme"
                    value={form.theme}
                    disabled={locked}
                    onChange={(e) => setForm((f) => ({ ...f, theme: e.target.value }))}
                    placeholder="Two sentences max -- a creative brief for the AI that drafts this car's page."
                  />
                  {!viewOnly && (
                    <p className="hint">
                      Two sentences max. This informs the AI-drafted page -- it isn&rsquo;t displayed verbatim.
                    </p>
                  )}
                </div>
                <div className="field">
                  <label htmlFor="builderNotes">Notes to motori.us (optional)</label>
                  <textarea
                    id="builderNotes"
                    value={form.builderNotes}
                    disabled={locked}
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
                        {!viewOnly && (
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
                        )}
                      </div>
                    ))}
                    {!viewOnly &&
                      form.newPhotos.map((file, i) => (
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
                    {!viewOnly && totalPhotos < MAX_PHOTOS && (
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
                        {!viewOnly && (
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
                        )}
                      </div>
                    ))}
                    {!viewOnly &&
                      form.newDocuments.map((file, i) => (
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
                  {!viewOnly && totalDocs < MAX_DOCS && (
                    <label className="doc-add">
                      + Add PDF
                      <input type="file" accept="application/pdf" multiple onChange={handleDocSelect} style={{ display: "none" }} />
                    </label>
                  )}
                </div>

                {!viewOnly && (
                  <div className="field">
                    <label>Page draft</label>
                    {draft.status === "failed" && draft.error && (
                      <div className="status-banner warn">
                        <span className="label">Needs attention</span>
                        <span>{draft.error}</span>
                      </div>
                    )}
                    {drafting ? (
                      <p className="hint">
                        Drafting your page from your photos and documents. This can take a minute or two -- you can
                        leave this open.
                      </p>
                    ) : hasDraft ? (
                      <div className="doc-chip" style={{ display: "block" }}>
                        <p style={{ margin: "0 0 6px" }}>{draft.content?.hero?.thesis}</p>
                        <p className="hint" style={{ margin: 0 }}>
                          Draft ready: {draft.content?.baseline?.glance?.length ?? 0} at-a-glance facts,{" "}
                          {draft.content?.baseline?.detailed?.length ?? 0} detailed sections,{" "}
                          {draft.content?.roadmap?.length ?? 0} roadmap items.{" "}
                          {runsLeft > 0
                            ? `${runsLeft} update${runsLeft > 1 ? "s" : ""} left.`
                            : "No updates left."}
                        </p>
                      </div>
                    ) : (
                      <p className="hint">
                        Fill in the details above and add photos (and any PDFs), then generate your page draft. It must
                        be generated before you can submit.
                      </p>
                    )}
                    {hasDraft && runsLeft > 0 && !drafting && (
                      <>
                        <textarea
                          value={feedback}
                          maxLength={600}
                          onChange={(e) => setFeedback(e.target.value)}
                          placeholder="What should change? You can adjust the wording within each section and the photo order -- the page layout itself is fixed."
                          style={{ marginTop: 10 }}
                        />
                      </>
                    )}
                    {(!hasDraft || runsLeft > 0) && (
                      <div className="btn-row" style={{ marginTop: 12 }}>
                        <button
                          className="btn-secondary"
                          type="button"
                          disabled={draftBusy || drafting || saving !== null}
                          onClick={startDraft}
                        >
                          {draftBusy || drafting ? "Drafting…" : hasDraft ? "Update Draft" : "Generate Draft"}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {error && <p className="form-error">{error}</p>}
                {lastSaved && !error && <p className="hint">Saved.</p>}

                <div className="btn-row">
                  {!viewOnly && (
                    <>
                      <button
                        className="btn-secondary"
                        type="button"
                        disabled={saving !== null || drafting}
                        onClick={() => submitForm("save")}
                      >
                        {saving === "save" ? "Saving…" : "Save"}
                      </button>
                      <button
                        className="btn-primary"
                        type="button"
                        disabled={saving !== null || drafting || !hasDraft}
                        title={hasDraft ? undefined : "Generate your page draft first"}
                        onClick={() => submitForm("submit")}
                      >
                        {saving === "submit" ? "Submitting…" : "Submit"}
                      </button>
                    </>
                  )}
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
                    {builds.map((b) => {
                      const meta = STATUS_META[b.status];
                      return (
                        <tr key={b.id}>
                          <td>{[b.make, b.model, b.trim].filter(Boolean).join(" ") || "Untitled"}</td>
                          <td>
                            <span className={`badge ${b.status}`}>{meta.label}</span>
                          </td>
                          <td>
                            <div className="btn-row" style={{ marginTop: 0 }}>
                              <button className="btn-secondary" type="button" onClick={() => openBuild(b)}>
                                {meta.action === "edit" ? "Edit" : "View"}
                              </button>
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
                      );
                    })}
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
