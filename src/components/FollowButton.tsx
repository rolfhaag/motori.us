"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { readJson } from "@/lib/clientImage";

const PENDING_KEY = "motori:pendingFollow";

function storage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Star "Follow" button beside Share / Nominate.
 * - Signed in: one press follows (email updates on); press again to unfollow.
 * - Signed out: opens a panel to sign up (then comes back here already
 *   following) or follow with just an email (double opt-in).
 */
export default function FollowButton({ scope, name }: { scope: string; name: string }) {
  const { ready, authenticated, login, getAccessToken } = usePrivy();
  const authRef = useRef({ getAccessToken });
  authRef.current = { getAccessToken };

  const [on, setOn] = useState(false);
  const [hasEmail, setHasEmail] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const call = useCallback(async (method: "GET" | "POST" | "DELETE") => {
    const token = await authRef.current.getAccessToken();
    const url = method === "DELETE" ? `/api/follows?scope=${encodeURIComponent(scope)}` : "/api/follows";
    const res = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(method === "POST" ? { "Content-Type": "application/json" } : {}) },
      body: method === "POST" ? JSON.stringify({ scope }) : undefined,
    });
    return { res, data: await readJson(res) };
  }, [scope]);

  // Load state once signed in; finish a follow that was waiting on sign-up.
  useEffect(() => {
    if (!ready) return;
    if (!authenticated) {
      setOn(false);
      setLoaded(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { res, data } = await call("GET");
        if (cancelled || !res.ok) return;
        const follows = (data.follows as { scope: string }[]) ?? [];
        const email = data.hasEmail !== false;
        setHasEmail(email);
        let following = follows.some((f) => f.scope === scope);
        const pending = storage()?.getItem(PENDING_KEY);
        if (pending === scope) {
          storage()?.removeItem(PENDING_KEY);
          if (!following && email) {
            const r = await call("POST");
            if (r.res.ok) {
              following = true;
              setFlash("You're following. We'll email you updates.");
            }
          } else if (!email) {
            setOpen(true);
          }
        }
        if (!cancelled) setOn(following);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, scope, call]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 4000);
    return () => clearTimeout(t);
  }, [flash]);

  async function onPress() {
    if (!authenticated || (!on && !hasEmail)) {
      setOpen(true);
      return;
    }
    if (busy) return;
    setBusy(true);
    const wasOn = on;
    setOn(!wasOn);
    try {
      const { res } = await call(wasOn ? "DELETE" : "POST");
      if (!res.ok) {
        setOn(wasOn);
        setFlash("Couldn't update. Please try again.");
      } else {
        setFlash(wasOn ? "Unfollowed." : "You're following. We'll email you updates.");
      }
    } catch {
      setOn(wasOn);
      setFlash("Couldn't update. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function signUp() {
    storage()?.setItem(PENDING_KEY, scope);
    setOpen(false);
    login();
  }

  return (
    <>
      <button
        className={`share-link follow-link${on ? " following" : ""}`}
        type="button"
        onClick={onPress}
        aria-pressed={on}
        disabled={!loaded && authenticated}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
          <path d="M12 3.5l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.8l6-.8z" />
        </svg>
        <span className="share-link-label">{on ? "Following" : "Follow"}</span>
      </button>
      {flash && (
        <span className="follow-flash" role="status">
          {flash}
        </span>
      )}
      {open && (
        <FollowSheet
          scope={scope}
          name={name}
          signedIn={authenticated}
          onSignUp={signUp}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function FollowSheet({
  scope,
  name,
  signedIn,
  onSignUp,
  onClose,
}: {
  scope: string;
  name: string;
  signedIn: boolean;
  onSignUp: () => void;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [hp, setHp] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<"sent" | "already" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, scope, source: window.location.pathname, website: hp }),
      });
      const data = await readJson(res);
      if (!res.ok) {
        setError((data.error as string) ?? "Something went wrong. Please try again.");
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
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card follow-sheet" role="dialog" aria-modal="true" aria-label={`Follow ${name}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h4>Follow {name}</h4>
          <button type="button" className="modal-x" aria-label="Close" onClick={onClose}>
            &times;
          </button>
        </div>
        {done ? (
          <>
            <p className="follow-msg">
              {done === "already"
                ? "You're already following. Thanks!"
                : "Check your inbox. We sent a link to confirm. Nothing else is sent until you do."}
            </p>
            <div className="btn-row">
              <button className="btn-secondary" type="button" onClick={onClose}>
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="follow-sub">We&rsquo;ll email you when there&rsquo;s news. Unsubscribe any time.</p>
            {!signedIn && (
              <>
                <button className="btn-primary" type="button" onClick={onSignUp}>
                  Sign up or log in to follow
                </button>
                <p className="follow-or">or follow with just your email</p>
              </>
            )}
            {signedIn && <p className="follow-sub">We don&rsquo;t have an email address for your account. Add one to follow.</p>}
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
              <input className="follow-hp" type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={hp} onChange={(e) => setHp(e.target.value)} />
              <button className="btn-secondary" type="submit" disabled={busy || !email.includes("@")}>
                {busy ? "Sending…" : "Follow by email"}
              </button>
            </form>
            {error && <p className="follow-msg bad">{error}</p>}
            <p className="follow-fine">
              Email-only follows need a confirmation link. See the <a href="/privacy">Privacy Policy</a>.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/** Mounts the button into a placeholder inside server-built HTML (the Builder page). */
export function FollowButtonPortal({ targetId, scope, name }: { targetId: string; scope: string; name: string }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setEl(document.getElementById(targetId));
  }, [targetId]);
  return el ? createPortal(<FollowButton scope={scope} name={name} />, el) : null;
}
