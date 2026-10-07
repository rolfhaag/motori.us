"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useRef } from "react";

const EYE =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.9 17.9A10.9 10.9 0 0 1 12 19C5.6 19 2 12 2 12a18.3 18.3 0 0 1 5.1-5.9M9.9 5.1A9.7 9.7 0 0 1 12 5c6.4 0 10 7 10 7a18.5 18.5 0 0 1-2.2 3.2M14.1 14.1a3 3 0 1 1-4.2-4.2"/><path d="M2 2l20 20"/></svg>';

/**
 * Pages show every VIN masked (the server never sends the real one). This adds
 * a small eye / crossed-out-eye button next to the VIN -- but only for a
 * logged-in Admin or the Builder who owns that build, as decided by
 * /api/vin. Everyone else just sees the masked VIN and no button. Clicking
 * the button fetches the real VIN and swaps it in; clicking again masks it.
 *
 * Pages render at different times (static, or after a client-side fetch), so
 * a MutationObserver picks up each VIN as it appears.
 */
export default function VinToggle() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const auth = useRef({ authenticated, getAccessToken });
  auth.current = { authenticated, getAccessToken };

  useEffect(() => {
    if (!ready || !authenticated) return;

    const handled = new WeakSet<Element>();

    async function call(query: string, check: boolean) {
      const token = await auth.current.getAccessToken();
      return fetch(`/api/vin?${query}${check ? "&check=1" : ""}`, { headers: { Authorization: `Bearer ${token}` } });
    }

    async function attach(p: HTMLElement) {
      if (handled.has(p)) return;
      handled.add(p);
      const slug = p.getAttribute("data-vin-slug");
      const id = p.getAttribute("data-vin-id");
      const query = id ? `id=${encodeURIComponent(id)}` : slug ? `slug=${encodeURIComponent(slug)}` : "";
      const valueEl = p.querySelector<HTMLElement>(".vin-value");
      if (!query || !valueEl) return;

      try {
        const res = await call(query, true);
        if (!res.ok) return; // not allowed: leave the masked VIN alone
      } catch {
        return;
      }

      const masked = valueEl.textContent ?? "";
      let full: string | null = null;
      let shown = false;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "vin-toggle";
      const paint = () => {
        btn.innerHTML = shown ? EYE_OFF : EYE;
        btn.setAttribute("aria-label", shown ? "Hide VIN" : "Show VIN");
        btn.title = shown ? "Hide VIN" : "Show VIN";
      };
      paint();
      btn.addEventListener("click", async () => {
        if (!shown) {
          if (full === null) {
            try {
              const r = await call(query, false);
              if (!r.ok) return;
              full = ((await r.json()).vin as string) || "";
            } catch {
              return;
            }
          }
          if (!full) return;
          valueEl.textContent = full;
          shown = true;
        } else {
          valueEl.textContent = masked;
          shown = false;
        }
        paint();
      });
      p.appendChild(btn);
    }

    const scan = () => document.querySelectorAll<HTMLElement>(".vin[data-vin-slug], .vin[data-vin-id]").forEach(attach);
    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [ready, authenticated]);

  return null;
}
