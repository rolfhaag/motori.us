"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";

function Inner() {
  const token = useSearchParams().get("token") ?? "";
  const [info, setInfo] = useState<{ label: string; email: string; scopeKind: string } | null>(null);
  const [state, setState] = useState<"loading" | "unsubscribed" | "undone" | "all" | "invalid">("loading");

  async function post(body: Record<string, unknown>) {
    return fetch("/api/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, ...body }),
    });
  }

  // Opening the link unsubscribes right away (a prefetching mail scanner doesn't run this script).
  useEffect(() => {
    if (!token) return setState("invalid");
    (async () => {
      try {
        const r = await fetch(`/api/subscription?token=${encodeURIComponent(token)}`);
        if (!r.ok) return setState("invalid");
        setInfo(await r.json());
        const u = await post({});
        setState(u.ok ? "unsubscribed" : "invalid");
      } catch {
        setState("invalid");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="formcard" style={{ maxWidth: 560 }}>
      {state === "loading" && <p className="lede">Unsubscribing…</p>}
      {state === "invalid" && (
        <p className="lede">This link isn&rsquo;t valid. If you still get emails you don&rsquo;t want, reply to one and we&rsquo;ll remove you.</p>
      )}
      {state === "unsubscribed" && info && (
        <>
          <p className="lede" style={{ marginBottom: 14 }}>
            Done. {info.email} won&rsquo;t get {info.label} any more.
          </p>
          <p className="hint">
            Unsubscribed by mistake?{" "}
            <button
              type="button"
              className="cta-link"
              style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }}
              onClick={async () => {
                await post({ undo: true });
                setState("undone");
              }}
            >
              Undo
            </button>
            {" · "}
            <button
              type="button"
              className="cta-link"
              style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }}
              onClick={async () => {
                await post({ all: true });
                setState("all");
              }}
            >
              Unsubscribe from everything
            </button>
          </p>
        </>
      )}
      {state === "undone" && <p className="lede">Welcome back. You&rsquo;ll keep getting updates.</p>}
      {state === "all" && <p className="lede">You&rsquo;re unsubscribed from all motori.us updates.</p>}
      <p style={{ marginTop: 18 }}>
        <a className="cta-link" href="/">
          Back to motori.us &rarr;
        </a>
      </p>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero compact">
          <div className="wrap">
            <p className="eyebrow">Follow</p>
            <h1 className="title mid">Unsubscribe</h1>
          </div>
        </section>
        <section>
          <div className="wrap">
            <Suspense fallback={<p className="lede">Loading…</p>}>
              <Inner />
            </Suspense>
          </div>
        </section>
      </main>
    </>
  );
}
