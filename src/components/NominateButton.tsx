"use client";

import { usePathname } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * "Nominate" button on a Builder's own page -- shown only to the Builder who
 * owns that page. Tapping it mints a one-person invite link and opens the
 * phone's share sheet (iMessage, WhatsApp, Instagram DM, anything), with an
 * optional photo of the car. Nothing about the person receiving it is stored.
 *
 * Phones only allow the share sheet straight after a tap, so the link is made
 * as soon as the sheet opens, and the share buttons then run synchronously.
 */

interface Minted {
  url: string;
  name: string;
}

export default function NominateButton() {
  const pathname = usePathname();
  const { authenticated, getAccessToken } = usePrivy();
  const authRef = useRef({ getAccessToken });
  authRef.current = { getAccessToken };

  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);

  // Find the Builder's own page (or one of their Build pages), and mount the
  // button next to Share.
  useEffect(() => {
    setSlot(null);
    const builderPage = /^\/builders\/([^/]+)\/?$/.exec(pathname || "");
    const buildPage = /^\/builds\/([^/]+)\/?$/.exec(pathname || "");
    if ((!builderPage && !buildPage) || !authenticated) return;
    let cancelled = false;
    let created: HTMLElement | null = null;
    let wrapper: HTMLElement | null = null;

    async function isOwner(): Promise<boolean> {
      const token = await authRef.current.getAccessToken();
      const headers = { Authorization: `Bearer ${token}` };
      if (builderPage) {
        const res = await fetch("/api/me", { headers });
        if (!res.ok) return false;
        const me = await res.json();
        return (
          String(me?.builder?.handle ?? "").toLowerCase() === decodeURIComponent(builderPage[1]).toLowerCase()
        );
      }
      const res = await fetch(`/api/builds/owner?slug=${encodeURIComponent(decodeURIComponent(buildPage![1]))}`, { headers });
      return res.ok;
    }

    (async () => {
      try {
        if (!(await isOwner()) || cancelled) return;
        // The page markup is server-rendered; wait for its Share button.
        for (let i = 0; i < 20 && !cancelled; i++) {
          const share = document.querySelector<HTMLElement>(".share-link:not(.nominate-btn)");
          if (share && share.parentElement) {
            // Put Nominate on the same row as Share.
            const row = document.createElement("div");
            row.className = "builder-actions";
            share.before(row);
            row.appendChild(share);
            created = document.createElement("div");
            created.className = "nominate-slot";
            row.appendChild(created);
            wrapper = row;
            setSlot(created);
            return;
          }
          await new Promise((r) => setTimeout(r, 100));
        }
      } catch {
        /* no button; the page is unchanged */
      }
    })();

    return () => {
      cancelled = true;
      created?.remove();
      if (wrapper) {
        // Put Share back where the server rendered it.
        const share = wrapper.querySelector<HTMLElement>(".share-link");
        if (share) wrapper.before(share);
        wrapper.remove();
      }
    };
  }, [pathname, authenticated]);

  if (!slot) return null;
  return (
    <>
      {createPortal(
        <button className="share-link nominate-btn" type="button" onClick={() => setOpen(true)}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="10" cy="8" r="3.5" />
            <path d="M3.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5M19 8v6M16 11h6" />
          </svg>
          <span className="share-link-label">Nominate</span>
        </button>,
        slot
      )}
      {open && <NominateSheet getToken={() => authRef.current.getAccessToken()} onClose={() => setOpen(false)} />}
    </>
  );
}

function NominateSheet({ getToken, onClose }: { getToken: () => Promise<string | null>; onClose: () => void }) {
  const [minted, setMinted] = useState<Minted | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  // Make the link the moment the sheet opens.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch("/api/nominations", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) setError(data.error ?? "Couldn't make your link.");
        else setMinted({ url: data.url, name: data.name });
      } catch {
        if (!cancelled) setError("Couldn't make your link. Check your connection and try again.");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const message = minted
    ? `${minted.name} nominated your car for motori.us, where exceptional restomods get a documented, permanent record. Apply here:`
    : "";

  function copyAll() {
    if (!minted) return;
    try {
      navigator.clipboard?.writeText(`${message} ${minted.url}`).catch(() => {});
    } catch {
      /* the link box below can be copied by hand */
    }
  }

  function share() {
    if (!minted) return;
    copyAll(); // some apps (Instagram) drop shared text, so it's on the clipboard too
    if (!canShare) {
      setNote("Link and message copied. Paste them into a text or DM.");
      return;
    }
    const withFile = photo && navigator.canShare?.({ files: [photo] });
    const data: ShareData = withFile
      ? { files: [photo as File], text: `${message} ${minted.url}` }
      : { title: "motori.us", text: message, url: minted.url };
    navigator
      .share(data)
      .then(() => setNote("Sent. Nominate another any time."))
      .catch((e: unknown) => {
        // Closing the sheet is not an error.
        if ((e as { name?: string })?.name !== "AbortError") setNote("Couldn't open the share sheet. Link copied; paste it into a message.");
      });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card nom-sheet" role="dialog" aria-modal="true" aria-label="Nominate a car" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h4>Nominate a car</h4>
          <button type="button" className="modal-x" aria-label="Close" onClick={onClose}>
            &times;
          </button>
        </div>
        <p className="nom-lede">
          Send the owner a personal link to apply. It goes through your own messages, and nothing about them is stored.
        </p>

        {error ? (
          <p className="nom-error">{error}</p>
        ) : !minted ? (
          <p className="nom-lede">Making your link…</p>
        ) : (
          <>
            <div className="btn-row">
              <button className="btn-primary" type="button" onClick={share}>
                {photo ? "Share link + photo" : "Share link"}
              </button>
              <label className="btn-secondary nom-photo">
                {photo ? "Change photo" : "Add a photo of the car"}
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    setPhoto(e.target.files?.[0] ?? null);
                    setNote(null);
                  }}
                />
              </label>
            </div>
            {photo && <p className="nom-small">Photo: {photo.name}</p>}
            {!canShare && (
              <div className="field">
                <label htmlFor="nom-link">Link</label>
                <input id="nom-link" type="text" readOnly value={minted.url} onFocus={(e) => e.currentTarget.select()} />
              </div>
            )}
            {note && <p className="nom-small">{note}</p>}
          </>
        )}
      </div>
    </div>
  );
}
