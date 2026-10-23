"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import SiteHeader from "@/components/SiteHeader";

export type AdminFetch = (url: string, init?: RequestInit) => Promise<Response>;

/** Common frame for small Admin-only pages: login, role check, then `children(authedFetch)`. */
export default function AdminShell({
  title,
  children,
}: {
  title: string;
  children: (authedFetch: AdminFetch) => ReactNode;
}) {
  const { authenticated, login, getAccessToken } = usePrivy();
  const [role, setRole] = useState<string | null>(null);

  const authedFetch = useCallback<AdminFetch>(
    async (url, init) => {
      const token = await getAccessToken();
      return fetch(url, { ...init, headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` } });
    },
    [getAccessToken]
  );

  useEffect(() => {
    if (!authenticated) return;
    authedFetch("/api/me")
      .then((r) => r.json())
      .then((me) => setRole(me.role ?? "applicant"))
      .catch(() => setRole("applicant"));
  }, [authenticated, authedFetch]);

  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero compact">
          <div className="wrap">
            <p className="eyebrow">Admin</p>
            <h1 className="title mid">{title}</h1>
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
            ) : role === null ? (
              <p className="lede">Loading…</p>
            ) : role !== "admin" ? (
              <div className="status-banner bad">
                <span className="label">Not authorized</span>
                <span>This page is for Admins only.</span>
              </div>
            ) : (
              children(authedFetch)
            )}
          </div>
        </section>
      </main>
    </>
  );
}
