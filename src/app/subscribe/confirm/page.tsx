"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import SiteHeaderClient from "@/components/SiteHeader";

function Inner() {
  const token = useSearchParams().get("token") ?? "";
  const [info, setInfo] = useState<{ label: string; status: string; email: string } | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "done" | "invalid">("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return setState("invalid");
    fetch(`/api/subscription?token=${encodeURIComponent(token)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return setState("invalid");
        setInfo(d);
        setState(d.status === "confirmed" ? "done" : "ready");
      })
      .catch(() => setState("invalid"));
  }, [token]);

  async function confirm() {
    setBusy(true);
    const r = await fetch("/api/subscribe/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    setBusy(false);
    if (r.ok) setState("done");
  }

  return (
    <div className="formcard" style={{ maxWidth: 560 }}>
      {state === "loading" && <p className="lede">Loading…</p>}
      {state === "invalid" && <p className="lede">This confirmation link isn&rsquo;t valid. Please sign up again from the site.</p>}
      {state === "ready" && info && (
        <>
          <p className="lede" style={{ marginBottom: 18 }}>
            Confirm that {info.email} should get {info.label}.
          </p>
          <button className="btn-primary" type="button" onClick={confirm} disabled={busy}>
            {busy ? "Confirming…" : "Yes, send me updates"}
          </button>
        </>
      )}
      {state === "done" && (
        <p className="lede">You&rsquo;re in. We&rsquo;ll email you when there&rsquo;s something new. Every email has an unsubscribe link.</p>
      )}
      <p style={{ marginTop: 18 }}>
        <a className="cta-link" href="/">
          Back to motori.us &rarr;
        </a>
      </p>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <>
      <SiteHeaderClient />
      <main>
        <section className="hero compact">
          <div className="wrap">
            <p className="eyebrow">Follow</p>
            <h1 className="title mid">Confirm your subscription</h1>
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
