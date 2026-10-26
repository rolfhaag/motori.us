"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useState } from "react";
import { readJson } from "@/lib/clientImage";

interface InviteInfo {
  state: "open" | "used" | "expired" | "revoked" | "invalid";
  name?: string | null;
  suggestedHandle?: string;
  terms?: { title: string; version: string; path: string };
}

/** Spotter setup: log in, accept the terms, pick a handle and name. About a minute. */
export default function SpotterJoin() {
  const { ready, authenticated, login, getAccessToken } = usePrivy();
  const [token, setToken] = useState<string | null>(null);
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [social, setSocial] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("t");
    setToken(t);
    if (!t) {
      setInfo({ state: "invalid" });
      return;
    }
    fetch(`/api/spotter/invite?t=${encodeURIComponent(t)}`)
      .then((r) => r.json())
      .then((d: InviteInfo) => {
        setInfo(d);
        if (d.name) setDisplayName(d.name);
        if (d.suggestedHandle) setHandle(d.suggestedHandle);
      })
      .catch(() => setInfo({ state: "invalid" }));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!info?.terms || !token) return;
    setBusy(true);
    setError(null);
    try {
      const at = await getAccessToken();
      const res = await fetch("/api/spotter/join", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${at}` },
        body: JSON.stringify({ token, handle, displayName, socialUrl: social, termsVersion: agree ? info.terms.version : "" }),
      });
      const data = await readJson(res);
      if (res.ok || data.code === "already_spotter") {
        window.location.href = "/spotter";
        return;
      }
      setError((data.error as string) ?? "Something went wrong. Please try again.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!ready || !info) return <p className="lede">Loading…</p>;

  if (info.state !== "open") {
    const why =
      info.state === "used"
        ? "This invite link has already been used."
        : info.state === "expired"
          ? "This invite link has expired."
          : info.state === "revoked"
            ? "This invite link was cancelled."
            : "This invite link isn't valid.";
    return (
      <div className="status-banner bad">
        <span className="label">Invite unavailable</span>
        <span>{why} Ask for a new one.</span>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="formcard">
        <p className="lede" style={{ marginBottom: 20 }}>
          {info.name ? `${info.name}, log` : "Log"} in or sign up with your email to set up your Spotter page. We&rsquo;ll send you a
          short code.
        </p>
        <button className="btn-primary" type="button" onClick={login}>
          Log in or sign up
        </button>
      </div>
    );
  }

  return (
    <form className="formcard" onSubmit={submit}>
      <div className="field">
        <label htmlFor="sp-handle">Handle</label>
        <input
          id="sp-handle"
          type="text"
          value={handle}
          onChange={(e) => setHandle(e.target.value.toLowerCase())}
          placeholder="your-handle"
          autoCapitalize="none"
          autoCorrect="off"
        />
        <p className="hint">Lowercase letters, numbers and hyphens. Becomes your page: motori.us/spotters/your-handle</p>
      </div>
      <div className="field">
        <label htmlFor="sp-name">Display name</label>
        <input id="sp-name" type="text" value={displayName} maxLength={40} onChange={(e) => setDisplayName(e.target.value)} placeholder="How your name should read" />
      </div>
      <div className="field">
        <label htmlFor="sp-social">Your Instagram, TikTok or YouTube (optional)</label>
        <input id="sp-social" type="text" value={social} onChange={(e) => setSocial(e.target.value)} placeholder="@yourhandle or a full link" autoCapitalize="none" />
      </div>
      <label className="consent-check">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <span>
          I have read and agree to the{" "}
          <a href={info.terms?.path ?? "/spotter-terms"} target="_blank" rel="noopener noreferrer">
            {info.terms?.title ?? "Spotter Terms"}
          </a>
          .
        </span>
      </label>
      {error && <p className="form-error">{error}</p>}
      <div className="btn-row">
        <button className="btn-primary" type="submit" disabled={busy || !agree || handle.length < 3 || displayName.trim().length < 2}>
          {busy ? "Setting up…" : "Finish setup"}
        </button>
      </div>
    </form>
  );
}
