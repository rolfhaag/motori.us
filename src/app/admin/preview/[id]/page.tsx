"use client";

import { usePrivy } from "@privy-io/react-auth";
import { use, useEffect, useState } from "react";
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
 * Admin-only preview: the real Build-page template, fed from the database
 * with the Admin's own login, so a submitted Build can be reviewed (and
 * decided on) before anything is public.
 */
export default function AdminPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { ready, authenticated, login, getAccessToken } = usePrivy();
  const [data, setData] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !authenticated) return;
    (async () => {
      try {
        const token = await getAccessToken();
        const res = await fetch(`/api/admin/builds/${id}/preview`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? "Couldn't load the preview.");
          return;
        }
        setData(json);
      } catch {
        setError("Couldn't load the preview.");
      }
    })();
  }, [ready, authenticated, getAccessToken, id]);

  if (!ready) return null;
  if (!authenticated) {
    return (
      <main style={{ padding: 40 }}>
        <p>Log in as Admin to preview this build.</p>
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
        <strong>Admin preview</strong>
        <span>
          {data.build.status === "published"
            ? data.build.visibility === "private"
              ? "Published privately"
              : "Published"
            : `Not public (status: ${data.build.status})`}
          {" · VIN is visible here"}
        </span>
        <a href="/admin" style={{ color: "#fff", marginLeft: "auto" }}>
          &larr; Back to dashboard
        </a>
      </div>
      <BuildPageView build={data.build} draft={data.draft} photos={data.photos} handle={data.handle} />
      <Script src={"/assets/qrcode.min.js"} strategy="afterInteractive" />
      <Script src={"/assets/qr.js"} strategy="afterInteractive" />
      <Script src={"/assets/site.js"} strategy="afterInteractive" />
    </>
  );
}
