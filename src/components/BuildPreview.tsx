"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useState } from "react";
import Script from "next/script";
import BuildPageView, { ViewBuild, ViewPhoto } from "@/components/BuildPageView";
import type { DraftContent } from "@/lib/buildDraft";

interface Preview {
  build: ViewBuild & { status: string; visibility: string };
  draft: DraftContent | null;
  photos: ViewPhoto[];
  handle: string | null;
}

/**
 * Logged-in preview of a Build through the real page template. Used by the
 * Admin (any build) and by a Builder (their own builds); the API route
 * behind `apiUrl` decides who may see what.
 */
export default function BuildPreview({
  apiUrl,
  backHref,
  backLabel,
  note,
}: {
  apiUrl: string;
  backHref: string;
  backLabel: string;
  note: (p: Preview["build"]) => string;
}) {
  const { ready, authenticated, login, getAccessToken } = usePrivy();
  const [data, setData] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !authenticated) return;
    (async () => {
      try {
        const token = await getAccessToken();
        const res = await fetch(apiUrl, { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(json.error ?? "Couldn't load the preview.");
          return;
        }
        setData(json);
      } catch {
        setError("Couldn't load the preview.");
      }
    })();
  }, [ready, authenticated, getAccessToken, apiUrl]);

  if (!ready) return null;
  if (!authenticated) {
    return (
      <main style={{ padding: 40 }}>
        <p>Log in to see this preview.</p>
        <button className="btn-primary" type="button" onClick={() => login()}>
          Log in
        </button>
      </main>
    );
  }
  if (error) return <main style={{ padding: 40 }}>{error}</main>;
  if (!data) return <main style={{ padding: 40 }}>Loading preview&hellip;</main>;

  return (
    <>
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 1000,
          background: "#1b1b1b",
          color: "#fff",
          padding: "8px 16px",
          fontSize: 14,
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <strong>Preview</strong>
        <span>{note(data.build)}</span>
        <a href={backHref} style={{ color: "#fff", marginLeft: "auto" }}>
          &larr; {backLabel}
        </a>
      </div>
      <BuildPageView build={data.build} draft={data.draft} photos={data.photos} handle={data.handle} />
      <Script src="/assets/qrcode.min.js" strategy="afterInteractive" />
      <Script src="/assets/qr.js" strategy="afterInteractive" />
      <Script src="/assets/site.js" strategy="afterInteractive" />
    </>
  );
}
