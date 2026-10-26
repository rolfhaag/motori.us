import { normalizeSocial } from "@/lib/spotters";
import { esc } from "@/lib/email/layout";

export type SocialNetwork = "instagram" | "tiktok" | "other";

export interface SocialLink {
  network: SocialNetwork;
  /** Instagram / TikTok handle without the @ (validated, safe to put in markup). */
  handle?: string;
  label: string;
  url: string | null;
}

const IG_HANDLE = /^[A-Za-z0-9._]{1,30}$/;
const TT_HANDLE = /^[A-Za-z0-9._]{2,24}$/;
const IG_RESERVED = new Set(["p", "reel", "reels", "explore", "stories", "accounts", "tv", "direct"]);

/**
 * Turns the free-text socials a Builder typed ("@name", "instagram.com/name",
 * "tiktok.com/@name", several separated by spaces, commas or lines) into
 * classified links. A bare @name is Instagram. Anything that isn't a clean
 * handle or https link is kept as plain text, never as a link.
 */
export function parseSocials(raw: string | null | undefined): SocialLink[] {
  const parts = String(raw ?? "")
    .split(/[\s,;]+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 6);
  const out: SocialLink[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    let link: SocialLink;
    if (/^@[A-Za-z0-9._]+$/.test(p) && IG_HANDLE.test(p.slice(1))) {
      link = { network: "instagram", handle: p.slice(1), label: p, url: `https://www.instagram.com/${p.slice(1)}/` };
    } else {
      const url = normalizeSocial(p);
      if (!url) {
        link = { network: "other", label: p.slice(0, 60), url: null };
      } else {
        const u = new URL(url);
        const host = u.hostname.replace(/^www\./, "").toLowerCase();
        const seg = u.pathname.split("/").filter(Boolean)[0] ?? "";
        if (host === "instagram.com" && IG_HANDLE.test(seg) && !IG_RESERVED.has(seg.toLowerCase())) {
          link = { network: "instagram", handle: seg, label: `@${seg}`, url: `https://www.instagram.com/${seg}/` };
        } else if (host === "tiktok.com" && /^@/.test(seg) && TT_HANDLE.test(seg.slice(1))) {
          link = { network: "tiktok", handle: seg.slice(1), label: seg, url: `https://www.tiktok.com/${seg}` };
        } else {
          link = { network: "other", label: `${host}${u.pathname}`.replace(/\/$/, "").slice(0, 60), url };
        }
      }
    }
    const key = `${link.network}:${(link.handle ?? link.label).toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(link);
  }
  return out;
}

const IG_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c2.7 0 3.05.01 4.12.06 1.06.05 1.79.22 2.43.47.66.26 1.21.6 1.76 1.15.55.55.9 1.1 1.15 1.76.25.64.42 1.37.47 2.43.05 1.07.06 1.42.06 4.12s-.01 3.05-.06 4.12c-.05 1.06-.22 1.79-.47 2.43a4.9 4.9 0 0 1-1.15 1.76 4.9 4.9 0 0 1-1.76 1.15c-.64.25-1.37.42-2.43.47-1.07.05-1.42.06-4.12.06s-3.05-.01-4.12-.06c-1.06-.05-1.79-.22-2.43-.47a4.9 4.9 0 0 1-1.76-1.15 4.9 4.9 0 0 1-1.15-1.76c-.25-.64-.42-1.37-.47-2.43C2.01 15.05 2 14.7 2 12s.01-3.05.06-4.12c.05-1.06.22-1.79.47-2.43.26-.66.6-1.21 1.15-1.76A4.9 4.9 0 0 1 5.44.54C6.08.29 6.81.12 7.87.07 8.95.01 9.3 0 12 0zm0 5.35A6.65 6.65 0 1 0 12 18.65 6.65 6.65 0 0 0 12 5.35zm0 10.97A4.32 4.32 0 1 1 12 7.68a4.32 4.32 0 0 1 0 8.64zm6.9-11.22a1.55 1.55 0 1 1-3.1 0 1.55 1.55 0 0 1 3.1 0z"/></svg>`;
const TT_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M16.6 5.82c-.9-.9-1.4-2.13-1.4-3.4h-3.1v13.55a2.7 2.7 0 1 1-2.3-2.67v-3.14a5.8 5.8 0 1 0 5.4 5.78V9.4a6.8 6.8 0 0 0 4.2 1.44V7.72c-1 0-1.9-.4-2.8-1.3l-.1-.6z"/></svg>`;

const IG_STYLE =
  "background:#FFF; border:0; border-radius:3px; box-shadow:0 0 1px 0 rgba(0,0,0,0.5),0 1px 10px 0 rgba(0,0,0,0.15); margin: 1px; max-width:540px; min-width:326px; padding:0; width:99.375%; width:-webkit-calc(100% - 2px); width:calc(100% - 2px);";

/**
 * "Follow along": the same section the Mahlzeit page has, built from a
 * Builder's handles. Instagram and TikTok handles become embedded feeds
 * (Instagram's and TikTok's own embed scripts render them); every other
 * social stays a plain link underneath. Empty string when there's nothing to show.
 */
export function followAlongHtml(links: SocialLink[]): { html: string; hasInstagram: boolean; hasTikTok: boolean } {
  const ig = links.find((l) => l.network === "instagram");
  const tt = links.find((l) => l.network === "tiktok");
  const others = links.filter((l) => l.network === "other");
  if (!ig && !tt && others.length === 0) return { html: "", hasInstagram: false, hasTikTok: false };

  const cols: string[] = [];
  if (ig?.handle) {
    const h = esc(ig.handle);
    cols.push(`<div class="embedcol">
          <div class="feed-label">${IG_ICON} Instagram: @${h}</div>
          <div class="embed-holder">
            <blockquote class="instagram-media" data-instgrm-permalink="https://www.instagram.com/${h}/?utm_source=ig_embed&amp;utm_campaign=loading" data-instgrm-version="14" style="${IG_STYLE}"><div style="padding:16px;"><a href="https://www.instagram.com/${h}/?utm_source=ig_embed&amp;utm_campaign=loading" target="_blank" rel="noopener noreferrer">View @${h} on Instagram</a></div></blockquote>
          </div>
        </div>`);
  }
  if (tt?.handle) {
    const h = esc(tt.handle);
    cols.push(`<div class="embedcol">
          <div class="feed-label">${TT_ICON} TikTok: @${h}</div>
          <div class="embed-holder">
            <blockquote class="tiktok-embed" cite="https://www.tiktok.com/@${h}" data-unique-id="${h}" data-embed-type="creator" style="max-width: 780px; min-width: 288px;"> <section> <a target="_blank" rel="noopener noreferrer" href="https://www.tiktok.com/@${h}?refer=creator_embed">@${h}</a> </section> </blockquote>
          </div>
        </div>`);
  }
  const embeds = cols.length ? `<div class="embedrow${cols.length === 1 ? " single" : ""}">${cols.join("\n")}</div>` : "";
  const rest = others.length
    ? `<p class="builder-socials">${others
        .map((l) =>
          l.url
            ? `<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer nofollow ugc">${esc(l.label)}</a>`
            : `<span>${esc(l.label)}</span>`
        )
        .join("")}</p>`
    : "";
  const html = `<section id="builder-follow" class="section-compact">
    <div class="wrap">
      <p class="kicker">Watch it happen</p>
      <h2 class="h">Follow along</h2>
      <p class="lede">The day-to-day lives on social. The full record lives here.</p>
      ${embeds}
      ${rest}
    </div>
  </section>`;
  return { html, hasInstagram: Boolean(ig?.handle), hasTikTok: Boolean(tt?.handle) };
}
