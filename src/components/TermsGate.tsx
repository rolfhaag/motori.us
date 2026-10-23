"use client";

import { usePathname } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useCallback, useEffect, useState } from "react";

interface PendingDoc {
  type: string;
  title: string;
  version: string;
  path: string;
  effectiveDate: string;
  changeSummary: string;
}

// Browsing is never blocked. The prompt appears where an account is actually used.
const GATED_PREFIXES = ["/apply", "/builder", "/admin"];

/**
 * Asks a signed-in person to accept the current Terms of Use, Privacy Policy
 * and (for Builders) Builder Terms the first time, and again whenever a new
 * version is published. Acceptance is recorded server-side with the version.
 */
export default function TermsGate() {
  const pathname = usePathname();
  const { ready, authenticated, getAccessToken } = usePrivy();
  const [pending, setPending] = useState<PendingDoc[]>([]);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gated = GATED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  const check = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch("/api/legal/status", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      const data = await res.json();
      setPending(data.pending ?? []);
    } catch {
      /* the server still enforces acceptance on the actions that need it */
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (ready && authenticated && gated) check();
    else setPending([]);
  }, [ready, authenticated, gated, check]);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/legal/accept", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ docs: pending.map((d) => ({ type: d.type, version: d.version })) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not record your acceptance. Please try again.");
        if (res.status === 409) check();
        return;
      }
      setPending([]);
      setAgreed(false);
    } catch {
      setError("Could not record your acceptance. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!gated || pending.length === 0) return null;
  const firstTime = pending.every((d) => d.changeSummary.toLowerCase().startsWith("first"));

  return (
    <div className="share-modal" role="dialog" aria-modal="true" aria-labelledby="terms-gate-title">
      <div className="share-modal-card terms-gate">
        <p className="share-modal-title" id="terms-gate-title">
          {firstTime ? "Before you continue" : "We've updated our terms"}
        </p>
        <p className="terms-gate-lede">
          {firstTime
            ? "Please review and accept the following to use your motori.us account."
            : "Please review what changed and accept the new version to continue."}
        </p>
        <ul className="terms-gate-list">
          {pending.map((d) => (
            <li key={d.type}>
              <a href={`${d.path}`} target="_blank" rel="noopener noreferrer">
                {d.title}
              </a>
              <span className="terms-gate-ver"> version {d.version}</span>
              {!firstTime && d.changeSummary && <div className="terms-gate-sum">{d.changeSummary}</div>}
            </li>
          ))}
        </ul>
        <label className="terms-gate-check">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>
            I have read and agree to the {pending.map((d) => d.title).join(", ").replace(/, ([^,]*)$/, " and $1")}.
          </span>
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="btn-primary" type="button" disabled={!agreed || busy} onClick={accept}>
          {busy ? "Saving…" : "Accept and continue"}
        </button>
      </div>
    </div>
  );
}
