"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useCallback, useEffect, useState, type ChangeEvent } from "react";

type AppStatus = "draft" | "submitted" | "denied_resubmit" | "denied_final" | "approved";

interface ApplicationData {
  id: string;
  handle: string;
  description: string;
  socials: string | null;
  photos: string[];
  photoUrls: string[];
  status: AppStatus;
  admin_notes: string | null;
  reapply_after: string | null;
}

interface MeResponse {
  role: string;
  application: ApplicationData | null;
  builder: { handle: string } | null;
}

const MAX_PHOTOS = 3;

export default function ApplyPage() {
  const { ready, authenticated, login, getAccessToken } = usePrivy();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loadingMe, setLoadingMe] = useState(false);

  const [handle, setHandle] = useState("");
  const [description, setDescription] = useState("");
  const [socials, setSocials] = useState("");
  const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
  const [existingPhotoUrls, setExistingPhotoUrls] = useState<string[]>([]);
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [saving, setSaving] = useState<"save" | "submit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState(false);

  const fetchMe = useCallback(async () => {
    setLoadingMe(true);
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } });
      const data: MeResponse = await res.json();
      setMe(data);
      if (data.application) {
        setHandle(data.application.handle);
        setDescription(data.application.description);
        setSocials(data.application.socials ?? "");
        setExistingPhotos(data.application.photos);
        setExistingPhotoUrls(data.application.photoUrls);
      }
    } catch {
      setError("Couldn't load your application. Try refreshing.");
    } finally {
      setLoadingMe(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (authenticated) fetchMe();
  }, [authenticated, fetchMe]);

  const totalPhotos = existingPhotos.length + newPhotos.length;

  function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (totalPhotos + files.length > MAX_PHOTOS) {
      setError(`No more than ${MAX_PHOTOS} photos allowed.`);
      return;
    }
    setNewPhotos((prev) => [...prev, ...files]);
    e.target.value = "";
  }

  function removeExistingPhoto(path: string) {
    const idx = existingPhotos.indexOf(path);
    setExistingPhotos((prev) => prev.filter((p) => p !== path));
    setExistingPhotoUrls((prev) => prev.filter((_, i) => i !== idx));
  }

  function removeNewPhoto(idx: number) {
    setNewPhotos((prev) => prev.filter((_, i) => i !== idx));
  }

  async function submitForm(action: "save" | "submit") {
    setError(null);
    setLastSaved(false);
    setSaving(action);
    try {
      const token = await getAccessToken();
      const form = new FormData();
      form.set("action", action);
      form.set("handle", handle);
      form.set("description", description);
      form.set("socials", socials);
      form.set("existingPhotos", JSON.stringify(existingPhotos));
      newPhotos.forEach((f) => form.append("newPhotos", f));

      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setNewPhotos([]);
      setLastSaved(true);
      await fetchMe();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(null);
    }
  }

  async function cancelApplication() {
    if (
      !window.confirm(
        "Cancel this application? Everything you've entered, including photos, will be deleted."
      )
    ) {
      return;
    }
    setError(null);
    setSaving("save");
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/applications", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setHandle("");
      setDescription("");
      setSocials("");
      setExistingPhotos([]);
      setExistingPhotoUrls([]);
      setNewPhotos([]);
      await fetchMe();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(null);
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
            <p className="eyebrow">Application</p>
            <h1 className="title mid">Be a Builder</h1>
            <p className="thesis">
              motori.us accepts exceptional, high-end builds and the people behind them. Tell
              us about yours.
            </p>
          </div>
        </section>

        <section>
          <div className="wrap">
            {!authenticated ? (
              <div className="formcard">
                <p className="lede" style={{ marginBottom: 20 }}>
                  Log in to start your application.
                </p>
                <button className="btn-primary" type="button" onClick={login}>
                  Log in
                </button>
              </div>
            ) : loadingMe ? (
              <p className="lede">Loading…</p>
            ) : me?.builder ? (
              <div className="formcard">
                <div className="status-banner ok">
                  <span className="label">Already a Builder</span>
                  <span>You&rsquo;re already an approved Builder on motori.us.</span>
                </div>
                <a className="cta-link" href={`/builders/${me.builder.handle}/`}>
                  View your Builder page &rarr;
                </a>
              </div>
            ) : me?.application?.status === "denied_final" &&
              me.application.reapply_after &&
              new Date(me.application.reapply_after) > new Date() ? (
              <div className="formcard">
                <div className="status-banner bad">
                  <span className="label">Application denied</span>
                  <span>
                    You can submit a new application after{" "}
                    {new Date(me.application.reapply_after).toLocaleDateString()}.
                  </span>
                </div>
                {me.application.admin_notes && <p className="lede">{me.application.admin_notes}</p>}
              </div>
            ) : me?.application?.status === "submitted" ? (
              <div className="formcard">
                <div className="status-banner warn">
                  <span className="label">Under review</span>
                  <span>Your application has been submitted and is awaiting review.</span>
                </div>
                <p className="field">
                  <label>Desired handle</label>
                  {me.application.handle}
                </p>
                <p className="field">
                  <label>Description</label>
                  {me.application.description}
                </p>
                {existingPhotoUrls.length > 0 && (
                  <div className="photo-grid">
                    {existingPhotoUrls.map((url) => (
                      <div className="photo-thumb" key={url}>
                        <img src={url} alt="" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="formcard">
                {me?.application?.status === "denied_resubmit" && (
                  <div className="status-banner warn">
                    <span className="label">Changes requested</span>
                    <span>{me.application.admin_notes}</span>
                  </div>
                )}
                {me?.application?.status === "draft" && (
                  <div className="status-banner" style={{ borderColor: "var(--line)" }}>
                    <span className="label">Draft</span>
                    <span>Saved. Finish whenever you&rsquo;re ready.</span>
                  </div>
                )}

                <div className="field">
                  <label htmlFor="handle">Desired Builder handle</label>
                  <input
                    id="handle"
                    type="text"
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)}
                    placeholder="your-shop-name"
                  />
                  <p className="hint">Lowercase letters, numbers, and hyphens. Becomes your motori.us URL.</p>
                </div>

                <div className="field">
                  <label htmlFor="description">Short builder description</label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Who you are and what you build."
                  />
                </div>

                <div className="field">
                  <label htmlFor="socials">Socials (recommended)</label>
                  <input
                    id="socials"
                    type="text"
                    value={socials}
                    onChange={(e) => setSocials(e.target.value)}
                    placeholder="@yourshop on Instagram"
                  />
                </div>

                <div className="field">
                  <label>Build photo{totalPhotos !== 1 ? "s" : ""} (1-3)</label>
                  <div className="photo-grid">
                    {existingPhotoUrls.map((url, i) => (
                      <div className="photo-thumb" key={existingPhotos[i]}>
                        <img src={url} alt="" />
                        <button
                          type="button"
                          className="remove"
                          onClick={() => removeExistingPhoto(existingPhotos[i])}
                          aria-label="Remove photo"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                    {newPhotos.map((file, i) => (
                      <div className="photo-thumb" key={file.name + i}>
                        <img src={URL.createObjectURL(file)} alt="" />
                        <button
                          type="button"
                          className="remove"
                          onClick={() => removeNewPhoto(i)}
                          aria-label="Remove photo"
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
                          onChange={handleFileSelect}
                          style={{ display: "none" }}
                        />
                      </label>
                    )}
                  </div>
                </div>

                {error && <p className="form-error">{error}</p>}
                {lastSaved && !error && <p className="hint">Saved.</p>}

                <div className="btn-row">
                  <button
                    className="btn-secondary"
                    type="button"
                    disabled={saving !== null}
                    onClick={() => submitForm("save")}
                  >
                    {saving === "save" ? "Saving…" : "Save"}
                  </button>
                  <button
                    className="btn-primary"
                    type="button"
                    disabled={saving !== null}
                    onClick={() => submitForm("submit")}
                  >
                    {saving === "submit"
                      ? "Submitting…"
                      : me?.application?.status === "denied_resubmit"
                        ? "Resubmit"
                        : "Submit"}
                  </button>
                  <button
                    className="btn-secondary btn-cancel"
                    type="button"
                    disabled={saving !== null}
                    onClick={cancelApplication}
                    style={{ marginLeft: "auto" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
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
