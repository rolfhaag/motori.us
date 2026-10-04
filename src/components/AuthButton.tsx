"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Renders into #auth-slot, a span placed inside each page's own navright nav
// (right after "Be a Builder"), so the account control sits in the normal nav
// flow instead of floating as a fixed overlay -- which collided with the
// "Be a Builder" button once both existed. A portal keeps all the
// login/logout/role-sync logic in one component while letting each page's
// markup decide where it actually renders.
//
// Logged in, this renders as a small circular avatar rather than a full
// text pill: a pill wide enough to show an email address was the thing
// colliding with "Be a Builder" and the breadcrumb trail on narrower
// screens. The avatar opens a dropdown with the account details instead.
export default function AuthButton() {
  const { ready, authenticated, user, login, logout, getAccessToken } = usePrivy();
  const [role, setRole] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!ready || !slot) return null;

  const fontFamily =
    "-apple-system, BlinkMacSystemFont, 'Source Sans 3', Helvetica, Arial, sans-serif";

  const loginPillStyle: React.CSSProperties = {
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
    fontFamily,
  };

  if (!authenticated) {
    return createPortal(
      <button style={loginPillStyle} onClick={login} type="button">
        Log in
      </button>,
      slot
    );
  }

  const email = user?.email?.address ?? "";
  const initial = email ? email[0]!.toUpperCase() : "•";
  const roleLabel = role ? role[0]!.toUpperCase() + role.slice(1) : null;

  const avatarStyle: React.CSSProperties = {
    width: 34,
    height: 34,
    borderRadius: "50%",
    border: "1px solid #E3DCC8",
    background: "#F3EEDF",
    color: "#17140F",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily,
    padding: 0,
    lineHeight: 1,
    flexShrink: 0,
    transition: "border-color 0.15s ease",
  };

  const menuStyle: React.CSSProperties = {
    position: "absolute",
    top: "calc(100% + 10px)",
    right: 0,
    minWidth: 200,
    background: "#FAF6EA",
    border: "1px solid #E3DCC8",
    borderRadius: 12,
    boxShadow: "0 10px 30px rgba(23, 20, 15, 0.14)",
    padding: 6,
    fontFamily,
    zIndex: 50,
  };

  const menuHeaderStyle: React.CSSProperties = {
    padding: "8px 10px 10px",
    borderBottom: "1px solid #E3DCC8",
    marginBottom: 4,
  };

  const menuItemStyle: React.CSSProperties = {
    display: "block",
    width: "100%",
    textAlign: "left",
    padding: "8px 10px",
    borderRadius: 8,
    border: "none",
    color: "#17140F",
    fontSize: 13.5,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily,
    textDecoration: "none",
    transition: "background 0.1s ease",
  };

  const content = (
    <div ref={rootRef} style={{ position: "relative", display: "inline-flex" }}>
      <button
        className="account-avatar-btn"
        style={avatarStyle}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        title={syncing ? "Syncing…" : email || "Account"}
      >
        {syncing ? "…" : initial}
      </button>
      {open && (
        <div style={menuStyle} role="menu">
          <div style={menuHeaderStyle}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "#17140F", wordBreak: "break-all" }}>
              {email || "Account"}
            </div>
            {roleLabel && (
              <div style={{ fontSize: 12, color: "#55503F", marginTop: 2 }}>{roleLabel}</div>
            )}
          </div>
          {(role === "builder" || role === "admin") && (
            <a
              href="/builder"
              className="account-menu-item"
              style={menuItemStyle}
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              Builder dashboard
            </a>
          )}
          {role === "admin" && (
            <a
              href="/admin"
              className="account-menu-item"
              style={menuItemStyle}
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              Admin dashboard
            </a>
          )}
          <button
            className="account-menu-item"
            style={menuItemStyle}
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              logout();
            }}
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );

  return createPortal(content, slot);
}
