"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useState } from "react";

export default function AuthButton() {
  const { ready, authenticated, user, login, logout, getAccessToken } = usePrivy();
  const [role, setRole] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

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

  if (!ready) return null;

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
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Source Sans 3', Helvetica, Arial, sans-serif",
  };

  const wrapperStyle: React.CSSProperties = {
    position: "fixed",
    top: 14,
    right: 16,
    zIndex: 50,
  };

  if (!authenticated) {
    return (
      <div style={wrapperStyle}>
        <button style={pillStyle} onClick={login} type="button">
          Log in
        </button>
      </div>
    );
  }

  return (
    <div style={wrapperStyle}>
      <button style={pillStyle} onClick={logout} type="button">
        {syncing ? "Syncing…" : role ? `${user?.email?.address ?? "Account"} · ${role}` : "Account"}
      </button>
    </div>
  );
}
