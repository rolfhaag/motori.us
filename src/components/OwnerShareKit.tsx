"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface Kit {
  url: string;
  imageCount: number;
  caption: string;
}

/**
 * Adds Instagram and Facebook sharing to the existing share dialog (QR code,
 * Copy link, Download) -- but only when the signed-in viewer is the Builder
 * who owns that published Build. The dialog itself is built by site.js,
 * which announces it with a `motori:share-open` event; we append a block to
 * its card and render into it.
 *
 * Both buttons use the phone's own share sheet (Web Share API), so there is
 * no Instagram/Facebook login and no app review. Apps like Instagram ignore
 * caption text sent through a share sheet, so the caption is copied to the
 * clipboard first and the Builder pastes it. On a computer (no share sheet)
 * Instagram falls back to downloading the images, and Facebook opens its
 * regular share window.
 */
export default function OwnerShareKit() {
  const { authenticated, getAccessToken } = usePrivy();
  const authRef = useRef({ authenticated, getAccessToken });
  authRef.current = { authenticated, getAccessToken };
  const [mounts, setMounts] = useState<{ el: HTMLElement; slug: string }[]>([]);

  useEffect(() => {
    const onOpen = (e: Event) => {
      if (!authRef.current.authenticated) return;
      const { url, card } = (e as CustomEvent).detail as { url: string; card: HTMLElement };
      const slug = /\/builds\/([^/?#]+)/.exec(String(url))?.[1];
      if (!slug || !card) return;
      const el = document.createElement("div");
      el.className = "share-social";
      el.hidden = true; // revealed only once we know the viewer owns this build
      card.appendChild(el);
      setMounts((m) => [...m.filter((x) => x.el.isConnected), { el, slug }]);
    };
    document.addEventListener("motori:share-open", onOpen);
    return () => document.removeEventListener("motori:share-open", onOpen);
  }, []);

  return (
    <>
      {mounts.map((m) =>
        createPortal(<SocialRow key={m.slug} root={m.el} slug={m.slug} getToken={() => authRef.current.getAccessToken()} />, m.el)
      )}
    </>
  );
}

function download(file: File, delay: number) {
  setTimeout(() => {
    const a = document.createElement("a");
    const href = URL.createObjectURL(file);
    a.href = href;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(href), 2000);
  }, delay);
}

function SocialRow({ root, slug, getToken }: { root: HTMLElement; slug: string; getToken: () => Promise<string | null> }) {
  const [kit, setKit] = useState<Kit | null>(null);
  const [files, setFiles] = useState<File[] | null>(null);
  const [caption, setCaption] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(`/api/builds/share-kit?slug=${encodeURIComponent(slug)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) return; // not the owner: leave the dialog as it was
        const data: Kit = await res.json();
        if (cancelled) return;
        setKit(data);
        setCaption(data.caption);
        root.hidden = false;

        // Fetch the images now, so tapping Instagram can open the share sheet
        // immediately (phones only allow it straight after a tap).
        const loaded = await Promise.all(
          Array.from({ length: data.imageCount }, async (_, i) => {
            const r = await fetch(`/builds/${slug}/share-image/${i}`);
            if (!r.ok) return null;
            return new File([await r.blob()], `${slug}-${i + 1}.jpg`, { type: "image/jpeg" });
          })
        );
        if (!cancelled) setFiles(loaded.filter((f): f is File => Boolean(f)));
      } catch {
        /* no kit; dialog unchanged */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  if (!kit) return null;
  const ready = files !== null;

  function copy() {
    try {
      navigator.clipboard?.writeText(caption).catch(() => {});
    } catch {
      /* the caption box below can be copied by hand */
    }
  }

  function instagram() {
    if (!files || files.length === 0) return;
    copy();
    if (navigator.canShare?.({ files })) {
      navigator.share({ files }).catch(() => {}); // closing the sheet is not an error
      setStatus("Caption copied. Choose Instagram in the share sheet, then paste the caption into Instagram's caption box.");
    } else {
      files.forEach((f, i) => download(f, i * 350));
      setStatus(
        "Caption copied and photos downloaded. Open Instagram, start a new post with those photos, and paste the caption."
      );
    }
  }

  function facebook() {
    copy();
    const coarse = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
    if (coarse && navigator.share) {
      navigator.share({ url: kit!.url }).catch(() => {});
      setStatus("Caption copied. Choose Facebook in the share sheet; the page preview appears automatically. Paste the caption if you want it.");
    } else {
      window.open(
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(kit!.url)}`,
        "_blank",
        "noopener,noreferrer,width=640,height=560"
      );
      setStatus("Caption copied. Paste it into your Facebook post if you want it; the page preview appears automatically.");
    }
  }

  const igDisabled = !ready || (files?.length ?? 0) === 0;

  return (
    <>
      <div className="share-social-row">
        <button type="button" className="share-social-btn" onClick={instagram} disabled={igDisabled} aria-label="Share to Instagram">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
          </svg>
          <span>{!ready ? "Preparing…" : "Instagram"}</span>
        </button>
        <button type="button" className="share-social-btn" onClick={facebook} aria-label="Share to Facebook">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
            <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.6-1.5h1.5V4.4c-.3 0-1.2-.1-2.2-.1-2.3 0-3.9 1.4-3.9 4v2.2H8v3h2.5V21h3z" />
          </svg>
          <span>Facebook</span>
        </button>
      </div>
      <label className="share-social-caption">
        <span>Caption (edit if you like)</span>
        <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={6} />
      </label>
      {status && <p className="share-modal-hint">{status}</p>}
    </>
  );
}
