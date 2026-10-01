"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Renders into #auth-slot, a span placed inside each page's own navright nav
// (right after "Be a Builder"), so the account pill sits in the normal nav
// flow instead of floating as a fixed overlay -- which collided with the
// "Be a Builder" button once both existed. A portal keeps all the
// login/logout/role-sync logic in one component while letting each page's
// markup decide where it actually renders.
export default function AuthButton() {
  const { ready, authenticated, user, login, logout, getAccessToken } = usePrivy();
  const [role, setRole] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setSlot(document.getElementById("auth-slot"));
  }, []);

  useEffect(() => {
    if (!authenticated) {
      setRole(null);
      return;
    }
    let cancelled = false;
    setSyncing(true);
    (async () => {
      try {
        const token = await getAccessToken();
        const res = await fetch("/api/auth/sync", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!cancelled) setRole(data.role ?? null);
      } catch {
        if (!cancelled) setRole(null);
      } finally {
        if (!cancelled) setSyncing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authenticated, getAccessToken]);

  if (!ready || !slot) return null;

  const pillStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 14px",
    borderRadius: 100,
    border: "1px solid #E3DCC8",
    background: "#F3EEDF",
    color: "#17140F",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Source Sans 3', Helvetica, Arial, sans-serif",
  };

  const content = !authenticated ? (
    <button style={pillStyle} onClick={login} type="button">
      Log in
    </button>
  ) : (
    <button style={pillStyle} onClick={logout} type="button">
      {syncing ? "Syncing…" : role ? `${user?.email?.address ?? "Account"} · ${role}` : "Account"}
    </button>
  );

  return createPortal(content, slot);
}
