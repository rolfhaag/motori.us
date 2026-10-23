"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * "Follow" signup: email only, no account. Sends a confirmation email;
 * nothing else is sent until the person confirms (double opt-in).
 */
export default function FollowBox({
  scope,
  heading,
  sub,
  source,
}: {
  scope: string;
  heading: string;
  sub: string;
  source: string;
}) {
  const [email, setEmail] = useState("");
  const [hp, setHp] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<"sent" | "already" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, scope, source, website: hp }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setDone(data.state === "already_confirmed" ? "already" : "sent");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="followbox">
      <h3>{heading}</h3>
      <p className="follow-sub">{sub}</p>
      {done ? (
        <p className="follow-msg">
          {done === "already"
            ? "You're already following. Thanks!"
            : "Check your inbox. We sent a link to confirm. Nothing else is sent until you do."}
        </p>
      ) : (
        <form onSubmit={submit} noValidate>
          <input
            type="email"
            name="email"
            placeholder="you@example.com"
            autoComplete="email"
            inputMode="email"
            aria-label="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="follow-hp"
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            value={hp}
            onChange={(e) => setHp(e.target.value)}
          />
          <button className="btn-primary" type="submit" disabled={busy || !email.includes("@")}>
            {busy ? "Sending…" : "Follow"}
          </button>
        </form>
      )}
      {error && <p className="follow-msg bad">{error}</p>}
      {!done && (
        <p className="follow-fine">
          We&rsquo;ll email you a link to confirm. Unsubscribe any time. See the{" "}
          <a href="/privacy">Privacy Policy</a>.
        </p>
      )}
    </div>
  );
}

/**
 * Renders a FollowBox into a placeholder element that lives inside
 * server-built HTML (the hand-built home page and the Builder page).
 */
export function FollowPortal({
  targetId,
  ...props
}: {
  targetId: string;
  scope: string;
  heading: string;
  sub: string;
  source: string;
}) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setEl(document.getElementById(targetId));
  }, [targetId]);
  return el ? createPortal(<FollowBox {...props} />, el) : null;
}
